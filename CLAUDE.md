# CLAUDE.md - Vocoder SDK

This file provides guidance to Claude Code when working with the Vocoder SDK monorepo.

## 📝 README Synchronization (CRITICAL)

**MANDATORY**: When modifying functionality in any package, you MUST update the corresponding README to reflect the change. READMEs are the primary user-facing documentation for this SDK.

### README Files and Their Scope

| README | Update when... |
|---|---|
| **[README.md](./README.md)** (root) | Adding/removing packages, changing the overall quick start flow, modifying how packages interact, changing the architecture |
| **[packages/react/README.md](./packages/react/README.md)** | Adding/changing components, props, hooks, provider behavior, locale persistence, SSR hydration, background refresh |
| **[packages/unplugin/README.md](./packages/unplugin/README.md)** | Changing bundler setup, virtual module structure, fingerprint computation, branch detection, env vars, offline fallback, build-time constants |
| **[packages/cli/README.md](./packages/cli/README.md)** | Adding/changing CLI commands, flags, sync modes, extraction behavior, git integration |

### README Style Guide

Follow the patterns already established in the READMEs:

- **Document what exists today.** Do not document planned features, migration history, or how things used to work.
- **Lead with usage examples.** Show the code first, explain after.
- **Use tables for props/options/flags.** Keep descriptions to one line.
- **No emojis in READMEs.** Use plain markdown.
- **Keep the root README as a quick start guide.** It should get a new user from zero to working in 5 steps. Detailed API docs belong in the package READMEs.
- **Each package README is self-contained.** A user reading only that README should understand how to install, configure, and use that package.

### When to Update

- After adding, removing, or renaming any user-facing API (component, hook, function, CLI flag, plugin option)
- After changing default behavior or configuration
- After adding or removing environment variables
- After changing how packages interact (e.g., new virtual module, new build-time constant)
- Before marking a task as complete

### Post-Implementation Checklist

- [ ] Affected package README reflects the change
- [ ] Root README still accurate (if cross-package behavior changed)
- [ ] Code examples in READMEs are valid and match current API signatures
- [ ] All tests pass (`pnpm test`)
- [ ] Build succeeds (`pnpm build`)

## 🏗️ Project Structure

This is a pnpm workspace monorepo containing three packages:

```
vocoder-sdk/
├── packages/
│   ├── react/          # @vocoder/react — components, hooks, provider, locale selector
│   ├── unplugin/       # @vocoder/unplugin — build plugin (Vite, Next.js, Webpack, Rollup, esbuild)
│   └── cli/            # @vocoder/cli — project setup, string extraction, translation sync
└── pnpm-workspace.yaml
```

## 🔍 TypeScript Type Safety (CRITICAL - MANDATORY)

**CRITICAL REQUIREMENT**: This SDK uses TypeScript in strict mode. You MUST ensure all type annotations are correct and the build succeeds BEFORE completing ANY implementation.

### Pre-Completion Checklist

**BEFORE marking any task as complete, you MUST:**

1. **Run the build**: `npm run build`
2. **Fix ALL TypeScript errors** - No exceptions
3. **Verify the build completes successfully**
4. **Run tests**: `npm run test`
5. **All tests must pass** - No exceptions

### Common TypeScript Patterns (MANDATORY)

When working with callbacks and array operations, ALWAYS add explicit type annotations:

#### ✅ CORRECT - Explicit Type Annotations

```typescript
// Map callbacks
items.map((item: typeof items[number]) => item.id)

// Filter callbacks
items.filter((item: typeof items[number]) => item.active)

// Array element access (when guaranteed to exist)
const first = items[0]!;

// React component props
const MyComponent: React.FC<MyProps> = ({ children, ...props }) => {
  // ...
}
```

#### ❌ WRONG - Missing Type Annotations

```typescript
// ❌ Implicit any - Will fail build
items.map((item) => item.id)
items.filter((item) => item.active)

// ❌ Missing non-null assertion
const first = items[0];  // Error: possibly undefined
```

## 📦 @vocoder/react Package

### Core Principles

1. **Platform-agnostic** - No framework-specific code (Next.js, Remix, etc.)
2. **Static-first** - Optimize for static JSON imports
3. **Simple API** - Minimal surface area, intuitive usage
4. **Source text as key** - No separate translation IDs
5. **Three phases of complexity**:
   - Phase 1: Simple variable interpolation
   - Phase 2: ICU MessageFormat (pluralization)
   - Phase 3: Rich text with component placeholders

### Component Architecture

#### `<T>` Component

The main translation component. Supports all three phases:

```typescript
interface TProps {
  children: React.ReactNode;      // Source text (also the translation key)
  context?: string;                // Disambiguation context
  formality?: 'formal' | 'informal' | 'auto';
  components?: Record<string, React.ReactElement>; // Phase 3: Component placeholders
  [key: string]: any;             // Variable interpolation values
}
```

