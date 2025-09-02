// Core types for Vocoder SDK

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
  translations?: TranslationsMap; // Allow pre-fetched translations for SSR
};
