import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readWorkflowCommitMode } from "../utils/workflow-read.js";

describe("readWorkflowCommitMode", () => {
	let repoRoot: string;

	beforeEach(() => {
		repoRoot = mkdtempSync(join(tmpdir(), "vocoder-test-"));
	});

	afterEach(() => {
		rmSync(repoRoot, { recursive: true, force: true });
	});

	function writeWorkflow(content: string) {
		const dir = join(repoRoot, ".github", "workflows");
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, "vocoder-translate.yml"), content, "utf-8");
	}

	it("recognizes commit-mode: direct", () => {
		writeWorkflow("      commit-mode: direct\n");
		expect(readWorkflowCommitMode(repoRoot)).toBe("DIRECT");
	});

	it("still recognizes commit-mode: pr", () => {
		writeWorkflow("      commit-mode: pr\n");
		expect(readWorkflowCommitMode(repoRoot)).toBe("PR");
	});

	it("is case-insensitive", () => {
		writeWorkflow("      commit-mode: PR\n");
		expect(readWorkflowCommitMode(repoRoot)).toBe("PR");

		writeWorkflow("      commit-mode: DIRECT\n");
		expect(readWorkflowCommitMode(repoRoot)).toBe("DIRECT");
	});

	it("returns null when commit-mode field is absent", () => {
		writeWorkflow("name: Vocoder Translate\non:\n  push:\n    branches: ['main']\n");
		expect(readWorkflowCommitMode(repoRoot)).toBeNull();
	});

	it("returns null when workflow file does not exist", () => {
		expect(readWorkflowCommitMode(repoRoot)).toBeNull();
	});
});
