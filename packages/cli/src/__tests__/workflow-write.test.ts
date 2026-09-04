import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	renderWorkflowYaml,
	renderPerAppWorkflowYaml,
	writeGitHubActionsWorkflow,
} from "../utils/workflow-write.js";

describe("renderWorkflowYaml", () => {
	it("renders a single branch with quotes", () => {
		const yaml = renderWorkflowYaml(["main"]);
		expect(yaml).toContain("branches: ['main']");
	});

	it("renders multiple branches comma-separated", () => {
		const yaml = renderWorkflowYaml(["main", "release/v2", "staging"]);
		expect(yaml).toContain("branches: ['main', 'release/v2', 'staging']");
	});

	it("references the published action by its versioned tag", () => {
		const yaml = renderWorkflowYaml(["main"]);
		expect(yaml).toContain("uses: vocoder-i18n/translate-action@v1");
	});

	it("passes the VOCODER_API_KEY secret as the api-key input", () => {
		const yaml = renderWorkflowYaml(["main"]);
		expect(yaml).toContain("api-key: ${{ secrets.VOCODER_API_KEY }}");
	});

	it("sets on-failure to proceed so translation errors do not block the build", () => {
		const yaml = renderWorkflowYaml(["main"]);
		expect(yaml).toContain("on-failure: proceed");
	});

	it("omits app-dirs line", () => {
		const yaml = renderWorkflowYaml(["main"]);
		expect(yaml).not.toContain("app-dirs:");
	});

	it("checks out the repo before running the action", () => {
		const yaml = renderWorkflowYaml(["main"]);
		const checkoutIdx = yaml.indexOf("actions/checkout@v4");
		const actionIdx = yaml.indexOf("vocoder-i18n/translate-action");
		expect(checkoutIdx).toBeGreaterThan(-1);
		expect(actionIdx).toBeGreaterThan(checkoutIdx);
	});
});

describe("permissions and guards", () => {
	// The generated file is parsed rather than substring-matched. A permissions
	// block is only meaningful as the map GitHub actually reads: indentation
	// errors and duplicate keys both survive `toContain` and both silently
	// change which scopes the job is granted.
	const permissionsOf = (yaml: string) =>
		parse(yaml).jobs.translate.permissions as Record<string, string>;

	it("grants pull-requests: write in pr mode, which gh pr create requires", () => {
		expect(permissionsOf(renderWorkflowYaml(["main"]))).toEqual({
			"contents": "write",
			"pull-requests": "write",
		});
	});

	it("withholds pull-requests: write in direct mode, which never calls the pull request API", () => {
		expect(permissionsOf(renderWorkflowYaml(["main"], "DIRECT"))).toEqual({
			"contents": "write",
		});
	});

	it("grants pull-requests: write in the per-app template, which passes no commit-mode and so gets the action's pr default", () => {
		expect(permissionsOf(renderPerAppWorkflowYaml("apps/web", ["main"]))).toEqual({
			"contents": "write",
			"pull-requests": "write",
		});
	});

	it("renders valid YAML whose job wires the action to the selected commit mode", () => {
		const doc = parse(renderWorkflowYaml(["main", "staging"]));
		expect(doc.name).toBe("Vocoder Translate");
		expect(doc.on.push.branches).toEqual(["main", "staging"]);
		const step = doc.jobs.translate.steps.at(-1);
		expect(step.uses).toBe("vocoder-i18n/translate-action@v1");
		expect(step.with["commit-mode"]).toBe("pr");
	});

	it("writes commit-mode: pr by default", () => {
		const yaml = renderWorkflowYaml(["main"]);
		expect(yaml).toContain("commit-mode: pr");
	});

	it("writes commit-mode: direct when selected", () => {
		const yaml = renderWorkflowYaml(["main"], "DIRECT");
		expect(yaml).toContain("commit-mode: direct");
	});

	it("includes if guard for vocoder-bot[bot]", () => {
		expect(renderWorkflowYaml(["main"])).toContain(
			"if: github.actor != 'vocoder-bot[bot]'",
		);
	});

	it("includes contents: write permission", () => {
		expect(renderWorkflowYaml(["main"])).toContain("contents: write");
	});
});

describe("renderPerAppWorkflowYaml", () => {
	it("renders the app-dir in the action inputs", () => {
		const yaml = renderPerAppWorkflowYaml("apps/web", ["main"]);
		expect(yaml).toContain("app-dir: apps/web");
	});

	it("renders branches from the argument", () => {
		const yaml = renderPerAppWorkflowYaml("apps/web", ["main", "staging"]);
		expect(yaml).toContain("branches: ['main', 'staging']");
	});

	it("includes the app dir in the workflow name", () => {
		const yaml = renderPerAppWorkflowYaml("apps/admin", ["main"]);
		expect(yaml).toContain("name: Vocoder Translate — apps/admin");
	});

	it("includes the vocoder-bot guard", () => {
		const yaml = renderPerAppWorkflowYaml("apps/web", ["main"]);
		expect(yaml).toContain("if: github.actor != 'vocoder-bot[bot]'");
	});

	it("references the published action", () => {
		const yaml = renderPerAppWorkflowYaml("apps/web", ["main"]);
		expect(yaml).toContain("uses: vocoder-i18n/translate-action@v1");
	});
});

describe("writeGitHubActionsWorkflow", () => {
	let repoRoot: string;

	beforeEach(() => {
		repoRoot = mkdtempSync(join(tmpdir(), "vocoder-workflow-test-"));
	});

	afterEach(() => {
		rmSync(repoRoot, { recursive: true, force: true });
	});

	it("creates .github/workflows/vocoder-translate.yml when absent", () => {
		const result = writeGitHubActionsWorkflow(repoRoot, ["main"]);

		expect(result.written).toBe(true);
		expect(result.relativePath).toBe(".github/workflows/vocoder-translate.yml");
		expect(existsSync(result.path)).toBe(true);

		const contents = readFileSync(result.path, "utf-8");
		expect(contents).toContain("name: Vocoder Translate");
		expect(contents).toContain("branches: ['main']");
	});

	it("creates the .github/workflows directory tree if missing", () => {
		expect(existsSync(join(repoRoot, ".github"))).toBe(false);

		writeGitHubActionsWorkflow(repoRoot, ["main"]);

		expect(existsSync(join(repoRoot, ".github", "workflows"))).toBe(true);
	});

	it("does not overwrite an existing workflow file", () => {
		const workflowDir = join(repoRoot, ".github", "workflows");
		mkdirSync(workflowDir, { recursive: true });
		const workflowPath = join(workflowDir, "vocoder-translate.yml");
		writeFileSync(workflowPath, "# user-customized workflow", "utf-8");

		const result = writeGitHubActionsWorkflow(repoRoot, ["main"]);

		expect(result.written).toBe(false);
		expect(readFileSync(workflowPath, "utf-8")).toBe(
			"# user-customized workflow",
		);
	});
});
