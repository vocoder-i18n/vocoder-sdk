// Core exports (no UI dependencies)

// Lazy loading utilities
export { initializeVocoder } from "./runtime";
export { T } from "./T";
export { t } from "./translate";
// Type exports
export type {
	LocaleInfo,
	LocaleSelectorProps,
	LocalesMap,
	TProps,
	TranslationsMap,
	VocoderContextValue,
	VocoderProviderProps,
} from "./types";
export { useVocoder, VocoderProvider } from "./VocoderProvider";

// NOTE: LocaleSelector is now exported from a separate entry point to avoid
// bundling Radix UI and Lucide dependencies unless explicitly imported.
// Import it like this:
//   import { LocaleSelector } from '@vocoder/react/locale-selector';
