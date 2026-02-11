import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
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
  getBestMatchingLocale,
  getStoredLocale,
  setStoredLocale,
} from "./utils/storage";

import { getEnvVar } from "./utils/env";

const VocoderContext = createContext<VocoderContextValue | null>(null);

const STORAGE_KEY = "vocoder_locale";

/**
 * VocoderProvider manages translation state and locale switching.
 *
 * Supports two modes:
 * 1. Static mode (recommended): Pass `translations` prop with imported locales
 * 2. API mode: Pass `apiKey` to fetch translations from Vocoder API
 *
 * @example Static mode (recommended)
 * ```tsx
 * import { translations } from './.vocoder/locales'
 *
 * <VocoderProvider translations={translations} defaultLocale="en">
 *   <App />
 * </VocoderProvider>
 * ```
 * Note: Run `vocoder translate` to generate .vocoder/locales/index.ts
 *
 * @example API mode (runtime fetching)
 * ```tsx
 * <VocoderProvider apiKey="vc_pub_..." defaultLocale="en">
 *   <App />
 * </VocoderProvider>
 * ```
 */
export const VocoderProvider: React.FC<VocoderProviderProps> = ({
  apiKey,
  children,
  defaultLocale = "en",
  translations: initialTranslations,
  locales: localesMetadata,
  cookies: cookieString,
}) => {
  const [translations, setTranslations] = useState<TranslationsMap>(
    initialTranslations || {}
  );
  // Initialize locale with cookie-based preference (SSR-compatible!)
  // Cookies can be read on server, preventing hydration mismatches
  const [locale, setLocaleState] = useState<string>(() => {
    const availableLocales = initialTranslations ? Object.keys(initialTranslations) : [];

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

    // API mode - no translations yet, use defaultLocale as-is
    _setGlobalLocale(defaultLocale);
    return defaultLocale;
  });
  const [isLoading, setIsLoading] = useState(!initialTranslations);
  const [error, setError] = useState<string | null>(null);

  // Fetch translations from API if needed
  useEffect(() => {
    // If translations are provided (static mode), don't fetch
    if (initialTranslations) {
      return;
    }

    // API mode: fetch translations from Vocoder API
    const fetchTranslations = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const key = apiKey || getEnvVar("VOCODER_PUBLIC_KEY");

        if (!key) {
          throw new Error(
            "Missing VOCODER_PUBLIC_KEY. Please provide it as a prop, set VOCODER_PUBLIC_KEY environment variable, " +
              'add a meta tag <meta name="VOCODER_PUBLIC_KEY" content="your-key">, ' +
              'or set window.__VOCODER_PUBLIC_KEY__ = "your-key"'
          );
        }

        if (!key.startsWith("vc_pub_")) {
          throw new Error(
            "Invalid public key format. Expected format: vc_pub_<32_chars>"
          );
        }

        const res = await fetch(`https://api.vocoder.dev/translations`, {
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          throw new Error(
            `Failed to fetch translations: ${res.status} ${res.statusText}`
          );
        }

        const data = await res.json();
        setTranslations(data);

        // After fetching, validate current locale is available
        if (Object.keys(data).length > 0) {
          const availableLocales = Object.keys(data);
          const storedLocale = getStoredLocale(STORAGE_KEY);
          const preferredLocale = storedLocale ?? defaultLocale;

          const bestLocale = getBestMatchingLocale(
            preferredLocale,
            availableLocales,
            defaultLocale
          );

          setLocaleState(bestLocale);
          setStoredLocale(STORAGE_KEY, bestLocale);
          _setGlobalLocale(bestLocale);
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to fetch translations";
        setError(errorMessage);
        console.error("Vocoder SDK Error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTranslations();
  }, [apiKey, initialTranslations, defaultLocale]);

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
   */
  const setLocale = (newLocale: string) => {
    // Get available locales from translations
    const availableLocales = Object.keys(translations);

    // Find the best matching locale
    const bestLocale = getBestMatchingLocale(
      newLocale,
      availableLocales,
      defaultLocale
    );

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
    locale,
    setLocale,
    t,
    availableLocales: Object.keys(translations),
    locales: localesMetadata,
    isLoading,
    error,
    getDisplayName,
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
