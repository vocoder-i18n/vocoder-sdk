'use client';

import { Translation, TranslationProvider, useTranslation } from '@vocoder/react';

import type { TranslationsMap } from '@vocoder/types';
import { useState } from 'react';

interface ClientInteractiveSectionProps {
  translations: TranslationsMap;
}

export default function ClientInteractiveSection({ translations }: ClientInteractiveSectionProps) {
  const [counter, setCounter] = useState(0);
  const [inputValue, setInputValue] = useState('');

  return (
    <TranslationProvider 
      translations={translations}
      defaultLocale="en"
    >
      <div style={{ padding: '1rem', backgroundColor: '#fff3e0', borderRadius: '4px' }}>
        <h4>Interactive Features (Client Component)</h4>
        
        {/* Counter example */}
        <div style={{ marginBottom: '1rem' }}>
          <p>Counter: {counter}</p>
          <button 
            onClick={() => setCounter(counter + 1)}
            style={{ marginRight: '0.5rem', padding: '0.5rem 1rem', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            Increment
          </button>
          <button 
            onClick={() => setCounter(counter - 1)}
            style={{ padding: '0.5rem 1rem', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            Decrement
          </button>
        </div>

        {/* Input example */}
        <div style={{ marginBottom: '1rem' }}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type something..."
            style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', marginRight: '0.5rem' }}
          />
          <span>You typed: {inputValue}</span>
        </div>

        {/* Translation with locale switching */}
        <div style={{ marginBottom: '1rem' }}>
          <LocaleSwitcher />
        </div>

        {/* Translation example */}
        <div style={{ padding: '1rem', backgroundColor: '#e8f5e8', borderRadius: '4px' }}>
          <Translation 
            id="client_section" 
            text="This section is client-side interactive" 
          />
        </div>
      </div>
    </TranslationProvider>
  );
}

function LocaleSwitcher() {
  const { locale, setLocale } = useTranslation();

  return (
    <div>
      <p>Current locale: {locale}</p>
      <button 
        onClick={() => setLocale('en')}
        style={{ 
          marginRight: '0.5rem', 
          padding: '0.5rem 1rem', 
          backgroundColor: locale === 'en' ? '#28a745' : '#6c757d', 
          color: 'white', 
          border: 'none', 
          borderRadius: '4px' 
        }}
      >
        English
      </button>
      <button 
        onClick={() => setLocale('fr')}
        style={{ 
          padding: '0.5rem 1rem', 
          backgroundColor: locale === 'fr' ? '#28a745' : '#6c757d', 
          color: 'white', 
          border: 'none', 
          borderRadius: '4px' 
        }}
      >
        Français
      </button>
    </div>
  );
} 