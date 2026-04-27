# @vocoder/unplugin

Build plugin for Vocoder that fetches translations at build time and injects them as virtual modules. Works with Vite, Next.js, Webpack, Rollup, and esbuild.

## Installation

```bash
npm install @vocoder/unplugin
```

## Setup

### Vite

```ts
// vite.config.ts
import vocoder from '@vocoder/unplugin/vite';

export default defineConfig({
  plugins: [vocoder()],
});
```

### Next.js

```js
// next.config.js
const { withVocoder } = require('@vocoder/unplugin/next');

module.exports = withVocoder({
  // your Next.js config
});
```

### Webpack

```js
// webpack.config.js
const vocoder = require('@vocoder/unplugin/webpack');

module.exports = {
  plugins: [vocoder()],
};
```

### Rollup

```js
// rollup.config.js
import vocoder from '@vocoder/unplugin/rollup';

export default {
  plugins: [vocoder()],
};
```

### esbuild

```js
import vocoder from '@vocoder/unplugin/esbuild';

await esbuild.build({
  plugins: [vocoder()],
});
```

## How It Works

The plugin runs at build time and does the following:

1. **Detects your repository** by reading CI environment variables (`GITHUB_REPOSITORY`, `VERCEL_GIT_REPO_OWNER` + `VERCEL_GIT_REPO_SLUG`, `CI_PROJECT_PATH`, etc.) or by reading `.git/config` and parsing the origin remote URL into a canonical format (`github:owner/repo`, `gitlab:owner/repo`, etc.).

2. **Detects the commit SHA** from CI environment variables. Known variables checked in order: `VOCODER_COMMIT_SHA`, `GITHUB_SHA`, `VERCEL_GIT_COMMIT_SHA`, `CI_COMMIT_SHA`, `BITBUCKET_COMMIT`, `CIRCLE_SHA1`, `RENDER_GIT_COMMIT`. Falls back to a fuzzy scan of all environment variables whose name contains `sha` or `commit` and whose value is a 40-character hex string. As a last resort, reads the SHA from `.git/refs/heads/<branch>` or `.git/packed-refs`.

3. **Computes a fingerprint** — an opaque 12-character hex string derived from `sha256(repoCanonical + ":" + scopePath + ":" + commitSha)`. The scope path is the relative path from the git root to the current working directory, which supports monorepos.

   If no commit SHA can be detected (e.g. local development with no git history), the plugin falls back to using the branch name as the identifier and logs a warning. In CI, a SHA is always available.

4. **Fetches translations** from the Vocoder API using the fingerprint. The response includes all locales and their translations in a single request.

5. **Creates virtual modules** that the bundler resolves at import time:
   - `virtual:vocoder/manifest` — exports `config` (source locale, target locales, locale metadata) and `loaders` (per-locale dynamic import functions)
   - `virtual:vocoder/translations/{locale}` — exports the translation map for a single locale

6. **Enables background refresh** — injects metadata so `@vocoder/react` can check for newer translations at runtime without blocking the initial page load

## Zero Configuration

The plugin requires no configuration files, API keys, or environment variables. Everything is auto-detected from git.


## Offline Fallback

Translations are cached to `node_modules/.vocoder/cache/` after each successful fetch. If the API is unreachable on a subsequent build, the plugin uses the cached translations. If no cache exists, the build proceeds with empty translations (source text is shown).

## Monorepo Support

In a monorepo, each package can be a separate Vocoder project. The plugin computes the scope path (relative path from git root to `process.cwd()`) and includes it in the fingerprint. Run the plugin from each package's build step and it will fetch the correct translations for that package.

## Environment Variables

| Variable | Description |
|---|---|
| `VOCODER_FINGERPRINT` | Override the computed fingerprint entirely. Useful for Docker builds or environments with no git context and no CI env vars. |
| `VOCODER_COMMIT_SHA` | Override the detected commit SHA. The SHA is then hashed with the repo identity to produce the fingerprint. Use this if your CI sets a non-standard variable name. |
| `VOCODER_API_URL` | Override the Vocoder API base URL. Defaults to `https://vocoder.app`. |

## Build Output

During the build, the plugin logs:

```
[vocoder] github:owner/repo @ a1b2c3d4 -> e5f6a7b8c9d0
[vocoder] Loaded 3 locale(s), 42 translation(s)
```

If no commit SHA could be detected (local dev fallback):

```
[vocoder] Could not detect commit SHA — using branch name for fingerprint (local dev mode).
[vocoder] github:owner/repo @ main (branch) -> a1b2c3d4e5f6
```

If no translations are available yet (before the first `vocoder sync`):

```
[vocoder] No translations available yet -- source text will be shown.
```

## License

MIT
