# @vocoder/mcp

## 0.23.0

### Minor Changes

- a167826: `vocoder_init_complete` no longer blocks waiting for browser sign-in, and
  sessions survive a restart.

  It looped for up to five minutes polling the auth session. Most MCP clients time
  out long before that, killing the call while the session was still valid and
  leaving no way to resume. It now polls once and returns `pending: true` with
  instructions to call again with the same `sessionId`.

  Sessions move from a process-local `Map` to `~/.vocoder/mcp-sessions.json`. The
  setup flow tells the user to restart their editor after adding the API key,
  which used to destroy the session the next step needs. Entries carry an expiry
  and are pruned on read.

  `InitCompleteResult.authenticated` is now `boolean` rather than the literal
  `true`, and gains an optional `pending` flag.

- a1d86d0: Port the MCP server to `@modelcontextprotocol/server` v2, and report the real
  server version.

  The server was built on `@modelcontextprotocol/sdk` v1. It now uses the v2
  package: `server.tool(name, description, shape, cb)` becomes
  `server.registerTool(name, { description, inputSchema }, cb)`, `server.resource`
  becomes `server.registerResource`, and input schemas are `z.object(...)` rather
  than raw shapes. All 13 tools and 10 resources are ported; behaviour is
  unchanged.

  v2 requires Zod 4, so the package moves from `zod@^3.24.0` to `zod@^4.2.0`.
  Zod is used nowhere else in the monorepo, and only for `z.object`, `z.string`,
  `z.array`, `.optional()` and `.describe()`, all of which are unchanged across
  the major.

  `serverInfo.version` is now read from package.json. It was hardcoded to `0.1.0`
  while the package shipped `0.22.0`, and connecting clients display it.

  Note this does **not** move the negotiated protocol version. Both the v1 SDK at
  1.30.0 and the v2 server at 2.0.0 report `LATEST_PROTOCOL_VERSION: 2025-11-25`;
  no released TypeScript package implements the 2026-07-28 revision yet. The
  reason to be on v2 is that it ships the MRTR primitives — `inputRequired`,
  `acceptedContent`, `createRequestStateCodec` — which are what replace the
  blocking auth poll.

### Patch Changes

- @vocoder/cli@0.23.0
- @vocoder/extractor@0.23.0
- @vocoder/plugin@0.23.0

## 0.22.0

### Patch Changes

- 1187b2a: `vocoder_regenerate_key` picked the wrong app in a monorepo, and told agents to
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

- 573463c: Fix the Next.js App Router scaffold emitting code that does not compile.

  `vocoder_implement_i18n` generated a `layout.tsx` importing `getConfig` and
  `getLocales` from `@vocoder/react`, which exports neither — they live in
  `@vocoder/react/server` alongside `getLocaleDir`, which the same snippet already
  imported correctly. The wrong claim appeared three times: in the generated code
  and in two prose instructions telling the agent what to import.

  This is the flagship agent path for the most common React framework, so the
  failure was: assistant writes the file exactly as instructed, project does not
  build.

  Imports are now validated against what `@vocoder/react` actually exports, read
  from source, rather than asserted against a fixed string — moving an export
  between entry points fails the test.

  Two related corrections in the same tool:
  - **The generated `vocoder.config.ts` no longer pins `localesDir: 'src/locales'`.**
    The CLI writes `defineConfig({})` for a single-app project and lets the SDK
    default (`locales`) apply, so a project set up through the MCP was laid out
    differently from one set up with `vocoder init`.
  - **File scanning stops at 100 files and now says so.** `filesToScanTruncated`
    is reported on `phase4_wrapping` and the step text changes accordingly, so a
    partial list is no longer presented as the complete set of files to wrap.

- 583f8f6: `vocoder_translate` now extracts through the CLI instead of its own copy, so
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

- 7b205ee: The MCP server now renders its GitHub Actions workflow with the CLI's own
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

- Updated dependencies [1187b2a]
- Updated dependencies [583f8f6]
- Updated dependencies [7b205ee]
  - @vocoder/cli@0.22.0
  - @vocoder/extractor@0.22.0
  - @vocoder/plugin@0.22.0

## 0.21.0

### Patch Changes

