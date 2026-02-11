// Main exports
export { T } from './T';
export { VocoderProvider, useVocoder } from './VocoderProvider';
export { LocaleSelector } from './LocaleSelector';
export { withVocoder, withTranslation } from './withVocoder';
export { t, translate } from './translate';

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
