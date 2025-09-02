import { LocaleSelector, Translation, TranslationProvider, useTranslation } from './index';

import React from 'react';

// Example 1: Direct API key prop
export const ExampleApp: React.FC = () => {
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
        
        <p>
          <Translation 
            id="description" 
            text="This is a sample application." 
          />
        </p>
      </div>
    </TranslationProvider>
  );
};

// Example 2: Using environment variables (isomorphic)
export const ExampleWithEnvVars: React.FC = () => {
  return (
    <TranslationProvider defaultLocale="en">
      <div>
        <h1>
          <Translation 
            id="welcome_message" 
            text="Welcome {name}! It's great to see you again." 
            name="John" 
          />
        </h1>
        
        <LocaleSelector />
        
        <p>
          <Translation 
            id="description" 
            text="This is a sample application." 
          />
        </p>
      </div>
    </TranslationProvider>
  );
};

// Example 3: Custom component using the hook
export const ExampleWithHook: React.FC = () => {
  const { locale, setLocale, translations, isLoading, error } = useTranslation();
  
  if (isLoading) {
    return <div>Loading translations...</div>;
  }
  
  if (error) {
    return <div>Error: {error}</div>;
  }
  
  const availableLocales = Object.keys(translations);
  
  return (
    <div>
      <h2>Current Locale: {locale}</h2>
      
      <div>
        <label>Switch Language: </label>
        <select value={locale} onChange={(e) => setLocale(e.target.value)}>
          {availableLocales.map(lang => (
            <option key={lang} value={lang}>
              {lang === 'en' ? 'English' : lang === 'fr' ? 'Français' : lang}
            </option>
          ))}
        </select>
      </div>
      
      <div>
        <h3>Available Translations:</h3>
        <pre>{JSON.stringify(translations, null, 2)}</pre>
      </div>
    </div>
  );
};

// Example 4: Runtime configuration
export const ExampleWithRuntimeConfig: React.FC = () => {
  const [config, setConfig] = React.useState<{ vocoderApiKey?: string } | null>(null);
  const [loading, setLoading] = React.useState(true);
  
  React.useEffect(() => {
    // Simulate fetching config from your own API
    const fetchConfig = async () => {
      try {
        // In a real app, this would be your API endpoint
        const response = await fetch('/api/config');
        const data = await response.json();
        setConfig(data);
      } catch (error) {
        console.error('Failed to fetch config:', error);
        setConfig({});
      } finally {
        setLoading(false);
      }
    };
    
    fetchConfig();
  }, []);
  
  if (loading) {
    return <div>Loading configuration...</div>;
  }
  
  if (!config?.vocoderApiKey) {
    return <div>No API key configured</div>;
  }
  
  return (
    <TranslationProvider 
      defaultLocale="en"
      apiKey={config.vocoderApiKey}
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
}; 