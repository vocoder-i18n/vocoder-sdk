# Vocoder SDK

**Build-time internationalization (i18n) toolkit for React, Vue, Svelte, and native platforms**

> ⚠️ **Early Development:** Currently in MVP phase with React-only support.

---

## 📦 Packages

| Package | Version | Description |
|---------|---------|-------------|
| [`@vocoder/react`](./packages/react) | 0.1.1 | React components & hooks for i18n with SSR support |
| [`@vocoder/cli`](./packages/cli) | 0.1.2 | CLI tool for string extraction and translation sync |
| [`@vocoder/types`](./packages/types) | 0.1.1 | Shared TypeScript types |
| [`@vocoder/kit`](./packages/kit) | 0.1.0 | Core utilities |

---

## 🚀 Quick Start

### Installation

```bash
# Install React SDK
npm install @vocoder/react

# Install CLI tool (for build-time translation)
npm install -D @vocoder/cli
```

### Basic Usage

```tsx
import { VocoderProvider, T } from '@vocoder/react'
import { translations, locales } from './.vocoder/locales'

// 1. Wrap your app with VocoderProvider
export default function App() {
  return (
    <VocoderProvider translations={translations} locales={locales}>
      <YourApp />
    </VocoderProvider>
  )
}

// 2. Use T component for translatable strings
function Welcome({ userName }: { userName: string }) {
  return (
    <div>
      {/* Simple interpolation */}
      <T userName={userName}>Welcome, {userName}!</T>
      
      {/* ICU MessageFormat (plurals) */}
      <T msg="{count, plural, one {# item} other {# items}}" count={5} />
      
      {/* Rich text with components */}
      <T 
        msg="Click <link>here</link> for help"
        components={{ link: <a href="/help" /> }}
      />
    </div>
  )
}
```

### Build-Time Translation

```bash
# In your package.json
{
  "scripts": {
    "build": "vocoder sync && next build"
  }
}

# Run build (extracts strings, translates, then builds)
npm run build
```

---

## 📚 Documentation

### Publishing Guides
- [PUBLISHING.md](./PUBLISHING.md) - **Complete guide** to building and publishing packages
- [PUBLISHING_QUICK_REFERENCE.md](./PUBLISHING_QUICK_REFERENCE.md) - Quick commands cheat sheet
- [FIRST_TIME_PUBLISHING.md](./FIRST_TIME_PUBLISHING.md) - Step-by-step first-time guide
- [PUBLISHING_FLOWCHART.md](./PUBLISHING_FLOWCHART.md) - Visual workflow diagrams
- [PUBLISHING_TROUBLESHOOTING.md](./PUBLISHING_TROUBLESHOOTING.md) - Common issues and solutions

### Architecture Docs (in vocoder-app)

- [VOCODER_I18N_ARCHITECTURE.md](../vocoder-app/docs/VOCODER_I18N_ARCHITECTURE.md) - Complete system architecture
- [LANGUAGE_AND_LOCALE.md](../vocoder-app/docs/LANGUAGE_AND_LOCALE.md) - Language vs Locale concepts
- [ADDING_NEW_LANGUAGES_AND_LOCALES.md](../vocoder-app/docs/ADDING_NEW_LANGUAGES_AND_LOCALES.md) - Adding language support

---

## 🛠️ Development

### Setup

```bash
# Clone repository
git clone https://github.com/vocoder/vocoder-sdk.git
cd vocoder-sdk

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Watch Mode

```bash
# Watch all packages
pnpm watch:all

# Watch specific package
pnpm watch:react
pnpm watch:cli
```

### Testing

```bash
# Run all tests
pnpm test

# Test specific package
cd packages/react
pnpm test

# Watch mode
pnpm test:watch
```

### Local Development with vocoder-consumer

```bash
# Terminal 1: Watch SDK packages
cd vocoder-sdk
pnpm watch:all

# Terminal 2: Link SDK and run consumer app
cd vocoder-consumer
npm run sdk:link      # Link to local SDK
npm run dev

