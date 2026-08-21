/**
 * The one place the Vocoder workflow's location is written down.
 *
 * It was previously spelled out in seven places across the CLI and the MCP
 * server, and they disagreed: the MCP told agents to write `vocoder.yml` while
 * the CLI wrote and read `vocoder-translate.yml`. In an MCP-provisioned repo
 * `readWorkflowBranches` and `readWorkflowCommitMode` therefore both returned
 * null, so branch and commit-mode config was silently ignored.
 */
export const WORKFLOW_RELATIVE_PATH = ".github/workflows/vocoder-translate.yml";
