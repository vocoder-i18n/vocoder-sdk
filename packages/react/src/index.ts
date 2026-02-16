// Core exports (no UI dependencies)
export { T } from './T';
export { VocoderProvider, useVocoder } from './VocoderProvider';
export { t } from './translate';

// Lazy loading utilities
export { initializeVocoder } from './runtime';

// Type exports
export type {
  VocoderContextValue,
  VocoderProviderProps,
  TProps,
  LocaleSelectorProps,
  TranslationsMap,
  LocalesMap,
  LocaleInfo,
} from './types';

// NOTE: LocaleSelector is now exported from a separate entry point to avoid
// bundling Radix UI and Lucide dependencies unless explicitly imported.
// Import it like this:
//   import { LocaleSelector } from '@vocoder/react/locale-selector';
