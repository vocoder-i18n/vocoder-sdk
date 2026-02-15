# @vocoder/react

React components for the Vocoder i18n SDK.

## Installation

```bash
npm install @vocoder/react
# or
pnpm add @vocoder/react
# or
yarn add @vocoder/react
```

## Quick Start

### 1. Static Mode (Recommended)

Import your translation files and pass them to the provider:

```tsx
import { VocoderProvider, T, LocaleSelector } from '@vocoder/react';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';

function App() {
  return (
    <VocoderProvider
      translations={{ en, es, fr }}
      defaultLocale="en"
    >
      <LocaleSelector />

      {/* Phase 1: Simple variable interpolation */}
      <T>Welcome to our app!</T>
      <T name="John">Hello, {name}!</T>

      {/* Phase 2: ICU MessageFormat (pluralization) */}
      <T count={5}>{count, plural, =0 {No items} one {# item} other {# items}}</T>

      {/* Phase 3: Rich text with component placeholders */}
      <T components={{ link: <a href="/help" className="text-blue-500" /> }}>
        Click <link>here</link> for help
      </T>
    </VocoderProvider>
  );
}
```

Translation files (`locales/en.json`):
```json
{
  "Welcome to our app!": "Welcome to our app!",
  "Hello, {name}!": "Hello, {name}!",
  "{count, plural, =0 {No items} one {# item} other {# items}}": "{count, plural, =0 {No items} one {# item} other {# items}}",
  "Click <link>here</link> for help": "Click <link>here</link> for help"
}
```

Translation files (`locales/es.json`):
```json
{
  "Welcome to our app!": "¡Bienvenido a nuestra aplicación!",
  "Hello, {name}!": "¡Hola, {name}!",
  "{count, plural, =0 {No items} one {# item} other {# items}}": "{count, plural, =0 {Sin artículos} one {# artículo} other {# artículos}}",
  "Click <link>here</link> for help": "Haz clic <link>aquí</link> para obtener ayuda"
}
```

## API Reference

### `t(text, values?)` / `translate(text, values?)`

Function for translating text outside JSX contexts (utilities, services, etc.)

**Supports:** Phase 1 (simple interpolation) and Phase 2 (ICU MessageFormat)

**Parameters:**
- `text`: Source text to translate
- `values?`: Optional object for variable interpolation or ICU values

**Returns:** Translated string

**Phase 1 Examples: Simple Interpolation**
```tsx
import { t } from '@vocoder/react';

// In utility functions
const message = t('Hello, world!');

// With variables
const greeting = t('Hello, {name}!', { name: 'John' });

// In toast notifications
toast.success(t('Saved successfully'));

// In form validation
const errors = {
  email: t('Invalid email address'),
  password: t('Password must be at least {min} characters', { min: 8 })
};

// In image alt text
<img src={avatar} alt={t('Profile picture')} />

// In array/object literals
const options = [
  { label: t('Option 1'), value: 1 },
  { label: t('Option 2'), value: 2 },
];
```

**Phase 2 Examples: ICU MessageFormat**
```tsx
import { t } from '@vocoder/react';

// Pluralization
const itemsText = t('{count, plural, =0 {No items} one {# item} other {# items}}', { count: 5 });
// Result: "5 items"

// In notification messages
const message = t(
  '{count, plural, =0 {No new messages} one {You have # new message} other {You have # new messages}}',
  { count: unreadCount }
);

// Select (for status, gender, etc.)
const status = t(
  '{status, select, pending {Waiting} approved {Approved} rejected {Rejected} other {Unknown}}',
  { status: 'approved' }
);

// In button labels
const buttonLabel = t(
  '{count, plural, =0 {Add item} one {Remove item} other {Remove # items}}',
  { count: selectedCount }
);
```

**Notes:**
- Uses global state synced by `VocoderProvider`
- Make sure `VocoderProvider` is mounted before using
- For reactive translations in components, prefer `<T>` component
- Supports Phase 1 (simple interpolation) and Phase 2 (ICU MessageFormat)
- **Does NOT support Phase 3** (component placeholders) - use `<T>` component for rich text
- Supports Phase 1 (simple interpolation) and Phase 2 (ICU MessageFormat)
- **Does NOT support Phase 3** (component placeholders) - use `<T>` component for rich text

### `<T>`

The main translation component. Marks text as translatable in JSX.

