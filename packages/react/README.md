# @vocoder/react

React runtime for Vocoder-generated translations.

## What It Expects

Run `vocoder sync` first. The runtime reads generated artifacts from:

`node_modules/@vocoder/generated`

No manual translation imports are needed.

## Install

```bash
pnpm add @vocoder/react
pnpm add -D @vocoder/cli
```

## Core API

`@vocoder/react` exports:

- `VocoderProvider`
- `useVocoder`
- `T`
- `t`
- `initializeVocoder`

Optional UI export:

- `LocaleSelector` from `@vocoder/react/locale-selector`

## Provider

`VocoderProvider` props:

- `children: ReactNode`
- `cookies?: string`

`cookies` is used by SSR frameworks (like Next.js) to keep server locale and client locale in sync.

```tsx
import { VocoderProvider } from '@vocoder/react';

export function AppRoot({ children }: { children: React.ReactNode }) {
  return <VocoderProvider>{children}</VocoderProvider>;
}
```

## Translation Components

### `<T>`

Use `<T>` for JSX translations, ICU, and rich text placeholders.

```tsx
import { T } from '@vocoder/react';

<T>Hello, world!</T>
<T name="Ada">Hello, {name}!</T>
<T msg="{count, plural, one {# item} other {# items}}" count={3} />
<T
  msg="Click <link>here</link> for help"
  components={{ link: <a href="/help" /> }}
/>
```

### `t(text, values?)`

Use `t()` outside JSX (utilities, toasts, logging, etc).

```ts
import { t } from '@vocoder/react';

const title = t('Welcome');
const items = t('{count, plural, one {# item} other {# items}}', { count: 2 });
```

If a translation is missing, `t()` returns the source string.

## `useVocoder`

```tsx
import { useVocoder } from '@vocoder/react';

const { locale, setLocale, availableLocales, isReady } = useVocoder();
```

Context fields:

- `locale`
- `setLocale(locale): Promise<void>`
- `t(text): string`
- `hasTranslation(text): boolean`
- `availableLocales: string[]`
- `locales?: Record<string, { nativeName: string; dir?: 'rtl'; currencyCode?: string }>`
- `getDisplayName(targetLocale, viewingLocale?)`
- `isReady`

## SSR Example (Next.js App Router)

Server layout:

```tsx
import { cookies } from 'next/headers';
import { Providers } from './providers';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieString = (await cookies()).toString();
  return (
    <html>
      <body>
        <Providers cookies={cookieString}>{children}</Providers>
      </body>
    </html>
  );
}
```

Client provider wrapper:

```tsx
'use client';

import { VocoderProvider } from '@vocoder/react';

export function Providers({
  children,
  cookies,
}: {
  children: React.ReactNode;
  cookies: string;
}) {
  return <VocoderProvider cookies={cookies}>{children}</VocoderProvider>;
}
```

## SPA Example (Vite / client-only)

Boot translations before first render to avoid flash:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
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

Optional loading UI:

```tsx
const { isReady } = useVocoder();
if (!isReady) return <div>Loading translations...</div>;
```

## Locale Selector

Import only if you want the built-in dropdown UI:

```tsx
import { LocaleSelector } from '@vocoder/react/locale-selector';

<LocaleSelector position="bottom-right" />;
```
