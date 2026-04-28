# Vocoder SDK

Vocoder is an internationalization (i18n) platform that extracts translatable strings from your source code, translates them, and delivers translations to your app at build time. No manual JSON files, no key management.

## How It Works

1. **Wrap strings** in your React components with `<T>` or `t()`
2. **Push to git** -- Vocoder extracts strings and translates them server-side
3. **Build your app** -- the build plugin fetches translations and injects them as virtual modules, code-split per locale

Your app ships with translations baked in. No runtime API calls needed for initial page load. A background refresh mechanism keeps translations up to date between deployments.

## Packages

| Package | Description |
|---|---|
| [`@vocoder/react`](./packages/react) | React components and hooks for rendering translations |
| [`@vocoder/unplugin`](./packages/unplugin) | Build plugin that injects translations at build time (Vite, Next.js, Webpack, Rollup, esbuild) |
| [`@vocoder/cli`](./packages/cli) | CLI for project setup and automatic string wrapping |

## Quick Start

### 1. Initialize your project

```bash
npx @vocoder/cli init
```

This connects your repository to Vocoder. No config files or API keys are needed in your codebase -- the build plugin auto-detects your git repository and branch.

### 2. Add the build plugin

**Vite:**

```ts
// vite.config.ts
import vocoder from '@vocoder/unplugin/vite';

export default defineConfig({
  plugins: [vocoder()],
});
```

**Next.js:**

```js
// next.config.js
const { withVocoder } = require('@vocoder/unplugin/next');

module.exports = withVocoder({
  // your Next.js config
});
```

### 3. Wrap your React app with the provider

```tsx
import { VocoderProvider } from '@vocoder/react';

function App() {
  return (
    <VocoderProvider>
      {/* your app */}
    </VocoderProvider>
  );
}
```

### 4. Mark strings for translation

```tsx
import { T, t } from '@vocoder/react';

// In JSX
<T>Hello, world!</T>

// With variables
<T name={user.name}>Hello, {name}!</T>

// Outside JSX
const message = t('Hello, world!');
```

Or auto-wrap existing strings:

```bash
npx @vocoder/cli sync
```

### 5. Push to git

When you push, Vocoder automatically extracts strings and translates them. On the next build, the unplugin fetches the translations and injects them into your bundle.

## Architecture

```
Your Code                    Server Side                    Build Time
---------                    -----------                    ----------
<T>Hello</T>  --> git push --> webhook extracts    unplugin --> virtual modules
t('Hello')                     strings & translates (fetches)    (code-split per locale)
                                                                     |
                                                               Background refresh
                                                               (checks for updates)
```

The build plugin reads your `.git/config` to identify the repository and `.git/HEAD` for the branch, then computes an opaque fingerprint. This fingerprint is used to fetch translations from the API -- your branch name never appears in network requests.

## Monorepo Support

Vocoder supports monorepos out of the box. Each package within a monorepo can be its own Vocoder project. The build plugin computes a scope path (the relative path from the git root to your package) and includes it in the fingerprint, so translations are scoped correctly.

## Development

This is a pnpm workspace monorepo.

```bash
pnpm install        # Install dependencies
pnpm build          # Build all packages
pnpm dev            # Watch mode for all packages
pnpm test           # Run tests across all packages
```

## License

MIT
