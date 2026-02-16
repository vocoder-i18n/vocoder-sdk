// Core exports (no UI dependencies)
export { T } from './T';
export { VocoderProvider, useVocoder } from './VocoderProvider';
export { withVocoder, withTranslation } from './withVocoder';
export { t, translate } from './translate';

// Lazy loading utilities
export { loadLocale, preloadLocale, initializeVocoder } from './generated';

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
export type { WithVocoderProps } from './withVocoder';

// NOTE: LocaleSelector is now exported from a separate entry point to avoid
// bundling Radix UI and Lucide dependencies unless explicitly imported.
// Import it like this:
//   import { LocaleSelector } from '@vocoder/react/locale-selector';
// Test change at Sun Feb 15 20:45:14 CST 2026
// Another test at Sun Feb 15 20:49:35 CST 2026
