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
  getBestMatchingLocale,
  getStoredLocale,
  setStoredLocale,
} from "./utils/storage";
import {
  getGeneratedConfig,
  getGeneratedLocales,
  getGeneratedTranslations,
  initializeVocoder,
  loadLocale,
  loadLocaleSync,
} from "./generated";

const VocoderContext = createContext<VocoderContextValue | null>(null);

const STORAGE_KEY = "vocoder_locale";
const HYDRATION_ID = "__vocoder_hydration__";

type HydrationSnapshot = {
  locale: string;
  translations: Record<string, string>;
  locales: Record<string, any>;
  defaultLocale: string;
};

function escapeJsonForHtml(value: string): string {
  return value.replace(/</g, "\\u003c");
}

function readHydrationFromDom(): { raw: string; data: HydrationSnapshot } | null {
  if (typeof document === "undefined") return null;
  const el = document.getElementById(HYDRATION_ID);
  const raw = el?.textContent || "";
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as HydrationSnapshot;
    if (!data || !data.locale || !data.translations) return null;
    return { raw, data };
  } catch {
    return null;
  }
}

function buildHydrationOnServer(
  cookieString: string | undefined,
  propDefaultLocale: string | undefined,
  propLocales: Record<string, any> | undefined,
  propTranslations: TranslationsMap | undefined,
): { raw: string; data: HydrationSnapshot } | null {
  if (typeof window !== "undefined") return null;
  if (propTranslations) return null;

  const config = getGeneratedConfig();
  const locales = propLocales ?? getGeneratedLocales() ?? {};
  const availableLocales = Object.keys(locales);
  const fallback =
    propDefaultLocale || config.sourceLocale || availableLocales[0] || "en";

  const storedPreference = getStoredLocale(STORAGE_KEY, cookieString);
  const bestLocale = storedPreference
    ? availableLocales.length > 0
      ? getBestMatchingLocale(storedPreference, availableLocales, fallback)
      : storedPreference
    : availableLocales.length > 0
      ? getBestMatchingLocale(fallback, availableLocales, fallback)
      : fallback;

  const generated = getGeneratedTranslations();
  let translations = generated[bestLocale];
  if (!translations) {
    const loaded = loadLocaleSync(bestLocale);
    if (loaded) translations = loaded;
  }

  const data: HydrationSnapshot = {
    locale: bestLocale,
    translations: translations || {},
    locales,
    defaultLocale: fallback,
  };

  const raw = escapeJsonForHtml(JSON.stringify(data));
  return { raw, data };
}

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
  const [hydration] = useState(() => {
    if (typeof window !== "undefined") {
      return readHydrationFromDom();
    }
    return buildHydrationOnServer(
      cookieString,
      propDefaultLocale,
      propLocales,
      propTranslations,
    );
  });
  const hydrationData = hydration?.data;
  const hydrationRaw = hydration?.raw;

  const [translations, setTranslationsState] = useState<TranslationsMap>(() => {
    if (propTranslations) return propTranslations;
    if (hydrationData?.translations && hydrationData?.locale) {
      return { [hydrationData.locale]: hydrationData.translations };
    }

    const generated = getGeneratedTranslations();

    // SSR: prime translations for stored locale to avoid flash
    if (typeof window === 'undefined') {
      const storedPreference = getStoredLocale(STORAGE_KEY, cookieString);
      if (storedPreference && !generated[storedPreference]) {
        const loaded = loadLocaleSync(storedPreference);
        if (loaded) {
          return { ...generated, [storedPreference]: loaded };
        }
      }
    }

    return generated;
  });
  const [localesMetadata, setLocalesMetadata] = useState(
    () => propLocales ?? hydrationData?.locales ?? getGeneratedLocales(),
  );
  const [defaultLocale, setDefaultLocale] = useState(
    () =>
      propDefaultLocale ||
      hydrationData?.defaultLocale ||
      generatedConfig.sourceLocale ||
      "en",
  );
  const [isInitialized, setIsInitialized] = useState(false);
  const isReady = Boolean(propTranslations) ||
    Boolean(hydrationData?.translations && hydrationData?.locale) ||
    (Object.keys(translations).length > 0 && isInitialized);

  // If translations are empty, load them async (for browser/Vite where
  // the synchronous require couldn't load locale files at module init time)
  useEffect(() => {
    if (isInitialized) return;

    const hasTranslations = Object.keys(translations).length > 0;
    const hasLocales = Object.keys(localesMetadata || {}).length > 0;
    const hasDefaultLocale = Boolean(defaultLocale);

    initializeVocoder().then(() => {
      setIsInitialized(true);

      if (!propTranslations) {
        const trans = getGeneratedTranslations();
        if (Object.keys(trans).length > 0) {
          setTranslationsState(trans);
        }
      }

      if (!propLocales) {
        const locales = getGeneratedLocales();
        if (Object.keys(locales).length > 0) {
          setLocalesMetadata(locales);
        }
      }

      if (!propDefaultLocale) {
        const cfg = getGeneratedConfig();
        if (cfg.sourceLocale) {
          setDefaultLocale(cfg.sourceLocale);
        }
      }

      // If we didn't have translations initially, re-resolve locale after init
      if (!propTranslations && !hasTranslations && !hydrationData) {
        const trans = getGeneratedTranslations();
        const locales = getGeneratedLocales();
        const available = Object.keys(locales).length > 0
          ? Object.keys(locales)
          : Object.keys(trans);

        if (available.length > 0) {
          const storedPreference = getStoredLocale(STORAGE_KEY, cookieString);
          const fallback = getGeneratedConfig().sourceLocale || available[0] || 'en';
          const bestLocale = getBestMatchingLocale(
            storedPreference || fallback,
            available,
            fallback,
          );

          setLocaleState(bestLocale);
          _setGlobalLocale(bestLocale);
        }
      }

    });
  }, [
    defaultLocale,
    isInitialized,
    localesMetadata,
    propDefaultLocale,
    propLocales,
    propTranslations,
    translations,
    cookieString,
    hydrationData,
  ]);

  // Initialize locale with cookie-based preference (SSR-compatible!)
  // Cookies can be read on server, preventing hydration mismatches
  const [locale, setLocaleState] = useState<string>(() => {
    if (hydrationData?.locale) {
      _setGlobalLocale(hydrationData.locale);
      return hydrationData.locale;
    }
    const availableFromTranslations = translations ? Object.keys(translations) : [];
    const availableFromConfig = Object.keys(localesMetadata || {});
    const availableLocales = availableFromConfig.length > 0
      ? availableFromConfig
      : availableFromTranslations;

    // Try to get stored preference from cookies (works on server and client)
    const storedPreference = getStoredLocale(STORAGE_KEY, cookieString);

    // If stored preference exists, use it (even if translations aren't loaded yet)
    if (storedPreference) {
      const bestLocale = availableLocales.length > 0
        ? getBestMatchingLocale(storedPreference, availableLocales, defaultLocale)
        : storedPreference;
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

  const hasTranslation = useCallback(
    (text: string): boolean => {
      const localeTranslations = translations[locale];
      return Boolean(
        localeTranslations &&
        Object.prototype.hasOwnProperty.call(localeTranslations, text),
      );
    },
    [translations, locale],
  );

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
    const availableLocales = Object.keys(localesMetadata).length > 0
      ? Object.keys(localesMetadata)
      : Object.keys(translations);

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

  // Available locales = all locales from config (not just loaded ones)
  // since setLocale can lazy-load any locale on demand
    const availableLocales = Object.keys(localesMetadata).length > 0
      ? Object.keys(localesMetadata)
      : Object.keys(translations);

  const value: VocoderContextValue = {
    availableLocales,
    getDisplayName,
    isReady,
    locale,
    locales: localesMetadata,
    setLocale,
    t,
    hasTranslation,
  };

  return (
    <VocoderContext.Provider value={value}>
      {hydrationRaw ? (
        <script
          id={HYDRATION_ID}
          type="application/json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: hydrationRaw }}
        />
      ) : null}
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
