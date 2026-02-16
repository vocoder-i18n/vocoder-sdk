import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  LocalesMap,
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
} from "./runtime";

const VocoderContext = createContext<VocoderContextValue | null>(null);

const STORAGE_KEY = "vocoder_locale";
const HYDRATION_ID = "__vocoder_hydration__";

type HydrationSnapshot = {
  locale: string;
  translations: Record<string, string>;
  locales: LocalesMap;
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
): { raw: string; data: HydrationSnapshot } | null {
  if (typeof window !== "undefined") return null;

  const config = getGeneratedConfig();
  const locales = getGeneratedLocales() ?? {};
  const availableLocales = Object.keys(locales);
  const fallback =
    config.sourceLocale || availableLocales[0] || "en";

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

/** Provides locale state and translations from generated runtime data. */
export const VocoderProvider: React.FC<VocoderProviderProps> = ({
  children,
  cookies: cookieString,
}) => {
  const [hydration] = useState(() => {
    if (typeof window !== "undefined") {
      return readHydrationFromDom();
    }
    return buildHydrationOnServer(cookieString);
  });
  const hydrationData = hydration?.data;
  const hydrationRaw = hydration?.raw;

  const [translations, setTranslationsState] = useState<TranslationsMap>(() => {
    let initial: TranslationsMap;

    if (hydrationData?.translations && hydrationData?.locale) {
      initial = { [hydrationData.locale]: hydrationData.translations };
    } else {
      const generated = getGeneratedTranslations();
      initial = generated;

      const storedPreference = getStoredLocale(STORAGE_KEY, cookieString);
      if (storedPreference && !generated[storedPreference]) {
        const loaded = loadLocaleSync(storedPreference);
        if (loaded) {
          initial = { ...generated, [storedPreference]: loaded };
        }
      }
    }

    _setGlobalTranslations(initial);
    return initial;
  });
  const [localesMetadata, setLocalesMetadata] = useState(
    () => hydrationData?.locales ?? getGeneratedLocales(),
  );
  const [defaultLocale, setDefaultLocale] = useState(
    () =>
      hydrationData?.defaultLocale ||
      getGeneratedConfig().sourceLocale ||
      "en",
  );
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (isInitialized) return;

    let cancelled = false;

    (async () => {
      await initializeVocoder();
      if (cancelled) return;

      setIsInitialized(true);

      const generatedTranslations = getGeneratedTranslations();
      if (Object.keys(generatedTranslations).length > 0) {
        setTranslationsState((prev) => ({ ...generatedTranslations, ...prev }));
      }

      const generatedLocales = getGeneratedLocales();
      if (Object.keys(generatedLocales).length > 0) {
        setLocalesMetadata(generatedLocales);
      }

      const cfg = getGeneratedConfig();
      if (cfg.sourceLocale) {
        setDefaultLocale(cfg.sourceLocale);
      }

      const available = Object.keys(generatedLocales).length > 0
        ? Object.keys(generatedLocales)
        : Object.keys(generatedTranslations);

      if (available.length === 0) return;

      const fallback = cfg.sourceLocale || available[0] || "en";
      const storedPreference = getStoredLocale(STORAGE_KEY, cookieString);
      const bestLocale = getBestMatchingLocale(
        storedPreference || fallback,
        available,
        fallback,
      );

      if (!generatedTranslations[bestLocale]) {
        const loaded = await loadLocale(bestLocale);
        if (cancelled) return;
        setTranslationsState((prev) => ({ ...prev, [bestLocale]: loaded }));
      }

      if (cancelled) return;
      setLocaleState(bestLocale);
      _setGlobalLocale(bestLocale);
    })();

    return () => {
      cancelled = true;
    };
  }, [cookieString, hydrationData, isInitialized]);

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

    const storedPreference = getStoredLocale(STORAGE_KEY, cookieString);

    if (storedPreference) {
      const bestLocale = availableLocales.length > 0
        ? getBestMatchingLocale(storedPreference, availableLocales, defaultLocale)
        : storedPreference;
      _setGlobalLocale(bestLocale);
      return bestLocale;
    }

    if (availableLocales.length > 0) {
      const bestLocale = getBestMatchingLocale(
        defaultLocale,
        availableLocales,
        availableLocales[0] || 'en'
      );
      _setGlobalLocale(bestLocale);
      return bestLocale;
    }

    _setGlobalLocale(defaultLocale);
    return defaultLocale;
  });
  const isReady = Boolean(translations[locale]) && (isInitialized || Boolean(hydrationData));

  const t = useCallback(
    (text: string): string => {
      return translations[locale]?.[text] || text;
    },
    [locale, translations],
  );

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

  const setLocale = async (newLocale: string) => {
    const availableLocales = Object.keys(localesMetadata).length > 0
      ? Object.keys(localesMetadata)
      : Object.keys(translations);

    const bestLocale = getBestMatchingLocale(
      newLocale,
      availableLocales,
      defaultLocale
    );

    if (!translations[bestLocale]) {
      try {
        const newTranslations = await loadLocale(bestLocale);
        setTranslationsState(prev => ({
          ...prev,
          [bestLocale]: newTranslations,
        }));
      } catch (error) {
        console.error(`Failed to load locale ${bestLocale}:`, error);
      }
    }

    setLocaleState(bestLocale);

    setStoredLocale(STORAGE_KEY, bestLocale);

    _setGlobalLocale(bestLocale);
  };

  useEffect(() => {
    _setGlobalLocale(locale);
  }, [locale]);

  useEffect(() => {
    if (Object.keys(translations).length > 0) {
      _setGlobalTranslations(translations);
    }
  }, [translations]);

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

export const useVocoder = () => {
  const context = useContext(VocoderContext);
  if (!context) {
    throw new Error("useVocoder must be used inside VocoderProvider");
  }
  return context;
};
