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
import { T } from '@vocoder/react';

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
- Download translations to `.vocoder/locales/*.json`
- Only translate NEW strings (incremental updates are fast!)

## Configuration

The CLI uses environment variables for configuration:

### Required

- **`VOCODER_API_KEY`**: Your Vocoder API key (get from https://vocoder.dev)

### Optional (Development Only)

- **`VOCODER_API_URL`**: Override API endpoint (defaults to `https://api.vocoder.dev`)

### Defaults (Not Configurable)

- **Target locales**: `es`, `fr`, `de`
- **Extraction pattern**: `src/**/*.{tsx,jsx,ts,js}`
- **Output directory**: `.vocoder/locales`
- **Target branches**: `main`, `master`, `production`, `staging`

To customize these defaults, configure them in your Vocoder dashboard.

## Commands

### `vocoder sync`

Extract and translate strings.

```bash
npx vocoder sync [options]
```

**Options:**

- `--branch <name>` - Specify branch name (auto-detected from git)
- `--force` - Translate even if not on a target branch
- `--dry-run` - Show what would be translated without making API calls
- `--verbose` - Show detailed output

**Examples:**

```bash
# Normal usage (auto-detects branch from git)
npx vocoder sync

# Specify branch manually
npx vocoder sync --branch feature/new-ui

# See what would be translated without making API calls
npx vocoder sync --dry-run

# Force translation even if not on a target branch
npx vocoder sync --force

# Verbose output for debugging
npx vocoder sync --verbose
```

## Workflow

### First Run (100 strings)
```bash
$ npx vocoder sync
✓ Detected branch: main
✓ Loaded config for project: abc123
✓ Extracted 100 strings from src/**/*.{tsx,jsx,ts,js}
✓ Submitted to API - Batch ID: batch-xyz
  Found 100 new strings to translate
⏳ Translating to 3 locales (es, fr, de)
  Estimated time: ~30 seconds
✓ Translations complete!
✓ Wrote 3 locale files

✅ Translation complete! (32.4s)
```

### Second Run (Same strings, 0 new)
```bash
$ npx vocoder sync
✓ Detected branch: main
✓ Loaded config for project: abc123
✓ Extracted 100 strings from src/**/*.{tsx,jsx,ts,js}
✓ Submitted to API - Batch ID: batch-abc
  Found 0 new strings to translate

✅ No new strings - using existing translations
✓ Wrote 3 locale files

✅ Translation complete! (0.8s)
```

### Incremental Run (1 new string)
```bash
$ npx vocoder sync
✓ Detected branch: main
✓ Loaded config for project: abc123
✓ Extracted 101 strings from src/**/*.{tsx,jsx,ts,js}
✓ Submitted to API - Batch ID: batch-def
  Found 1 new strings to translate
⏳ Translating to 3 locales (es, fr, de)
  Estimated time: ~1 seconds
✓ Translations complete!
✓ Wrote 3 locale files

✅ Translation complete! (1.2s)
```

## Branch-Scoped Translations

Translations are isolated per git branch:

- **Main branch** translations are shared across the team
- **Feature branches** get their own translations
- Feature branches fall back to main branch translations
- Merge to main to promote feature translations

This allows you to:
- Test translations in feature branches
- Preview translations before merging
- Avoid conflicts between features

## Performance

The CLI is optimized for incremental updates:

| Scenario | Time | Cost |
|----------|------|------|
| 100 new strings | ~30s | 100 strings × 3 locales |
| 0 new strings | <1s | No API calls |
| 1 new string | ~1s | 1 string × 3 locales |

**Speedup: 30x faster** for incremental updates!

## Output

Translations are written to `.vocoder/locales/`:

```
.vocoder/
└── locales/
    ├── es.json
    ├── fr.json
    └── de.json
```

Each file contains a flat key-value mapping:

```json
{
  "Welcome to our app!": "¡Bienvenido a nuestra aplicación!",
  "Hello, {name}!": "¡Hola, {name}!",
  "You have {count} messages": "Tienes {count} mensajes"
}
```

**Add to `.gitignore`:**

```
.vocoder/
```

Translations are generated at build time, not checked into git.

## Integration with React

Use the generated locale files with `@vocoder/react`:

```tsx
import { VocoderProvider } from '@vocoder/react';
import en from './.vocoder/locales/en.json';
import es from './.vocoder/locales/es.json';
import fr from './.vocoder/locales/fr.json';

export default function App({ children }) {
  return (
    <VocoderProvider
      translations={{ en, es, fr }}
      defaultLocale="en"
    >
      {children}
    </VocoderProvider>
  );
}
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

// ✅ Good
<T>Welcome!</T>

// ❌ Bad (not detected)
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
# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Run unit tests only (fast)
pnpm test:unit

# Run integration tests (requires API)
pnpm test:integration

# Watch mode
pnpm test:watch
```

## License

MIT
