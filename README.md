# Vocoder SDK

Vocoder SDK is a two-package i18n stack:

- `@vocoder/cli`: extracts strings and generates locale artifacts.
- `@vocoder/react`: runtime + React bindings that consume those artifacts.

## Packages

| Package | Description |
| --- | --- |
| [`@vocoder/cli`](./packages/cli) | `vocoder sync` + `vocoder wrap` |
| [`@vocoder/react`](./packages/react) | Provider, hooks, `<T>`, and bootstrap helpers |

## Runtime Architecture

`vocoder sync` writes generated files to:

`node_modules/@vocoder/generated`

Output shape:

- `manifest.mjs` (ESM loaders for browser bundlers)
- `manifest.cjs` (CJS loaders for SSR / Node)
- `<locale>.js` per locale
- `package.json` with exports map

`@vocoder/react` loads that manifest, picks the best locale, lazy-loads locale chunks on demand, and falls back to source strings if generated data is missing.

## Quick Start

1. Install packages.

```bash
pnpm add @vocoder/react
pnpm add -D @vocoder/cli
```

2. Add sync to your build flow.

```json
{
  "scripts": {
    "prebuild": "pnpm exec vocoder sync",
    "build": "next build"
  }
}
```

3. Wrap your app with `VocoderProvider` and use `<T>`.

```tsx
import { VocoderProvider, T } from '@vocoder/react';

export function App() {
  return (
    <VocoderProvider>
      <T>Hello, world!</T>
    </VocoderProvider>
  );
}
```

4. For pure client apps (Vite/SPA), initialize before first render.

```tsx
import { initializeVocoder, VocoderProvider } from '@vocoder/react';

await initializeVocoder();
```

## Monorepo Development

From `vocoder-sdk/`:

```bash
pnpm install

# Build/test per package
cd packages/react && pnpm run build && pnpm test
cd packages/cli && pnpm run build && pnpm test
```

## Canonical Docs

- React SDK docs: [`packages/react/README.md`](./packages/react/README.md)
- CLI docs: [`packages/cli/README.md`](./packages/cli/README.md)