**Implementation Details:**
- Uses `extractText()` to convert JSX children to string key
- `extractText()` MUST reconstruct component placeholder tags (e.g., `<link>here</link>`)
- Supports reactive locale switching via `VocoderProvider` context
- Falls back to source text on error or missing translation

#### `VocoderProvider`

React Context provider for managing translation state:

```typescript
interface VocoderProviderProps {
  translations?: Record<string, Record<string, string>>; // Static mode (recommended)
  apiKey?: string;                 // API mode (optional)
  defaultLocale: string;           // Initial locale
  children: React.ReactNode;
}
```

**Locale Priority (in order):**
1. Stored preference (localStorage/sessionStorage)
2. `defaultLocale` prop
3. First available locale in translations

**Important:** Syncs with global state for `t()` function via `_setGlobalLocale()` and `_setGlobalTranslations()`

#### `t()` Function

Global translation function for non-JSX contexts:

```typescript
function t(text: string, values?: Record<string, any>): string
```

**Critical Implementation Detail:**
- Uses global singleton state (NOT React context)
- Synced with `VocoderProvider` state via internal setters
- Supports ICU MessageFormat (Phase 2)
- Does NOT support component placeholders (Phase 3) - use `<T>` component for that

### Three Phases of Variable Handling

#### Phase 1: Simple Interpolation

```typescript
// Component
<T name="John">Hello, {name}!</T>

// Function
t('Hello, {name}!', { name: 'John' })

// Implementation: interpolate() utility
```

#### Phase 2: ICU MessageFormat

```typescript
// Component
<T count={5}>{count, plural, =0 {No items} one {# item} other {# items}}</T>

// Function
t('{count, plural, =0 {No items} one {# item} other {# items}}', { count: 5 })

// Implementation: formatICUMessage() utility using intl-messageformat
```

**Detection:** Check if text matches ICU pattern: `/\{[\w]+,\s*(plural|select|selectordinal|number|date|time)/`

#### Phase 3: Rich Text with Components

```typescript
// Component ONLY (not supported in t() function)
<T components={{ link: <a href="/help" /> }}>
  Click <link>here</link> for help
</T>

// Implementation: parseRichText() utility
```

**Critical Implementation Details:**
- JSX children like `<T>Click <link>here</link></T>` are parsed as React elements
- `extractText()` MUST reconstruct tags: `"Click <link>here</link> for help"`
- `parseRichText()` uses regex to match `<tagName>content</tagName>`
- Uses `React.cloneElement()` to inject content into component placeholders

### Utility Functions

#### `extractText(children: React.ReactNode): string`

Converts JSX children to string representation for translation lookup.

**Critical Requirement:** MUST reconstruct component placeholder tags.

```typescript
// Example behavior:
extractText("Hello world")
// → "Hello world"

extractText(<>Hello {name}</>)
// → "Hello {name}" (variable placeholder preserved)

extractText(<>Click <link>here</link></>)
// → "Click <link>here</link>" (component tags reconstructed)
```

**Implementation:**
- Detect intrinsic elements (lowercase HTML tags) as placeholders
- Reconstruct as `<tagName>content</tagName>` string
- Recursively extract from nested children

#### `interpolate(text: string, values: Record<string, any>): string`

Simple variable replacement:

```typescript
interpolate("Hello {name}!", { name: "John" })
// → "Hello John!"
```

#### `formatICUMessage(text: string, values: Record<string, any>, locale: string): string`

ICU MessageFormat formatting using `intl-messageformat` library.

#### `parseRichText(text: string, components: Record<string, React.ReactElement>): React.ReactNode[]`

Parse text with component placeholders and return React nodes:

```typescript
parseRichText(
  "Click <link>here</link>",
  { link: <a href="/help" /> }
)
// → ["Click ", <a href="/help">here</a>]
```

**Implementation:**
- Regex: `/<(\w+)>(.*?)<\/\1>/g`
- Use `React.cloneElement()` to inject content as children
- Warn if component not provided
- Add keys to avoid React warnings

### Testing Requirements (CRITICAL)

**MANDATORY**: All features MUST have comprehensive test coverage.

#### Test Files Structure

```
src/__tests__/
├── T.test.tsx                    # Phase 1: Basic <T> component
├── icu-messageformat.test.tsx    # Phase 2: Pluralization
├── rich-text.test.tsx            # Phase 3: Component placeholders
├── translate.test.tsx            # t() function
└── VocoderProvider.test.tsx      # Provider context
```

#### Test Coverage Requirements

- ✅ Happy path scenarios
- ✅ Edge cases (missing translations, undefined values)
- ✅ Error handling and fallbacks
- ✅ All three phases of variable handling
- ✅ Locale switching behavior
- ✅ SSR compatibility

**BEFORE marking implementation complete:**
```bash
npm run test -- --run
# All tests must pass
```

### Build Requirements

