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

1. **Detects your repository** by reading `.git/config` and parsing the origin remote URL into a canonical format (`github:owner/repo`, `gitlab:owner/repo`, etc.)

2. **Detects the branch** from CI environment variables or `.git/HEAD`. Supported CI providers: GitHub Actions, Vercel, Netlify, Cloudflare Pages, GitLab CI, Bitbucket Pipelines, CircleCI, Render.

3. **Computes a fingerprint** -- an opaque 12-character hex string derived from `sha256(repoCanonical + ":" + scopePath + ":" + branch)`. The scope path is the relative path from the git root to the current working directory, which supports monorepos.

4. **Fetches translations** from the Vocoder API using the fingerprint. The response includes all locales and their translations in a single request.

5. **Creates virtual modules** that the bundler resolves at import time:
   - `virtual:vocoder/manifest` -- exports `config` (source locale, target locales, locale metadata) and `loaders` (per-locale dynamic import functions)
   - `virtual:vocoder/translations/{locale}` -- exports the translation map for a single locale

6. **Enables background refresh** -- injects metadata so `@vocoder/react` can check for newer translations at runtime without blocking the initial page load

## Zero Configuration

The plugin requires no configuration files, API keys, or environment variables. Everything is auto-detected from git.


## Offline Fallback

Translations are cached to `node_modules/.vocoder/cache/` after each successful fetch. If the API is unreachable on a subsequent build, the plugin uses the cached translations. If no cache exists, the build proceeds with empty translations (source text is shown).

## Monorepo Support

In a monorepo, each package can be a separate Vocoder project. The plugin computes the scope path (relative path from git root to `process.cwd()`) and includes it in the fingerprint. Run the plugin from each package's build step and it will fetch the correct translations for that package.

## Build Output

During the build, the plugin logs:

```
[vocoder] github:owner/repo @ main -> a1b2c3d4e5f6
[vocoder] Loaded 3 locale(s), 42 translation(s)
```

If no translations are available yet (before the first `vocoder sync`):

```
[vocoder] No translations available yet -- source text will be shown.
```

## License

MIT