**Props:**
- `children`: Source text to translate (also used as the translation key)
- `context?`: Optional context for disambiguation
- `formality?`: Optional formality level ('formal' | 'informal' | 'auto')
- `components?`: Component map for rich text placeholders (Phase 3)
- `...values`: Additional props for variable interpolation

**Phase 1: Simple Variable Interpolation**
```tsx
// Simple translation
<T>Hello, world!</T>

// With variables
<T name="Alice" count={3}>
  Hello {name}, you have {count} items
</T>

// With context (for disambiguation)
<T context="navigation">Home</T>
<T context="building">Home</T>
```

**Phase 2: ICU MessageFormat (Pluralization)**

ICU MessageFormat provides powerful pluralization and formatting:

```tsx
// Basic pluralization
<T count={0}>
  {count, plural, =0 {No items} one {# item} other {# items}}
</T>
// Result: "No items"

<T count={1}>
  {count, plural, =0 {No items} one {# item} other {# items}}
</T>
// Result: "1 item"

<T count={5}>
  {count, plural, =0 {No items} one {# item} other {# items}}
</T>
// Result: "5 items"

// Select (gender, status, etc.)
<T gender="female">
  {gender, select, male {He} female {She} other {They}} replied
</T>
// Result: "She replied"

// Complex messages
<T count={42}>
  {count, plural, =0 {No messages} one {You have # message} other {You have # messages}}
</T>
// Result: "You have 42 messages"
```

**Supported ICU Syntax:**
- `{var, plural, ...}` - Pluralization (zero, one, two, few, many, other)
- `{var, select, ...}` - Select from options
- `{var, selectordinal, ...}` - Ordinal numbers (1st, 2nd, 3rd)
- `{var, number}` - Number formatting
- `{var, date}` - Date formatting
- `{var, time}` - Time formatting

**Phase 3: Rich Text with Component Placeholders**

Embed React components in your translations:

```tsx
// Single component
<T components={{ link: <a href="/help" className="text-blue-500 underline" /> }}>
  Click <link>here</link> for help
</T>
// Result: Click <a href="/help" class="text-blue-500 underline">here</a> for help

// Multiple components
<T components={{
  privacy: <a href="/privacy" />,
  terms: <a href="/terms" />
}}>
  Read our <privacy>Privacy Policy</privacy> and <terms>Terms of Service</terms>
</T>

// With styled components
<T components={{ bold: <strong className="font-bold" /> }}>
  Visit <bold>our website</bold> to learn more
</T>

// Email links
<T components={{ email: <a href="mailto:support@example.com" className="email-link" /> }}>
  Contact <email>support@example.com</email> for assistance
</T>
```

**How Component Placeholders Work:**
1. Define components in the `components` prop as a map
2. Use XML-style tags in your text: `<tagName>content</tagName>`
3. The content between tags becomes the children of your component
4. Translation files preserve the same tag structure

**Important Notes:**
- Component placeholders are NOT supported in the `t()` function (JSX only)
- Tag names must match keys in the `components` prop
- Tags are case-sensitive
- If a component is not provided, text falls back to plain text with a warning

### `<VocoderProvider>`

Manages translation state and locale switching.

**Props:**
- `translations?`: Static translations object (key-value pairs per locale)
- `defaultLocale`: Default locale to use (default: 'en')
- `children`: React children

**Example:**
```tsx
<VocoderProvider
  translations={{ en, es, fr }}
  defaultLocale="en"
>
  {/* Your app */}
</VocoderProvider>
```

### `<LocaleSelector>`

Dropdown for switching languages.

**Props:**
- `className?`: CSS class name
- `placeholder?`: Placeholder text (default: 'Select language')

**Example:**
```tsx
<LocaleSelector className="my-locale-selector" />
```

### `useVocoder()`

Hook to access translation context.

**Returns:**
- `locale`: Current locale
- `setLocale(locale: string)`: Function to change locale
- `t(text: string)`: Translation lookup function
- `availableLocales`: Array of available locales
- `isLoading`: Loading state
- `error`: Error message (if any)

**Example:**
```tsx
function MyComponent() {
  const { locale, setLocale, t, availableLocales } = useVocoder();

  return (
    <div>
      <p>Current locale: {locale}</p>
      <p>{t('Hello, world!')}</p>
      <button onClick={() => setLocale('es')}>
        Switch to Spanish
      </button>
    </div>
  );
}
```

## Three Phases of Complexity

Vocoder supports three levels of translation complexity:

