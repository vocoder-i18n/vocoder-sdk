import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  TranslationsMap,
  VocoderContextValue,
  VocoderProviderProps,
} from "./types";
import {
  _setGlobalLocale,
  _setGlobalTranslations,
} from "./translate";
import {
  getGeneratedConfig,
  getGeneratedTranslations,
  getGeneratedLocales,
  loadLocale,
} from "./generated";
import {
  getBestMatchingLocale,
  getStoredLocale,
  setStoredLocale,
} from "./utils/storage";

const VocoderContext = createContext<VocoderContextValue | null>(null);

const STORAGE_KEY = "vocoder_locale";

/**
 * VocoderProvider manages translation state and locale switching.
 *
 * After running `npx vocoder sync`, translations are loaded automatically.
 * No imports or prop wiring needed.
 *
 * @example
 * ```tsx
 * <VocoderProvider>
 *   <App />
 * </VocoderProvider>
 * ```
 *
 * @example With explicit overrides
 * ```tsx
 * <VocoderProvider defaultLocale="fr" translations={customTranslations}>
 *   <App />
 * </VocoderProvider>
 * ```
 */
export const VocoderProvider: React.FC<VocoderProviderProps> = ({
  children,
  defaultLocale: propDefaultLocale,
  translations: propTranslations,
  locales: propLocales,
  cookies: cookieString,
}) => {
  // Use prop values if provided, otherwise use auto-loaded generated data
  const generatedConfig = getGeneratedConfig();
  const initialTranslations = propTranslations ?? getGeneratedTranslations();
  const localesMetadata = propLocales ?? getGeneratedLocales();
  const defaultLocale = propDefaultLocale || generatedConfig.sourceLocale || "en";

  // Translations state - starts with initial locale, grows as locales are loaded
  const [translations, setTranslationsState] = useState<TranslationsMap>(initialTranslations);
  // Initialize locale with cookie-based preference (SSR-compatible!)
  // Cookies can be read on server, preventing hydration mismatches
  const [locale, setLocaleState] = useState<string>(() => {
    const availableLocales = translations ? Object.keys(translations) : [];

    // Try to get stored preference from cookies (works on server and client)
    const storedPreference = getStoredLocale(STORAGE_KEY, cookieString);

    // If stored preference exists, use it
    if (storedPreference && availableLocales.length > 0) {
      const bestLocale = getBestMatchingLocale(
        storedPreference,
        availableLocales,
        defaultLocale
      );
      _setGlobalLocale(bestLocale);
      return bestLocale;
    }

    // No stored preference - use defaultLocale
    if (availableLocales.length > 0) {
      const bestLocale = getBestMatchingLocale(
        defaultLocale,
        availableLocales,
        availableLocales[0] || 'en'
      );
      _setGlobalLocale(bestLocale);
      return bestLocale;
    }

    // No translations loaded yet, use defaultLocale as-is
    _setGlobalLocale(defaultLocale);
    return defaultLocale;
  });

  /**
   * Translation lookup function.
   * Returns the translated text for the given source text key.
   * Falls back to the source text if no translation is found.
   */
  const t = (text: string): string => {
    return translations[locale]?.[text] || text;
  };

  /**
   * Get the display name for a locale in a specific viewing language.
   * Uses Intl.DisplayNames for runtime translation of locale names.
   *
   * @param targetLocale - The locale code to get the name for (e.g., 'es', 'fr')
   * @param viewingLocale - Optional locale to display the name in (defaults to current locale)
   * @returns The translated locale name (e.g., 'Spanish' when viewing in 'en')
   */
  const getDisplayName = useCallback((targetLocale: string, viewingLocale?: string): string => {
    const vl = viewingLocale ?? locale;
    try {
      const dn = new Intl.DisplayNames([vl], { type: 'language' });
      return dn.of(targetLocale) ?? targetLocale;
    } catch {
      return targetLocale;
    }
  }, [locale]);

  /**
   * Smart locale setter that persists the choice and finds the best match.
   * Lazy loads translations for the new locale if not already loaded.
   */
  const setLocale = async (newLocale: string) => {
    // Get available locales from config (not just loaded translations)
    const availableLocales = Object.keys(localesMetadata);

    // Find the best matching locale
    const bestLocale = getBestMatchingLocale(
      newLocale,
      availableLocales,
      defaultLocale
    );

    // Lazy load translations if not already loaded
    if (!translations[bestLocale]) {
      try {
        const newTranslations = await loadLocale(bestLocale);
        // Merge into existing translations (React will re-render)
        setTranslationsState(prev => ({
          ...prev,
          [bestLocale]: newTranslations,
        }));
      } catch (error) {
        console.error(`Failed to load locale ${bestLocale}:`, error);
        // Continue with locale switch even if load fails (will show source text)
      }
    }

    // Update state
    setLocaleState(bestLocale);

    // Persist the choice
    setStoredLocale(STORAGE_KEY, bestLocale);

    // Sync with global state for t() function
    _setGlobalLocale(bestLocale);
  };

  // Sync translations with global state whenever they change
  useEffect(() => {
    if (Object.keys(translations).length > 0) {
      _setGlobalTranslations(translations);
    }
  }, [translations]);

  const value: VocoderContextValue = {
    availableLocales: Object.keys(translations),
    getDisplayName,
    locale,
    locales: localesMetadata,
    setLocale,
    t,
  };

  return (
    <VocoderContext.Provider value={value}>
      {children}
    </VocoderContext.Provider>
  );
};

/**
 * Hook to access Vocoder translation context.
 * Must be used within VocoderProvider.
 *
 * @example
 * ```tsx
 * const { locale, setLocale, t } = useVocoder();
 * const greeting = t("Hello, world!");
 * ```
 */
export const useVocoder = () => {
  const context = useContext(VocoderContext);
  if (!context) {
    throw new Error("useVocoder must be used inside VocoderProvider");
  }
  return context;
};
