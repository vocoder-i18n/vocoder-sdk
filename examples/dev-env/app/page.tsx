'use client';

import { LocaleSelector, Translation, TranslationProvider, useTranslation } from '@vocoder/react';
import { useEffect, useState } from 'react';

// Global type declaration for API key
declare global {
  interface Window {
    __VOCODER_API_KEY__?: string;
  }
}

// Mock API endpoint for testing
const MOCK_TRANSLATIONS = {
  en: {
    welcome_message: "Welcome {name}! It's great to see you again.",
    description: "This is a sample application using the Vocoder SDK.",
    button_text: "Click me",
    loading_text: "Loading translations...",
    error_text: "Failed to load translations",
    locale_info: "Current locale: {locale}",
    available_locales: "Available locales: {locales}",
    storage_test: "Storage test: {value}",
    api_key_test: "API key source: {source}"
  },
  fr: {
    welcome_message: "Bienvenue {name}! C'est un plaisir de vous revoir.",
    description: "Ceci est un exemple d'application utilisant le SDK Vocoder.",
    button_text: "Cliquez-moi",
    loading_text: "Chargement des traductions...",
    error_text: "Échec du chargement des traductions",
    locale_info: "Locale actuelle: {locale}",
    available_locales: "Locales disponibles: {locales}",
    storage_test: "Test de stockage: {value}",
    api_key_test: "Source de la clé API: {source}"
  },
  es: {
    welcome_message: "¡Bienvenido {name}! Es un placer verte de nuevo.",
    description: "Esta es una aplicación de ejemplo usando el SDK Vocoder.",
    button_text: "Haz clic en mí",
    loading_text: "Cargando traducciones...",
    error_text: "Error al cargar traducciones",
    locale_info: "Locale actual: {locale}",
    available_locales: "Locales disponibles: {locales}",
    storage_test: "Prueba de almacenamiento: {value}",
    api_key_test: "Fuente de la clave API: {source}"
  }
};

// Test component for different scenarios
function TestScenarios() {
  const { locale, setLocale, translations, isLoading, error } = useTranslation();
  const [storageValue, setStorageValue] = useState<string>('Not set');
  const [apiKeySource, setApiKeySource] = useState<string>('Unknown');

  useEffect(() => {
    // Test localStorage access
    try {
      const stored = localStorage.getItem('vocoder_locale');
      setStorageValue(stored || 'Not found');
    } catch (e) {
      setStorageValue('Storage blocked');
    }

    // Test API key detection
    if (typeof window !== 'undefined') {
      if (window.__VOCODER_API_KEY__) {
        setApiKeySource('Window global');
      } else if (document.querySelector('meta[name="VOCODER_API_KEY"]')) {
        setApiKeySource('Meta tag');
      } else {
        setApiKeySource('Environment variable');
      }
    }
  }, []);

  return (
    <div className="test-section">
      <h2>Translation Test Scenarios</h2>
      
      {isLoading && (
        <div className="info">
          <Translation id="loading_text" text="Loading translations..." />
        </div>
      )}

      {error && (
        <div className="error">
          <Translation id="error_text" text="Failed to load translations" />
          <p>Error: {error}</p>
        </div>
      )}

      {!isLoading && !error && (
        <>
          <div className="translation-example">
            <h3>Basic Translation</h3>
            <p>
              <Translation 
                id="welcome_message" 
                text="Welcome {name}! It's great to see you again." 
                name="Developer" 
              />
            </p>
            <p>
              <Translation 
                id="description" 
                text="This is a sample application." 
              />
            </p>
          </div>

          <div className="translation-example">
            <h3>Locale Information</h3>
            <p>
              <Translation 
                id="locale_info" 
                text="Current locale: {locale}" 
                locale={locale} 
              />
            </p>
            <p>
              <Translation 
                id="available_locales" 
                text="Available locales: {locales}" 
                locales={Object.keys(translations).join(', ')} 
              />
            </p>
          </div>

          <div className="translation-example">
            <h3>Storage Test</h3>
            <p>
              <Translation 
                id="storage_test" 
                text="Storage test: {value}" 
                value={storageValue} 
              />
            </p>
          </div>

          <div className="translation-example">
            <h3>API Key Source</h3>
            <p>
              <Translation 
                id="api_key_test" 
                text="API key source: {source}" 
                source={apiKeySource} 
              />
            </p>
          </div>

          <div className="translation-example">
            <h3>Locale Selector</h3>
            <LocaleSelector className="locale-selector" />
          </div>

          <div className="translation-example">
            <h3>Programmatic Locale Change</h3>
            <button onClick={() => setLocale('en')}>Switch to English</button>
            <button onClick={() => setLocale('fr')}>Switch to French</button>
            <button onClick={() => setLocale('es')}>Switch to Spanish</button>
          </div>
        </>
      )}
    </div>
  );
}

