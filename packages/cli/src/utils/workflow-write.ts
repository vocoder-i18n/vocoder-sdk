import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { WORKFLOW_RELATIVE_PATH } from "./workflow-path.js";

export interface WorkflowWriteResult {
	/** Absolute path the file lives at (whether written now or already present). */
	path: string;
	/** Path relative to `repoRoot` — used in user-facing output. */
	relativePath: string;
	/** True when this call created the file. False when it was already present. */
	written: boolean;
}

/**
 * Render the GitHub Actions workflow YAML that triggers `vocoder translate`
 * on push to one of `targetBranches`. The branches array must already be the
 * set the user selected at project-create time — no defaulting here.
 *
 * `commitMode` controls whether the action opens a pull request ("PR",
 * default) or pushes translations directly to the target branch ("DIRECT").
 * It is written into the generated YAML as a lowercase `commit-mode:` input,
 * matching what `readWorkflowCommitMode` parses back.
 *
 * The `permissions:` block is scoped to the selected mode. Both modes push a
 * branch, so both need `contents: write`. PR mode additionally calls
 * `gh pr create` and `gh pr merge --auto`, which the default GITHUB_TOKEN
 * cannot do without `pull-requests: write` — the run would pay for the
 * translation and then fail at delivery. DIRECT mode never touches the pull
 * request API, so it is not granted the scope.
 */
export function renderWorkflowYaml(
	targetBranches: string[],
	commitMode: "PR" | "DIRECT" = "PR",
): string {
	const branches = targetBranches.map((b) => `'${b}'`).join(", ");
	const permissions =
		commitMode === "PR"
			? "      contents: write\n      pull-requests: write"
			: "      contents: write";
	return `name: Vocoder Translate
on:
  push:
    branches: [${branches}]
jobs:
  translate:
    runs-on: ubuntu-latest
    if: github.actor != 'vocoder-bot[bot]'
    permissions:
${permissions}
    steps:
      - uses: actions/checkout@v4
      - uses: vocoder-i18n/translate-action@v1
        with:
          api-key: \${{ secrets.VOCODER_API_KEY }}
          commit-mode: ${commitMode.toLowerCase()}
          # proceed: build continues even if translations fail (default)
          # fail: block the build if translations fail
          on-failure: proceed
`;
}

/**
 * Render a per-app workflow YAML for advanced monorepos where different apps
 * target different branches. The generated file uses `app-dir` to target one
 * specific app. Most teams use a single workflow — this is an advanced escape hatch.
 *
 * This template passes no `commit-mode:` input, so the action's own default
 * ("pr") applies and `pull-requests: write` is always required.
 */
export function renderPerAppWorkflowYaml(appDir: string, branches: string[]): string {
	const branchList = branches.map((b) => `'${b}'`).join(", ");
	return `name: Vocoder Translate — ${appDir}
on:
  push:
    branches: [${branchList}]
jobs:
  translate:
    runs-on: ubuntu-latest
    if: github.actor != 'vocoder-bot[bot]'
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: vocoder-i18n/translate-action@v1
        with:
          api-key: \${{ secrets.VOCODER_API_KEY }}
          app-dir: ${appDir}
          # proceed: build continues even if translations fail (default)
          # fail: block the build if translations fail
          on-failure: proceed
`;
}

/**
 * Write `.github/workflows/vocoder-translate.yml` under `repoRoot`. Skips silently if
 * the file already exists — the user may have a custom workflow they don't
 * want overwritten.
 */
export function writeGitHubActionsWorkflow(
	repoRoot: string,
	targetBranches: string[],
	commitMode: "PR" | "DIRECT" = "PR",
): WorkflowWriteResult {
	const relativePath = WORKFLOW_RELATIVE_PATH;
	const absolutePath = join(repoRoot, relativePath);

	if (existsSync(absolutePath)) {
		return { path: absolutePath, relativePath, written: false };
	}

	mkdirSync(dirname(absolutePath), { recursive: true });
	writeFileSync(absolutePath, renderWorkflowYaml(targetBranches, commitMode), "utf-8");
	return { path: absolutePath, relativePath, written: true };
}
