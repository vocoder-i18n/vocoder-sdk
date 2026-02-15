# @vocoder/cli

CLI tool for the Vocoder translation workflow. Extract translatable strings from your React code and get them translated automatically.

## Installation

```bash
npm install -D @vocoder/cli
# or
pnpm add -D @vocoder/cli
# or
yarn add -D @vocoder/cli
```

## Quick Start

1. **Set up environment variables** (create `.env` in your project root):

```bash
VOCODER_API_KEY=your-api-key-here
```

2. **Add to your build script**:

```json
{
  "scripts": {
    "prebuild": "vocoder sync",
    "build": "next build"
  }
}
```

3. **Use `<T>` components in your code**:

```tsx
import { VocoderProvider, T } from '@vocoder/react';

function App({ children }) {
  return (
    <VocoderProvider defaultLocale="en">
      {children}
    </VocoderProvider>
  );
}

function MyComponent() {
  return (
    <div>
      <T>Welcome to our app!</T>
      <T name={userName}>Hello, {name}!</T>
    </div>
  );
}
```

4. **Run the CLI**:

```bash
npx vocoder sync
```

This will:
- Extract all `<T>` components from your code
- Submit them to Vocoder for translation
- Write translations to `node_modules/.vocoder/` (loaded automatically by `@vocoder/react`)
- Only translate NEW strings (incremental updates are fast!)

**No manual imports needed.** `@vocoder/react` automatically loads the generated translations.

## Configuration

Configure the CLI using one of three methods (in priority order):

### 1. CLI Flags (Highest Priority)

Override extraction patterns on a per-run basis:

```bash
npx vocoder sync --include="src/**/*.tsx" --exclude="**/*.test.tsx"
```

### 2. Config File (Recommended)

Create `vocoder.config.js` (or `.ts`, `.mjs`, `.cjs`, `.json`) in your project root:

```javascript
// vocoder.config.js
module.exports = {
  // Glob pattern(s) for files to extract from
  include: [
    'src/**/*.{tsx,jsx,ts,js}',
    'components/**/*.tsx',
  ],

  // Glob pattern(s) for files to exclude
  exclude: [
    '**/*.test.{tsx,ts}',
    '**/__tests__/**',
    '**/*.stories.tsx',
  ],
};
```

**TypeScript config:**

```typescript
// vocoder.config.ts
import type { VocoderConfigFile } from '@vocoder/cli';

const config: VocoderConfigFile = {
  include: 'src/**/*.tsx',
  exclude: '**/*.test.tsx',
};

export default config;
```

The CLI searches up the directory tree for the config file, so it works in monorepos.

### 3. Environment Variables

Set environment variables in `.env`:

```bash
# Required
VOCODER_API_KEY=your-api-key-here

# Optional
VOCODER_API_URL=https://vocoder.app
VOCODER_EXTRACTION_PATTERN=src/**/*.{tsx,jsx,ts,js}
```

### Configuration Priority

Settings are merged with this priority:

1. **CLI flags** (highest priority)
2. **Config file** (`vocoder.config.{js,ts,mjs,cjs,json}`)
3. **Environment variables**
4. **Defaults** (lowest priority)

### Default Values

- **Extraction pattern**: `src/**/*.{tsx,jsx,ts,js}`
- **Exclude patterns**: None (but always ignores `node_modules`, `.next`, `dist`, `build`)
- **API URL**: `https://vocoder.app`

**Note:** Target locales and branches are configured in your Vocoder dashboard, not in the CLI.

## Commands

### `vocoder sync`

Extract and translate strings.

```bash
npx vocoder sync [options]
```

**Options:**

- `--include <pattern>` - Glob pattern to include (can be used multiple times)
- `--exclude <pattern>` - Glob pattern to exclude (can be used multiple times)
- `--branch <name>` - Specify branch name (auto-detected from git)
- `--force` - Translate even if not on a target branch
- `--dry-run` - Show what would be translated without making API calls
- `--verbose` - Show detailed output and config sources

**Examples:**

```bash
# Normal usage (uses config file or defaults)
npx vocoder sync

# Override extraction patterns
npx vocoder sync --include="src/**/*.tsx" --include="components/**/*.tsx"

# Exclude test files
npx vocoder sync --exclude="**/*.test.tsx" --exclude="**/*.stories.tsx"

# See what would be translated without making API calls
npx vocoder sync --dry-run

# Force translation even if not on a target branch
npx vocoder sync --force

# Verbose output shows which config sources are used
npx vocoder sync --verbose
```

## How It Works

Translations are written to `node_modules/.vocoder/` — similar to how Prisma generates its client.

`@vocoder/react` automatically loads translations from this location. **No manual imports or prop wiring needed.**

```
npx vocoder sync
  ↓
1. Extract <T> strings from your code
2. Send to Vocoder API for translation
3. Write translations to node_modules/.vocoder/
  ↓
@vocoder/react loads them automatically
```

Since `node_modules/.vocoder/` is regenerated on every sync, add `vocoder sync` to your build pipeline:

```json
{
  "scripts": {
    "prebuild": "vocoder sync",
    "build": "next build"
  }
}
```

## Integration with React

After running `vocoder sync`, just use `@vocoder/react` — translations are loaded automatically:

```tsx
import { VocoderProvider, T, useVocoder } from '@vocoder/react';

// In your root layout
export default function RootLayout({ children }) {
  return (
    <VocoderProvider defaultLocale="en">
      {children}
    </VocoderProvider>
  );
}

// In any component
function Greeting({ name }) {
  return <T name={name}>Hello, {name}!</T>;
}
```

**Advanced:** You can still pass translations as props for testing or custom setups:

```tsx
<VocoderProvider translations={myCustomTranslations} defaultLocale="en">
```

## Troubleshooting

### "VOCODER_API_KEY is required"

Create a `.env` file in your project root:

```bash
VOCODER_API_KEY=your-api-key
```

### "No translatable strings found"

Make sure you're using `<T>` components from `@vocoder/react`:

```tsx
import { T } from '@vocoder/react';

// Good
<T>Welcome!</T>

// Bad (not detected)
<span>Welcome!</span>
```

### "Not a git repository"

The CLI auto-detects the branch from git. Either:
- Initialize git: `git init`
- Specify branch manually: `vocoder sync --branch main`

### "Skipping translations (not a target branch)"

The CLI only runs on target branches (`main`, `master`, `production`, `staging`) by default. Either:
- Merge to a target branch
- Use `--force` flag: `vocoder sync --force`

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm test:unit
pnpm test:watch
```

## License

MIT