// Component to test different API key sources
function ApiKeyTest() {
  const [testKey, setTestKey] = useState('test-api-key-12345');

  const setWindowKey = () => {
    if (typeof window !== 'undefined') {
      (window as any).__VOCODER_API_KEY__ = testKey;
      alert('Window global API key set! Refresh to test.');
    }
  };

  const clearWindowKey = () => {
    if (typeof window !== 'undefined') {
      delete (window as any).__VOCODER_API_KEY__;
      alert('Window global API key cleared! Refresh to test.');
    }
  };

  return (
    <div className="test-section">
      <h2>API Key Source Testing</h2>
      <div className="info">
        <p>Test different ways to provide API keys:</p>
        <ul>
          <li>Environment variables (VOCODER_API_KEY)</li>
          <li>Meta tags (&lt;meta name="VOCODER_API_KEY"&gt;)</li>
          <li>Window globals (window.__VOCODER_API_KEY__)</li>
          <li>Direct props (apiKey prop)</li>
        </ul>
      </div>

      <div className="translation-example">
        <h3>Test Window Global</h3>
        <input 
          type="text" 
          value={testKey} 
          onChange={(e) => setTestKey(e.target.value)}
          placeholder="Enter API key"
        />
        <button onClick={setWindowKey}>Set Window Global</button>
        <button onClick={clearWindowKey}>Clear Window Global</button>
      </div>

      <div className="translation-example">
        <h3>Test URL Parameters</h3>
        <p>Add locale to URL to test URL parameter detection:</p>
        <a href="?locale=en">?locale=en</a> | 
        <a href="?locale=fr">?locale=fr</a> | 
        <a href="?locale=es">?locale=es</a>
      </div>
    </div>
  );
}

// Main page component
export default function HomePage() {
  const [apiKey, setApiKey] = useState<string>('');
  const [useDirectKey, setUseDirectKey] = useState(false);

  return (
    <div className="container">
      <h1>Vocoder SDK Development Environment</h1>
      
      <div className="test-section">
        <h2>Configuration</h2>
        <div className="info">
          <p>This environment tests both server-side and client-side implementations of the Vocoder SDK.</p>
        </div>

        <div className="translation-example">
          <h3>API Key Configuration</h3>
          <label>
            <input 
              type="checkbox" 
              checked={useDirectKey}
              onChange={(e) => setUseDirectKey(e.target.checked)}
            />
            Use direct API key prop (instead of environment variables)
          </label>
          
          {useDirectKey && (
            <div>
              <input 
                type="text" 
                value={apiKey} 
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter API key"
                style={{ marginTop: '0.5rem', width: '100%' }}
              />
            </div>
          )}
        </div>
      </div>

      <TranslationProvider 
        defaultLocale="en"
        apiKey={useDirectKey ? apiKey : undefined}
        translations={MOCK_TRANSLATIONS} // Use mock data for testing
      >
        <TestScenarios />
        <ApiKeyTest />
      </TranslationProvider>

      <div className="test-section">
        <h2>Testing Instructions</h2>
        <div className="info">
          <h3>What to Test:</h3>
          <ul>
            <li><strong>Locale Persistence:</strong> Change locale and refresh the page</li>
            <li><strong>URL Parameters:</strong> Add ?locale=fr to URL</li>
            <li><strong>API Key Sources:</strong> Test different ways to provide API keys</li>
            <li><strong>Storage Fallbacks:</strong> Test in private browsing mode</li>
            <li><strong>SSR Compatibility:</strong> Check page source for server-side rendering</li>
          </ul>
        </div>
      </div>

      <div className="test-section">
        <h2>Additional Test Pages</h2>
        <div className="info">
          <ul>
            <li><a href="/ssr-test" style={{ color: '#0070f3' }}>SSR Test Page</a> - Test server-side rendering</li>
            <li><a href="/ssr-best-practices" style={{ color: '#0070f3' }}>SSR Best Practices</a> - Learn server vs client component patterns</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 