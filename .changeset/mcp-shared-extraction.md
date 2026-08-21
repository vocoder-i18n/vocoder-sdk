---
"@vocoder/cli": minor
"@vocoder/mcp": patch
---

`vocoder_translate` now extracts through the CLI instead of its own copy, so
monorepos work.

The MCP server ignored `apps[]` entirely and hardcoded `appDir: ""` into both
the fingerprint scope and the submission. Every monorepo therefore uploaded one
merged string set under a scope the plugin never computes at build time — a
fingerprint matching nothing, so the runtime asked for a bundle that was never
built.

Per-app extraction moves to `utils/extract-apps.ts` and is exported from
`@vocoder/cli/lib` as `extractApps` and `resolveAppDirs`. The CLI command keeps
its spinner through two optional callbacks; nothing else about its behaviour
changes. Both callers now resolve app directories, merge per-app config over
root config, and compute the `${projectShortId}:${appDir}` fingerprint scope
through one implementation.

`vocoder_translate` also gains an `appDir` input, mirroring the CLI's
`--app-dir`, so an agent can target a single app in a monorepo.
