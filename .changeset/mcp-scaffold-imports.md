---
"@vocoder/mcp": patch
---

Fix the Next.js App Router scaffold emitting code that does not compile.

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
