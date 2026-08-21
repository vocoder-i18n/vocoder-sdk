---
"@vocoder/cli": minor
"@vocoder/mcp": patch
---

`vocoder_regenerate_key` picked the wrong app in a monorepo, and told agents to
write a config field that does not exist.

It selected `existingApps[0]` — whichever app the lookup happened to return
first — so an agent working in `apps/admin` could rotate `apps/web`'s API key
instead. It now uses the CLI's `resolveLookupMatch`, which prefers an exact
`appDir` match and only falls back to a whole-repo app when one exists. When
nothing matches it says which directory was missing rather than proceeding with
an arbitrary app.

The config it emitted included `appId`, which is not a field on `VocoderConfig`
at all: TypeScript rejects it and the config parser silently drops it. It also
pinned `localesDir: 'src/locales'`, diverging from both the CLI and the SDK
default. Config text is now rendered by the CLI.

`@vocoder/cli/lib` gains `renderVocoderConfig`, `writeVocoderConfig`,
`resolveLookupMatch` and `ResolvedLookupMatch`. `writeVocoderConfig` keeps its
behaviour and now delegates its content to `renderVocoderConfig`, mirroring the
`renderWorkflowYaml` / `writeGitHubActionsWorkflow` split.