- Add a node shebang so the published binary is executable.

  `package.json` declares `bin: { "vocoder-mcp": "dist/index.js" }`, but the entry
  source had no shebang, so the built file began with the `// @ts-nocheck` banner
  and was written mode 644. npm links that file directly; with no interpreter line
  the kernel falls through to `sh`, which fails on the first `import`:

      ./dist/index.js: line 1: //: is a directory
      ./dist/index.js: line 4: import: command not found

  `npx @vocoder/mcp` therefore failed on macOS and Linux while appearing to work
  on Windows, whose shims default to node.

  Adding the shebang to the entry lets tsup hoist it above the banner and mark the
  output executable, matching how `@vocoder/cli` already builds. Verified through
  to the tarball: `npm pack` preserves both the shebang and mode 755, and the
  built server completes an MCP `initialize` handshake and registers all 13 tools
  over stdio.

- Updated dependencies [0b67cbd]
- Updated dependencies
  - @vocoder/cli@0.21.0
  - @vocoder/extractor@0.21.0
  - @vocoder/plugin@0.21.0

## 0.20.0

### Minor Changes

- Rename CLI commands and MCP tools for consistency; eliminate VocoderClient duplication.

  **CLI command renames:**
  - `translations` → `pull` (git-pull analogy)
  - `app-config` → `config` (shows project config, not runtime status)
  - `create-app` → `create-project` (project-centric management)

  **MCP tool renames:**
  - `vocoder_sync` → `vocoder_translate`
  - `vocoder_get_translations` → `vocoder_pull`
  - `vocoder_status` → `vocoder_config`
  - `vocoder_project_create` → `vocoder_create_project`

  **Architecture:** `VocoderClient` removed from `@vocoder/mcp`; `createClient()` now returns `VocoderAPI` from `@vocoder/cli/lib`. Shared logic (`buildStringEntries`, `computeSourceEntriesHash`, `extractProjectShortIdFromApiKey`) exported from `@vocoder/cli/lib` as single source of truth.

  **`@vocoder/core`:** adds `extractProjectShortIdFromApiKey` utility.

### Patch Changes

- Updated dependencies
  - @vocoder/cli@0.20.0
  - @vocoder/extractor@0.20.0
  - @vocoder/plugin@0.20.0

## 0.19.0

### Patch Changes

- 438ef8c: Simplify `vocoder init`: write only two files (GitHub Actions workflow + API key to `.env.local`), remove `vocoder.config.ts` generation, rename workflow to `vocoder-translate.yml`, add `on-failure: proceed` input. Remove scaffold, write-config, and mcp-setup modules. MCP setup moved to next-steps output. TUI improvements: consistent spacing across all custom prompts, pre-selected value floated to top in locale selector, brand hex colors replaced with semantic chalk colors.
- Updated dependencies [438ef8c]
  - @vocoder/cli@0.19.0
  - @vocoder/extractor@0.19.0
  - @vocoder/plugin@0.19.0

## 0.18.1

### Patch Changes

- Update repository URL: vocoder-sdk → sdk (github.com/vocoder-i18n/sdk).
- Updated dependencies
  - @vocoder/cli@0.18.1
  - @vocoder/extractor@0.18.1
  - @vocoder/plugin@0.18.1

## 0.18.0

### Minor Changes

- 237c29c: Add `vocoder regenerate-key` CLI command and `vocoder_regenerate_key` MCP tool.
  - `vocoder regenerate-key`: dedicated command to rotate the project API key; requires admin or owner role (403 → friendly message); rewrites all `vocoder.config.ts` files with current appIds
  - `vocoder init`: simplified — when repo is already set up, logs app name and points to `regenerate-key`; no longer offers key rotation inline
  - `vocoder app`: added `--alias project` for backward compatibility; fixed help copy ("starter app" not "starter project")
  - MCP: `vocoder_regenerate_key` tool using stored browser auth; throws with guidance if no stored token
  - MCP: `vocoder://docs/app-config` resource — org→project→app structure, API key placement, appId in `vocoder.config.ts`, key rotation, common setup issues
  - MCP: `vocoder_app_create` tool description and inline instructions now include `apps` array with `appId` per directory
  - MCP: `vocoder_init_status`, `vocoder_init_start`, `vocoder_init_complete`, `vocoder_app_create` tools registered
  - User-facing copy: "project" → "app" throughout CLI prompts, labels, and MCP tool descriptions

