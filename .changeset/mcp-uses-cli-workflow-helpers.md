---
"@vocoder/cli": minor
"@vocoder/mcp": patch
---

The MCP server now renders its GitHub Actions workflow with the CLI's own
generator instead of hand-building a copy.

`@vocoder/cli/lib` gains `WORKFLOW_RELATIVE_PATH`, `renderWorkflowYaml`,
`writeGitHubActionsWorkflow`, `readWorkflowBranches` and `readWorkflowCommitMode`.

The MCP's duplicate had drifted in four ways at once. It omitted the
`github.actor != 'vocoder-bot[bot]'` guard, so a bot commit could retrigger the
workflow. It omitted the `permissions` block, so the push failed on a
default-read-only token. It omitted `commit-mode`, which is what the CLI reads
back to decide between opening a PR and pushing directly. And it told agents to
write `.github/workflows/vocoder.yml` while the CLI writes and reads
`vocoder-translate.yml` — so in an MCP-provisioned repo `readWorkflowBranches`
and `readWorkflowCommitMode` both returned null and branch and commit-mode
configuration was silently ignored.

The workflow path was previously written out in seven places across the two
packages, three times inside the CLI alone, and they disagreed. It is now one
exported constant.