# When done testing published version:
npm run sdk:unlink    # Switch back to npm packages
```

**See vocoder-consumer/SDK_LINKING.md for complete linking guide**

---

## 🏗️ Monorepo Structure

```
vocoder-sdk/
├── packages/
│   ├── cli/              # @vocoder/cli - Command-line tool
│   │   ├── src/
│   │   │   ├── commands/     # CLI commands (sync, etc.)
│   │   │   ├── utils/        # Extraction, API client
│   │   │   └── __tests__/    # Tests
│   │   ├── package.json
│   │   └── tsup.config.ts
│   │
│   ├── react/            # @vocoder/react - React SDK
│   │   ├── src/
│   │   │   ├── VocoderProvider.tsx
│   │   │   ├── T.tsx
│   │   │   ├── utils/        # ICU formatting, interpolation
│   │   │   └── __tests__/    # Tests
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── types/            # @vocoder/types - Shared types
│   │   ├── src/
│   │   └── package.json
│   │
│   └── kit/              # @vocoder/kit - Core utilities
│       ├── src/
│       └── package.json
│
├── package.json          # Root workspace config
├── turbo.json            # Turborepo config
├── pnpm-workspace.yaml   # pnpm workspace config
├── PUBLISHING.md         # Publishing guide
└── README.md             # This file
```

---

## 📋 Commands

### Workspace Commands (from root)

```bash
pnpm install                    # Install all dependencies
pnpm build                      # Build all packages (Turbo)
pnpm dev                        # Dev mode all packages
pnpm test                       # Test all packages
pnpm lint                       # Lint all packages
pnpm clean                      # Clean all dist folders
pnpm clean:all                  # Nuclear clean (removes node_modules)
```

### Package-Specific Commands

```bash
# Build specific package
pnpm --filter @vocoder/react build

# Test specific package
pnpm --filter @vocoder/cli test

# All packages recursive
pnpm -r build
pnpm -r test
```

### Publishing Commands

```bash
pnpm changeset                  # Create changeset
pnpm changeset version          # Bump versions
pnpm release                    # Publish to npm
```

---

## 🤝 Contributing

### Before Committing

```bash
# Ensure everything works
pnpm test
pnpm build
pnpm lint
```

### Adding a New Feature

1. Create feature branch
2. Make changes
3. Add tests
4. Run `pnpm test` and `pnpm build`
5. Create changeset: `pnpm changeset`
6. Commit and push
7. Create pull request

### Publishing Process

See [PUBLISHING.md](./PUBLISHING.md) for the complete publishing workflow.

---

## 📖 Package Documentation

### @vocoder/react

React SDK with SSR support, ICU MessageFormat, and rich text interpolation.

**Install:**
```bash
npm install @vocoder/react
```

**Features:**
- ✅ Server-side rendering (SSR)
- ✅ ICU MessageFormat (plurals, select, number/date formatting)
- ✅ Rich text with React components
- ✅ TypeScript support
- ✅ Locale switcher component

### @vocoder/cli

CLI tool for extracting strings and syncing translations.

**Install:**
```bash
npm install -g @vocoder/cli
# or
npm install -D @vocoder/cli
```

**Features:**
- ✅ Babel-based AST extraction
- ✅ Build-time translation sync
- ✅ Branch-scoped translations
- ✅ Diffing (only translate new strings)
- ✅ Polling until translations complete

**Commands:**
```bash
vocoder sync              # Extract and translate strings
vocoder sync --help       # Show all options
```

---

## 🐛 Issues & Support

- **GitHub Issues:** [vocoder-sdk/issues](https://github.com/vocoder/vocoder-sdk/issues)
- **Email:** admin@vocoder.app
- **Documentation:** [vocoder.app/docs](https://vocoder.app/docs)

---

## 📄 License

MIT © Vocoder

---

## 🗺️ Roadmap

- [x] React SDK with SSR
- [x] CLI extraction tool
- [x] ICU MessageFormat support
- [x] `msg` prop for cleaner syntax
- [ ] Optional ID system
- [ ] Vue support
- [ ] Svelte support
- [ ] iOS code generation
- [ ] Android code generation
- [ ] Translation memory

---

For complete publishing instructions, see [PUBLISHING.md](./PUBLISHING.md).
