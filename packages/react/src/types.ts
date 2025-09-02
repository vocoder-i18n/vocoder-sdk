import React from 'react';

// Translation data structure
export interface TranslationsMap {
  [locale: string]: {
    [key: string]: string;
  };
}

// Context value for the translation provider
export interface TranslationContextValue {
  locale: string;
  setLocale: (locale: string) => void;
  translations: TranslationsMap;
  isLoading: boolean;
  error: string | null;
}

// Props for the TranslationProvider component
export interface TranslationProviderProps {
  apiKey?: string;
  children: React.ReactNode;
  defaultLocale?: string;
  translations?: TranslationsMap;
}

// Props for the Translation component
export interface TranslationProps {
  id: string;
  text?: string;
  [key: string]: any; // Allow additional values for interpolation
}

// Props for the LocaleSelector component
export interface LocaleSelectorProps {
  className?: string;
  placeholder?: string;
} 