### Patch Changes

- Updated dependencies [bbb9642]
- Updated dependencies [237c29c]
  - @vocoder/cli@0.18.0
  - @vocoder/extractor@0.18.0
  - @vocoder/plugin@0.18.0

## 0.17.2

### Patch Changes

- Fix remaining "project" terminology in user-facing strings. Rename CLI `vocoder project` command to `vocoder app` (with `project` kept as alias for backward compatibility). Update log messages, TUI labels, error messages, and MCP tool descriptions to use "app" consistently.
- Updated dependencies
  - @vocoder/cli@0.17.2
  - @vocoder/extractor@0.17.2
  - @vocoder/plugin@0.17.2

## 0.17.1

### Patch Changes

- Rename `vocoder_project_create` → `vocoder_app_create` to match user-facing "app" terminology. Fix `ProjectCreateResult` to include `apps: Array<{ appDir, appId }>` from the actual API response. Update instructions to include ready-to-write `vocoder.config.ts` content with the correct `appId` per app.
  - @vocoder/cli@0.17.1
  - @vocoder/extractor@0.17.1
  - @vocoder/plugin@0.17.1

## 0.17.0

### Minor Changes

- Register init tools: `vocoder_init_status`, `vocoder_init_start`, `vocoder_init_complete`, `vocoder_project_create`. Adds anonymous repo pre-lookup to init_start so existing apps are surfaced before auth. Adds `instructions` to ProjectCreateResult telling the agent exactly what to write to disk after getting the API key.

### Patch Changes

- @vocoder/cli@0.17.0
- @vocoder/extractor@0.17.0
- @vocoder/plugin@0.17.0

## 0.16.6

### Patch Changes

- Add inline quick reference and locale selector guidance to `vocoder_implement_i18n` output. Agents that don't fetch MCP resources now get critical patterns (variable interpolation, plurals, rich text, extractor bail cases) directly in the tool response. Add `phase5_localeSelector` with built-in vs custom decision guidance.
  - @vocoder/cli@0.16.6
  - @vocoder/extractor@0.16.6
  - @vocoder/plugin@0.16.6

## 0.16.5

### Patch Changes

- Migrate user-facing "project" terminology to "app" across CLI and MCP. Renames `ProjectConfig` type to `AppConfig`. Updates all help text, error messages, MCP tool descriptions, and JSDoc comments.
- Updated dependencies
  - @vocoder/cli@0.16.5
  - @vocoder/extractor@0.16.5
  - @vocoder/plugin@0.16.5

## 0.16.4

### Patch Changes

- Updated dependencies
  - @vocoder/cli@0.16.4
  - @vocoder/extractor@0.16.4
  - @vocoder/plugin@0.16.4

## 0.16.3

### Patch Changes

- Updated dependencies
  - @vocoder/cli@0.16.3
  - @vocoder/extractor@0.16.3
  - @vocoder/plugin@0.16.3

## 0.16.2

### Patch Changes

- Updated dependencies
  - @vocoder/cli@0.16.2
  - @vocoder/extractor@0.16.2
  - @vocoder/plugin@0.16.2

## 0.16.1

### Patch Changes

- Updated dependencies
  - @vocoder/cli@0.16.1
  - @vocoder/extractor@0.16.1
  - @vocoder/plugin@0.16.1

## 0.16.0

### Patch Changes

- Provider API improvements and SDK audit fixes
  - `VocoderProvider`: replace `cookies` prop with `initialLocale` and `preview` boolean props — server resolves cookie values and passes them down; provider normalizes initialLocale against available locales automatically
  - Remove `VocoderProviderServer` (RSC cannot provide context; was a no-op)
  - Move `DEFAULT_ORDINAL_ICU`, `buildPluralICU`, `buildSelectICU`, `PLURAL_CLDR`, `ALL_CLDR` to `@vocoder/core` — single source of truth for T.tsx and extractor
  - Add `applyOrdinalForms()` to `@vocoder/core` — shared ordinal suffix/word logic replaces triplicated implementations
  - Fix `context.t()` missing formality support — now uses full `TOptions` consistent with global `t()` and `<T>`
  - Fix `hasTranslation()` to be hash-only — remove hidden dual-mode (hash-or-source-text)
  - Fix preview query param: `syncPreviewQueryParam()` now reads `?vocoder=true|false` as intended
  - `Industry` type replaces `AppIndustry` (deprecated alias kept); adds travel, legal, government, nonprofit, other

