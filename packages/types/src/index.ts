// Core types for Vocoder SDK
import type { ReactNode, ReactElement } from 'react';

// Translation data structure
export interface TranslationsMap {
  [locale: string]: {
    [key: string]: string;
  };
}

// Context value for the VocoderProvider
export interface VocoderContextValue {
  locale: string;
  setLocale: (locale: string) => void;
  t: (text: string, values?: Record<string, any>) => string;
  availableLocales: string[];
  isLoading: boolean;
  error: string | null;
}

// Props for the VocoderProvider component
export interface VocoderProviderProps {
  children: ReactNode;
  defaultLocale?: string;
  translations?: TranslationsMap;
  locales?: Record<string, { nativeName: string; dir?: 'rtl' }>;
  cookies?: string;
}

// Props for the T component
export interface TProps {
  children?: ReactNode;
  id?: string;
  context?: string;
  formality?: 'formal' | 'informal' | 'auto';
  components?: Record<string, ReactElement>;
  [key: string]: any;
}

// Props for LocaleSelector
export interface LocaleSelectorProps {
  className?: string;
  placeholder?: string;
}

// Legacy types for backwards compatibility
export interface TranslationContextValue extends VocoderContextValue {}
export interface TranslationProviderProps extends VocoderProviderProps {}
