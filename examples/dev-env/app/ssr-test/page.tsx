'use client';

import { Translation, TranslationProvider, TranslationProviderServer } from '@vocoder/react';

// Mock translations for SSR testing
const SSR_TRANSLATIONS = {
  en: {
    ssr_welcome: "Welcome to SSR Test Page!",
    ssr_description: "This page tests server-side rendering.",
    ssr_locale: "Server-side locale: {locale}",
    ssr_timestamp: "Page generated at: {timestamp}"
  },
  fr: {
    ssr_welcome: "Bienvenue sur la page de test SSR!",
    ssr_description: "Cette page teste le rendu côté serveur.",
    ssr_locale: "Locale côté serveur: {locale}",
    ssr_timestamp: "Page générée à: {timestamp}"
  },
  es: {
    ssr_welcome: "¡Bienvenido a la página de prueba SSR!",
    ssr_description: "Esta página prueba el renderizado del lado del servidor.",
    ssr_locale: "Locale del lado del servidor: {locale}",
    ssr_timestamp: "Página generada en: {timestamp}"
  }
};

export default function SSRTestPage() {
  const timestamp = new Date().toISOString();

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>SSR Test Page</h1>
      
      <div style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: '#f0f0f0', borderRadius: '8px' }}>
        <h2>Server-Side Rendering Test</h2>
        <p>This page uses pre-fetched translations to test SSR compatibility.</p>
        <p><strong>Timestamp:</strong> {timestamp}</p>
        <p><strong>Note:</strong> Check the page source to see server-rendered content.</p>
      </div>

      {/* Example 1: Using the regular client-side provider */}
      <div style={{ marginBottom: '2rem', padding: '1rem', border: '2px solid #0070f3', borderRadius: '8px' }}>
        <h3>Client-Side Provider (Interactive)</h3>
        <p>This uses the full TranslationProvider with hooks and interactivity.</p>
        
        <TranslationProvider 
          defaultLocale="en"
          translations={SSR_TRANSLATIONS}
        >
          <div style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
            <Translation 
              id="ssr_welcome" 
              text="Welcome to SSR Test Page!" 
            />
          </div>
        </TranslationProvider>
      </div>

      {/* Example 2: Using the server-compatible provider */}
      <div style={{ marginBottom: '2rem', padding: '1rem', border: '2px solid #28a745', borderRadius: '8px' }}>
        <h3>Server-Compatible Provider (Static)</h3>
        <p>This uses TranslationProviderServer - no hooks, perfect for Server Components.</p>
        
        <TranslationProviderServer 
          defaultLocale="en"
          translations={SSR_TRANSLATIONS}
          locale="fr"
        >
          <div style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
            <Translation 
              id="ssr_welcome" 
              text="Welcome to SSR Test Page!" 
            />
          </div>
        </TranslationProviderServer>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h3>Testing Instructions</h3>
        <ol>
          <li><strong>View Page Source:</strong> Right-click and "View Page Source" to see server-rendered HTML</li>
          <li><strong>Check Hydration:</strong> Verify no hydration mismatch warnings in console</li>
          <li><strong>Test Locale Switching:</strong> Use the main page to test locale persistence</li>
          <li><strong>Verify SSR:</strong> Translations should be visible in the page source</li>
        </ol>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h3>Best Practices Summary</h3>
        <ul>
          <li><strong>Server Components:</strong> Use <code>TranslationProviderServer</code> for static content</li>
          <li><strong>Client Components:</strong> Use <code>TranslationProvider</code> for interactive features</li>
          <li><strong>Hybrid Approach:</strong> Server renders static content, client handles interactivity</li>
          <li><strong>Performance:</strong> Server components reduce JavaScript bundle size</li>
        </ul>
      </div>

      <div>
        <a href="/" style={{ color: '#0070f3', textDecoration: 'none' }}>
          ← Back to Main Test Page
        </a>
      </div>
    </div>
  );
} 