- Updated dependencies
  - @vocoder/extractor@0.16.0
  - @vocoder/cli@0.16.0
  - @vocoder/plugin@0.16.0

## 0.15.0

### Minor Changes

- feat: @vocoder/core shared primitives, full test coverage, extractor restructure
  - New `@vocoder/core` package: hash, ICU formatting, cookie utilities, shared types
  - Moved hash, ICU, and cookie utilities from `@vocoder/react` into `@vocoder/core`
  - `VocoderTranslationData` now canonical in core; re-exported from config and plugin
  - Full unit test coverage across all packages (529 tests total)
  - Extractor internals split into shared/icu-builders, shared/roles, shared/transform, parse/react
  - New READMEs for core, config, extractor; updated react and root READMEs
  - Two-tier versioning: tooling packages fixed together, core and react version independently

### Patch Changes

- Updated dependencies
  - @vocoder/cli@0.15.0
  - @vocoder/extractor@0.15.0
  - @vocoder/plugin@0.15.0

## 0.14.1

### Patch Changes

- docs(react): overhaul README for accuracy and completeness

  Corrects outdated component type (was Record<string, ReactElement>), wrong tag
  format examples (<link> → <0>), and wrong sortBy default. Adds full coverage
  of plurals, select, ordinals, format prop, function slots, object component form,
  React elements in values, extractor behavior table, and TypeScript exports.

- Updated dependencies
  - @vocoder/cli@0.14.1
  - @vocoder/extractor@0.14.1
  - @vocoder/plugin@0.14.1

## 0.14.0

### Minor Changes

- feat: Lingui-style numeric component tags, function slots, expression safety

  **Tag format** (`<0>` replaces `<c0>`): Component placeholders in ICU strings now use Lingui-style numeric tags (`<0>`, `<1>`) instead of `<c0>`. The preprocessor normalises these to `<cN>` before ICU parse and restores afterward.

  **Function slots**: `components` prop now accepts render functions alongside React elements. `(children: ReactNode) => ReactNode` enables dynamic wrapper logic without a DOM element.

  **Object form**: `components` accepts `Record<number, ComponentSlot>` — sparse objects useful when skipping indices (`{ 0: <em />, 2: <strong /> }`).

  **React elements in values**: React elements passed via `values` are auto-promoted to self-closing component slots at render time — no manual `components` prop required.

  **Extractor expression safety**:
  - Numeric literals (`{42}`) inline as literal text instead of becoming positional placeholders
  - Boolean and null literals (`{true}`, `{null}`) are skipped — they render nothing
  - Conditional (`{a ? b : c}`) and logical (`{a && b}`) expressions trigger a bail with a warning — use `{cond ? <T>A</T> : <T>B</T>}` instead
  - Nested `<T>` inside `<T>` bails the outer element; the inner T extracts independently

### Patch Changes

- Updated dependencies
  - @vocoder/cli@0.14.0
  - @vocoder/extractor@0.14.0
  - @vocoder/plugin@0.14.0

## 0.13.4

### Patch Changes

- Updated dependencies
  - @vocoder/plugin@0.13.4
  - @vocoder/cli@0.13.4
  - @vocoder/extractor@0.13.4

## 0.13.3

### Patch Changes

- 8d3692e: Bold intro in sync command, highlight branch names and locale codes in sync log output.
- Updated dependencies [8d3692e]
  - @vocoder/cli@0.13.3
  - @vocoder/extractor@0.13.3
  - @vocoder/plugin@0.13.3

## 0.13.2

### Patch Changes

- Updated dependencies
  - @vocoder/cli@0.13.2
  - @vocoder/extractor@0.13.2
  - @vocoder/plugin@0.13.2

