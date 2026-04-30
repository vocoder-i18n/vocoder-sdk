# @vocoder/react

React components and hooks for Vocoder internationalization. Provides the `<T>` component for translating JSX, the `t()` function for translating plain strings, and a provider that manages locale state with SSR hydration support.

## Installation

```bash
npm install @vocoder/react
```

Requires React 18+.

## Setup

Wrap your app with `VocoderProvider`:

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

The provider loads translations from virtual modules injected by [`@vocoder/plugin`](../plugin) at build time. If the unplugin is not installed, source text is rendered as-is.

## Translating Strings

### The `<T>` Component

Use `<T>` to mark JSX content for translation:

```tsx
import { T } from '@vocoder/react';

// Simple text
<T>Hello, world!</T>

// Variable interpolation — always use the values prop
<T message="Hello, {name}!" values={{ name: user.name }} />

// ICU MessageFormat (pluralization)
<T message="{count, plural, one {# item} other {# items}}" values={{ count: items.length }} />

// Rich text with component placeholders
<T components={{ link: <a href="/help" /> }}>
  Click <link>here</link> for help
</T>
```

#### Props

| Prop | Type | Description |
|---|---|---|
| `children` | `ReactNode` | Source text (also used as the translation key) |
| `message` | `string` | Alternative to children for ICU strings. Takes precedence over children. |
| `id` | `string` | Optional stable key for extraction/sync identity |
| `context` | `string` | Disambiguation context for identical source text |
| `formality` | `'formal' \| 'informal' \| 'auto'` | Formality level hint for translators |
| `components` | `Record<string, ReactElement>` | Component placeholders for rich text |
| `[key: string]` | `any` | Variable values for interpolation |

### The `t()` Function

Use `t()` for translations outside of JSX (utilities, services, constants):

```ts
import { t } from '@vocoder/react';

// Simple
const greeting = t('Hello, world!');

// Variable interpolation
const message = t('Hello, {name}!', { name: 'John' });

// ICU pluralization
const items = t('{count, plural, one {# item} other {# items}}', { count: 5 });

// With options
const label = t('Save', {}, { context: 'button' });
const formal = t('Hello, {name}!', { name }, { formality: 'formal' });
const byKey = t('', {}, { id: 'welcome_banner' }); // skip hashing, look up by stable key
```

#### Options

| Option | Type | Description |
|---|---|---|
| `context` | `string` | Disambiguation context — must match the `context` prop used on the corresponding `<T>` |
| `formality` | `'formal' \| 'informal' \| 'auto'` | Formality hint for translation |
| `id` | `string` | Stable lookup key — skips hashing the source text entirely |

`t()` uses global state synced by `VocoderProvider`. Make sure the provider is mounted before calling it. Rich text with components is only supported in `<T>`, not in `t()`.

### The `useVocoder` Hook

Access locale state and translation utilities in components:

```tsx
import { useVocoder } from '@vocoder/react';

function MyComponent() {
  const {
    locale,            // Current locale code (e.g., 'es')
    setLocale,         // Switch locale: await setLocale('fr')
    availableLocales,  // Array of available locale codes
    locales,           // Locale metadata (nativeName, dir)
    isReady,           // True when translations are loaded
    t,                 // Raw key → translated string (internal use; prefer the t() export)
    hasTranslation,    // Check if a translation exists
    getDisplayName,    // Get translated locale name
  } = useVocoder();

  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value)}
    >
      {availableLocales.map((code) => (
        <option key={code} value={code}>
          {getDisplayName(code)}
        </option>
      ))}
    </select>
  );
}
```

## Locale Selector

A pre-built locale switcher is available as a separate entry point (to avoid bundling Radix UI unless needed):

```tsx
import { LocaleSelector } from '@vocoder/react/locale-selector';

// Floating selector with position control
<LocaleSelector position="bottom-right" />

// Custom styling
<LocaleSelector
  position="top-right"
  background="#1a1a1a"
  color="#ffffff"
  iconSize={20}
  sortBy="native"
/>
```

Requires `@radix-ui/react-dropdown-menu` and `lucide-react` as optional peer dependencies:

```bash
npm install @radix-ui/react-dropdown-menu lucide-react
```

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `position` | `'top-left' \| 'top-right' \| 'bottom-left' \| 'bottom-right'` | -- | Screen position |
| `background` | `string` | -- | Background color |
| `color` | `string` | -- | Text color |
| `className` | `string` | -- | Additional CSS class |
| `iconSize` | `number` | -- | Globe icon size in pixels |
| `locales` | `LocalesMap` | -- | Override locale metadata |
| `sortBy` | `'source' \| 'native' \| 'translated'` | `'source'` | Sort order for dropdown items |

## Server-Side Rendering

`VocoderProvider` supports SSR with hydration. Pass cookies from the request to enable server-side locale detection:

```tsx
// Next.js App Router
import { cookies } from 'next/headers';

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  return (
    <VocoderProvider cookies={cookieStore.toString()}>
      {children}
    </VocoderProvider>
  );
}
```

The provider injects a `<script type="application/json">` tag with the hydration snapshot so the client can render the correct locale on first paint without a flash of the wrong language.

### Locale Persistence

The user's locale preference is persisted across sessions:
- **Client:** `localStorage` and a `vocoder_locale` cookie
- **Server:** Reads the `vocoder_locale` cookie from the request headers

## SPA Setup (Vite / Client-Only)

For client-only apps, call `initializeVocoder()` before the first render to avoid a flash of untranslated content:

```tsx
import { initializeVocoder, VocoderProvider } from '@vocoder/react';
import { App } from './App';

async function bootstrap() {
  await initializeVocoder();
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <VocoderProvider>
      <App />
    </VocoderProvider>,
  );
}

bootstrap();
```

## Background Refresh

When `@vocoder/plugin` is installed, the build plugin injects metadata into the bundle. After the initial render, the provider checks the Vocoder API for translations newer than the build timestamp. If found, it updates the in-memory translations and re-renders.

This means:
- Initial page load uses translations baked in at build time (fast)
- New translations published after the build appear without redeployment (fresh)

## How Translations Are Loaded

Translations are delivered as virtual modules by `@vocoder/plugin`:

- `virtual:vocoder/manifest` -- project config and per-locale dynamic import loaders
- `virtual:vocoder/translations/{locale}` -- translation map for each locale

Each locale is a separate chunk that the bundler code-splits automatically. Only the active locale is loaded; others are fetched on demand when the user switches languages.

## License

MIT
