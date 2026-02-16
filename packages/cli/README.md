# @vocoder/cli

CLI for Vocoder translation workflows.

Commands:

- `vocoder sync`
- `vocoder wrap`

## Install

```bash
pnpm add -D @vocoder/cli
```

## `vocoder sync`

Extracts translatable strings, sends them to Vocoder, then generates runtime artifacts for `@vocoder/react`.

Generated output:

`node_modules/@vocoder/generated`

Includes:

- `manifest.mjs`
- `manifest.cjs`
- `<locale>.js` files
- `package.json` exports map

### Typical usage

```bash
pnpm exec vocoder sync
```

Add to build pipeline:

```json
{
  "scripts": {
    "prebuild": "pnpm exec vocoder sync",
    "build": "next build"
  }
}
```

### Options

- `--include <pattern>` (repeatable)
- `--exclude <pattern>` (repeatable)
- `--branch <name>`
- `--force`
- `--dry-run`
- `--verbose`

## `vocoder wrap`

Scans source files and wraps likely user-facing strings with `<T>` / `t()` patterns.

```bash
pnpm exec vocoder wrap
```

Options:

- `--include <pattern>` (repeatable)
- `--exclude <pattern>` (repeatable)
- `--dry-run`
- `--interactive`
- `--confidence <high|medium|low>`
- `--verbose`

## Configuration

Config priority:

1. CLI flags
2. `vocoder.config.{js,ts,mjs,cjs,json}`
3. environment variables
4. defaults

### Config file

```ts
// vocoder.config.ts
export default {
  include: ['src/**/*.{tsx,jsx,ts,js}'],
  exclude: ['**/*.test.*', '**/__tests__/**'],
  apiKey: process.env.VOCODER_API_KEY,
  apiUrl: 'https://vocoder.app',
};
```

### Environment variables

```bash
VOCODER_API_KEY=vc_xxx
VOCODER_API_URL=https://vocoder.app
VOCODER_EXTRACTION_PATTERN=src/**/*.{tsx,jsx,ts,js}
```

`VOCODER_API_KEY` can come from either environment or config file.

## Troubleshooting

### `VOCODER_API_KEY is required`

Set `VOCODER_API_KEY` in `.env` or `vocoder.config.*`.

### No strings found

Use `<T>` (from `@vocoder/react`) around translatable JSX text.

### Wrong branch / skipped sync

Use:

```bash
pnpm exec vocoder sync --branch main
```

or force:

```bash
pnpm exec vocoder sync --force
```