## 0.13.1

### Patch Changes

- ec4fa6b: Apply Vocoder brand colors to CLI TUI output. Pink (#D51977) for named values (file paths, locale codes, branch names), blue (#2450A9) for bars and structural elements in custom prompts, orange (#FC5206) for active cursor indicators.
- Updated dependencies [ec4fa6b]
  - @vocoder/cli@0.13.1
  - @vocoder/extractor@0.13.1
  - @vocoder/plugin@0.13.1

## 0.13.0

### Minor Changes

- feat: app-scoped API keys (vca\_) and CLI/MCP renames
  - Plugin requires vca* API keys; hard fail on non-vca* keys
  - CLI: getAppConfig, listApps, lookupAppByRepo, APIAppConfig, create-app command, --app-name flag
  - MCP: SyncBody updated with requestedMaxWaitMs/clientRunId/appIndustry, lookupAppByRepo

### Patch Changes

- Updated dependencies
  - @vocoder/cli@0.13.0
  - @vocoder/plugin@0.13.0
  - @vocoder/extractor@0.13.0

## 0.12.3

### Patch Changes

- Updated dependencies
  - @vocoder/cli@0.12.3
  - @vocoder/extractor@0.12.3
  - @vocoder/plugin@0.12.3

## 0.12.2

### Patch Changes

- Updated dependencies
  - @vocoder/cli@0.12.2
  - @vocoder/extractor@0.12.2
  - @vocoder/plugin@0.12.2

## 0.12.1

### Patch Changes

- Updated dependencies
  - @vocoder/cli@0.12.1
  - @vocoder/extractor@0.12.1
  - @vocoder/plugin@0.12.1

## 0.12.0

### Patch Changes

- Updated dependencies
  - @vocoder/cli@0.12.0
  - @vocoder/extractor@0.12.0
  - @vocoder/plugin@0.12.0

## 0.11.0

### Minor Changes

- feat(mcp): 3-tool init flow, workspace resolution fix, dotenv support
  - Split init into vocoder_init_start / vocoder_init_complete / vocoder_project_create matching CLI order
  - Workspace resolution moved to vocoder_project_create — prevents "already claimed" errors on re-runs
  - Stored auth token check in init_start skips browser flow when already authenticated
  - Install callback organizationId passed through to project_create, skipping workspace lookup
  - Added dotenv/config import so MCP process loads .env automatically
  - cli: removed apiUrl from AuthData (env var is source of truth); exported readAuthData/writeAuthData/clearAuthData from lib

### Patch Changes

- Updated dependencies
  - @vocoder/cli@0.11.0
  - @vocoder/extractor@0.11.0
  - @vocoder/plugin@0.11.0

## 0.10.0

### Patch Changes

- Updated dependencies
  - @vocoder/cli@0.10.0
  - @vocoder/plugin@0.10.0
  - @vocoder/extractor@0.10.0

## 0.8.0

### Minor Changes

- Word-based ordinal support (Arabic, Hebrew), gender-aware ordinal() API, CSS-only LocaleSelector theming, extractor ICU builder exports, ordinalForms replacing ordinalSuffixes, backwards-compat shims removed.

### Patch Changes

- Updated dependencies
  - @vocoder/cli@0.8.0
  - @vocoder/extractor@0.8.0
  - @vocoder/plugin@0.8.0

## 0.7.0

### Patch Changes

- Add suffix-free ordinal API and `ordinal()` function

  `<T value={rank} ordinal />` no longer requires `one`/`two`/`few`/`other` suffix props. The extractor generates canonical English ordinal ICU internally; the pipeline replaces branches with locale-correct patterns from the ordinalSuffixes DB.

  New `ordinal(value)` function available as `useVocoder().ordinal()` (reactive, inside components) and as a named export `import { ordinal } from '@vocoder/react'` (global, outside React).

  Breaking: `<T value={rank} ordinal one="#st" two="#nd" few="#rd" other="#th" />` — suffix props are ignored when `ordinal` is present. Use `<T value={rank} ordinal />`.

- Updated dependencies
  - @vocoder/extractor@0.7.0
  - @vocoder/plugin@0.7.0
  - @vocoder/cli@0.7.0