**TypeScript Configuration:**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "ES2021.Intl", "DOM"],
    "module": "ESNext",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true
  }
}
```

**Critical:** `ES2021.Intl` is required for ICU MessageFormat support.

### Import Source Tracking

When building extraction tools (AST parsing), track imports to ensure we're extracting the correct `T` component:

```typescript
// Track imports from @vocoder/react
const vocoderImports = new Map<string, string>();

ImportDeclaration: (path) => {
  if (path.node.source.value === '@vocoder/react') {
    path.node.specifiers.forEach((spec) => {
      if (spec.type === 'ImportSpecifier' && spec.imported.name === 'T') {
        vocoderImports.set(spec.local.name, 'T');
      }
    });
  }
}

// Only extract if imported from @vocoder/react
if (vocoderImports.get(elementName) === 'T') {
  // Extract translation
}
```

### Platform-Agnostic Design

**DO NOT:**
- ❌ Add framework-specific code (Next.js, Remix, etc.)
- ❌ Add browser-specific detection (navigator.language) in core
- ❌ Add server-specific code (headers) in client components
- ❌ Assume specific bundler or build tool

**DO:**
- ✅ Accept locale via props
- ✅ Provide utilities, let users integrate
- ✅ Keep storage utilities generic (localStorage/sessionStorage with fallbacks)
- ✅ Provide examples for different frameworks in README

## Essential Commands

```bash
# Development
pnpm install          # Install dependencies
pnpm build           # Build all packages
pnpm dev             # Watch mode for development
pnpm test            # Run tests
pnpm test:watch      # Watch mode for tests

# React Package Specific
cd packages/react
npm run build        # Build the React package
npm run test         # Run React tests
npm run test:watch   # Watch mode
```

## Code Style

- Files: `kebab-case.tsx`
- Components: `PascalCase`
- Functions: `camelCase`
- Never use `any` - use `unknown` or proper types
- Always use explicit types for callback parameters
- Use React.FC<Props> for component types

## Common Mistakes to Avoid

### ❌ Not Reconstructing Component Tags in extractText

```typescript
// WRONG - loses component placeholder tags
export function extractText(children: React.ReactNode): string {
  if (React.isValidElement(children)) {
    return extractText(children.props.children); // Missing tag reconstruction!
  }
  // ...
}
```

```typescript
// CORRECT - reconstructs component placeholder tags
export function extractText(children: React.ReactNode): string {
  if (React.isValidElement(children)) {
    const elementType = children.type;
    if (typeof elementType === 'string') {
      const tagName = elementType;
      const content = extractText(children.props.children);
      return `<${tagName}>${content}</${tagName}>`; // ✅ Reconstructed!
    }
    return extractText(children.props.children);
  }
  // ...
}
```

### ❌ Not Syncing Global State with React State

```typescript
// WRONG - t() function will use stale translations
export const VocoderProvider: React.FC<Props> = ({ ... }) => {
  const [locale, setLocale] = useState(initialLocale);
  // Missing: _setGlobalLocale(locale) and _setGlobalTranslations(translations)
}
```

```typescript
// CORRECT - syncs global state for t() function
export const VocoderProvider: React.FC<Props> = ({ ... }) => {
  const [locale, setLocale] = useState(initialLocale);

  useEffect(() => {
    _setGlobalLocale(locale); // ✅ Sync global state
    _setGlobalTranslations(translations); // ✅ Sync translations
  }, [locale, translations]);
}
```

### ❌ Not Checking ICU MessageFormat Before Simple Interpolation

```typescript
// WRONG - ICU patterns get broken by simple interpolation
let result = interpolate(translatedText, values); // Breaks ICU syntax!
if (isICUMessage(result)) {
  result = formatICUMessage(result, values, locale);
}
```

```typescript
// CORRECT - check ICU first
if (isICUMessage(translatedText)) {
  return formatICUMessage(translatedText, values, locale);
}
// Then do simple interpolation
return interpolate(translatedText, values);
```

## Before Committing (MANDATORY CHECKLIST)

**EVERY commit MUST pass all quality checks:**

```bash
# 1. Build check - MUST succeed
npm run build

# 2. Test suite - MUST pass
npm run test

# 3. Type check (if separate)
npm run typecheck || tsc --noEmit
```

### Pre-Commit Checklist

- [ ] ✅ Build succeeds with NO TypeScript errors
- [ ] ✅ All tests pass
- [ ] ✅ README.md is updated with new features
- [ ] ✅ Examples in README work correctly
- [ ] ✅ CLAUDE.md reflects new patterns/requirements
- [ ] ✅ No console.log statements (use proper logging)
- [ ] ✅ No commented-out code blocks

**CRITICAL RULES:**
- ❌ NEVER commit with TypeScript errors
- ❌ NEVER commit with failing tests
- ❌ NEVER commit without updating documentation

## Related Documentation

- [README.md](./README.md) - SDK overview and quick start
- [packages/react/README.md](./packages/react/README.md) - React SDK documentation
- [packages/unplugin/README.md](./packages/unplugin/README.md) - Build plugin documentation
- [packages/cli/README.md](./packages/cli/README.md) - CLI documentation