| Phase | Feature | `<T>` Component | `t()` Function | Use Case |
|-------|---------|-----------------|----------------|----------|
| **Phase 1** | Simple variables | ✅ Yes | ✅ Yes | Basic text with variable replacement |
| **Phase 2** | ICU MessageFormat | ✅ Yes | ✅ Yes | Pluralization, select, number/date formatting |
| **Phase 3** | Component placeholders | ✅ Yes | ❌ No | Rich text with links, bold, styled elements |

### Quick Reference

**Phase 1: Simple Variable Interpolation**
```tsx
// Component
<T name="John">Hello, {name}!</T>

// Function
t('Hello, {name}!', { name: 'John' })

// Translation file
{ "Hello, {name}!": "¡Hola, {name}!" }
```

**Phase 2: ICU MessageFormat**
```tsx
// Component
<T count={5}>{count, plural, one {# item} other {# items}}</T>

// Function
t('{count, plural, one {# item} other {# items}}', { count: 5 })

// Translation file
{
  "{count, plural, one {# item} other {# items}}": "{count, plural, one {# artículo} other {# artículos}}"
}
```

**Phase 3: Rich Text with Components**
```tsx
// Component ONLY (not supported in t() function)
<T components={{ link: <a href="/help" /> }}>
  Click <link>here</link> for help
</T>

// Translation file
{
  "Click <link>here</link> for help": "Haz clic <link>aquí</link> para obtener ayuda"
}
```

## Platform-Agnostic Locale Detection

Vocoder is framework-agnostic. You can detect locale from any source and pass it via `defaultLocale`:

### Next.js - From Request Headers

```tsx
import { headers } from 'next/headers';
import { VocoderProvider } from '@vocoder/react';

export default async function RootLayout({ children }) {
  const headersList = await headers();
  const acceptLang = headersList.get('accept-language');
  const locale = acceptLang?.split(',')[0]?.split('-')[0] ?? 'en';

  return (
    <VocoderProvider
      translations={{ en, es, fr }}
      defaultLocale={locale}
    >
      {children}
    </VocoderProvider>
  );
}
```

### Remix - From Request Headers

```tsx
import { useLoaderData } from '@remix-run/react';

export async function loader({ request }) {
  const acceptLang = request.headers.get('accept-language');
  const locale = acceptLang?.split(',')[0]?.split('-')[0] ?? 'en';
  return { locale };
}

export default function Root() {
  const { locale } = useLoaderData();

  return (
    <VocoderProvider
      translations={{ en, es, fr }}
      defaultLocale={locale}
    >
      {/* app */}
    </VocoderProvider>
  );
}
```

### From URL Parameter

```tsx
const searchParams = new URLSearchParams(window.location.search);
const locale = searchParams.get('lang') ?? 'en';

<VocoderProvider translations={{ en, es, fr }} defaultLocale={locale}>
  {/* app */}
</VocoderProvider>
```

### From Cookie

```tsx
const locale = document.cookie
  .split('; ')
  .find(row => row.startsWith('locale='))
  ?.split('=')[1] ?? 'en';

<VocoderProvider translations={{ en, es, fr }} defaultLocale={locale}>
  {/* app */}
</VocoderProvider>
```

## Server-Side Rendering (SSR)

For server components (Next.js App Router):

```tsx
import { VocoderProviderServer } from '@vocoder/react/server';
import { T } from '@vocoder/react';
import en from './locales/en.json';

export default async function Page() {
  return (
    <VocoderProviderServer locale="en" translations={en}>
      <T>Server-rendered content</T>
    </VocoderProviderServer>
  );
}
```

## Features

- ✅ **Static-first**: Import JSON translations directly
- ✅ **Source text as key**: No separate translation IDs needed
- ✅ **Three phases of complexity**:
  - **Phase 1**: Simple variable interpolation (`{varName}`)
  - **Phase 2**: ICU MessageFormat (pluralization, select, numbers, dates)
  - **Phase 3**: Rich text with component placeholders
- ✅ **Dual API**: `<T>` component for JSX + `t()` function for utilities
- ✅ **Locale persistence**: Remembers user's language choice
- ✅ **Platform-agnostic**: Works with Next.js, Remix, or any React app
- ✅ **SSR support**: Works with Next.js App Router
- ✅ **TypeScript**: Fully typed with strict mode
- ✅ **Zero-config**: Works out of the box
- ✅ **Comprehensive tests**: 34 tests covering all features

## License

MIT
