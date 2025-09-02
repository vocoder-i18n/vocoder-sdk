# @vocoder/react

React components for the Vocoder SDK - a powerful internationalization solution built on top of react-intl.

## ⚠️ **Security Warning**

**IMPORTANT**: Exposing API keys on the client-side (browser) is inherently insecure. For production applications, use server-side rendering or API proxies instead of client-side API keys.

**For detailed security guidance, see [SECURITY.md](./SECURITY.md)**

## Installation

```bash
npm install @vocoder/react
```

## Quick Start

```tsx
import React from 'react';
import { TranslationProvider, Translation, LocaleSelector } from '@vocoder/react';

function App() {
  return (
    <TranslationProvider 
      defaultLocale="en"
      apiKey="your-api-key-here"
    >
      <div>
        <h1>
          <Translation 
            id="welcome_message" 
            text="Welcome {name}! It's great to see you again." 
            name="John" 
          />
        </h1>
        
        <LocaleSelector />
      </div>
    </TranslationProvider>
  );
}
```

## 🌍 **Smart Locale Persistence**

The SDK automatically detects and persists user locale preferences across sessions:

### **Automatic Detection**
- **Browser Language**: Uses `navigator.language`
- **URL Parameters**: Supports `?locale=fr`
- **Stored Preferences**: Remembers user choices
- **Smart Matching**: `en-US` → `en` if `en` is available

### **Cross-Environment Support**
- **Client-Side**: localStorage, sessionStorage, URL params
- **Server-Side**: SSR compatible, no storage operations
- **Private Browsing**: Graceful fallbacks when storage is blocked

```tsx
// Works seamlessly in all environments
<TranslationProvider defaultLocale="en">
  {/* Locale automatically detected and persisted */}
</TranslationProvider>
```

## Environment Variables (Isomorphic)

The SDK supports multiple ways to provide your API key, working seamlessly on both server and client:

### 1. **Server-Side Environment Variables** (Recommended for SSR)

```bash
# .env
VOCODER_API_KEY=your-api-key-here
```

```tsx
// Works in Next.js, Remix, etc.
<TranslationProvider defaultLocale="en">
  {/* Your app content */}
</TranslationProvider>
```

### 2. **Client-Side Meta Tags** (Good for static sites)

```html
<!-- In your HTML head -->
<meta name="VOCODER_API_KEY" content="your-api-key-here">
```

```tsx
<TranslationProvider defaultLocale="en">
  {/* Your app content */}
</TranslationProvider>
```

### 3. **Global Window Variables** (For dynamic configuration)

```tsx
// In your app initialization
window.__VOCODER_API_KEY__ = 'your-api-key-here';

// Then use normally
<TranslationProvider defaultLocale="en">
  {/* Your app content */}
</TranslationProvider>
```

### 4. **Build-Time Environment Variables** (For bundlers)

```bash
# Vite
VITE_VOCODER_API_KEY=your-api-key-here

# Create React App
REACT_APP_VOCODER_API_KEY=your-api-key-here

# Next.js (public)
NEXT_PUBLIC_VOCODER_API_KEY=your-api-key-here
```

```tsx
// For Vite/CRA, you'd need to expose it globally
window.__VOCODER_API_KEY__ = import.meta.env.VITE_VOCODER_API_KEY;
// or
window.__VOCODER_API_KEY__ = process.env.REACT_APP_VOCODER_API_KEY;
```

### 5. **Runtime Configuration** (Most flexible)

```tsx
// Fetch config from your own API
const [config, setConfig] = useState(null);

useEffect(() => {
  fetch('/api/config').then(res => res.json()).then(setConfig);
}, []);

if (!config) return <div>Loading...</div>;

return (
  <TranslationProvider 
    defaultLocale="en"
    apiKey={config.vocoderApiKey}
  >
    {/* Your app content */}
  </TranslationProvider>
);
```

## Framework-Specific Examples

### Next.js

```tsx
// app/layout.tsx
import { TranslationProvider } from '@vocoder/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <TranslationProvider defaultLocale="en">
          {children}
        </TranslationProvider>
      </body>
    </html>
  );
}
```

### Vite + React

```tsx
// main.tsx
import { TranslationProvider } from '@vocoder/react';

// Expose environment variable globally
window.__VOCODER_API_KEY__ = import.meta.env.VITE_VOCODER_API_KEY;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <TranslationProvider defaultLocale="en">
    <App />
  </TranslationProvider>
);
```

### Remix

```tsx
// app/root.tsx
import { TranslationProvider } from '@vocoder/react';

export default function App() {
  return (
    <html>
      <head>
        <meta name="VOCODER_API_KEY" content={process.env.VOCODER_API_KEY} />
      </head>
      <body>
        <TranslationProvider defaultLocale="en">
          <Outlet />
        </TranslationProvider>
      </body>
    </html>
  );
}
```

## Components

### TranslationProvider

The main provider component that fetches translations and manages the current locale. Integrates with react-intl's IntlProvider for seamless internationalization.

**Props:**
- `children`: React nodes to render
- `defaultLocale`: Initial locale (default: "en")
- `apiKey`: Your Vocoder API key (optional - can use environment variable)
- `translations`: Pre-fetched translations for SSR (optional)

### Translation

Renders translated text with support for message formatting using react-intl's formatMessage.

**Props:**
- `id`: Translation key
- `text`: Fallback text if translation is not found
- `...values`: Dynamic values for message formatting

**Example:**
```tsx
<Translation 
  id="welcome_message" 
  text="Welcome {name}!" 
  name="John" 
/>
```

### LocaleSelector

A dropdown component for switching between available locales.

**Props:**
- `className`: CSS class name
- `placeholder`: Placeholder text for the dropdown

## Hook

### useTranslation

Access the translation context in your components.

```tsx
import { useTranslation } from '@vocoder/react';

function MyComponent() {
  const { locale, setLocale, translations, isLoading, error } = useTranslation();
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return (
    <div>
      <p>Current locale: {locale}</p>
      <button onClick={() => setLocale('fr')}>Switch to French</button>
    </div>
  );
}
```

## API Response Format

The SDK expects translations in this format:

```json
{
  "en": {
    "welcome_message": "Welcome {name}!",
    "description": "This is a sample app"
  },
  "fr": {
    "welcome_message": "Bienvenue {name}!",
    "description": "Ceci est un exemple d'application"
  }
}
```

## Features

- ✅ **Single fetch**: Translations are fetched once on initialization
- ✅ **Message formatting**: Support for dynamic values using react-intl
- ✅ **Loading states**: Built-in loading and error handling
- ✅ **TypeScript**: Full TypeScript support
- ✅ **SSR ready**: Works with server-side rendering
- ✅ **Isomorphic env vars**: Multiple ways to configure API keys
- ✅ **Project-based API keys**: API keys determine the project automatically
- ✅ **react-intl integration**: Built on top of the industry-standard react-intl library
- ✅ **Security warnings**: Built-in warnings for client-side API key usage
- ✅ **Smart locale persistence**: Automatic detection and storage of user preferences
- ✅ **Cross-environment support**: Works seamlessly on server and client

## License

MIT 