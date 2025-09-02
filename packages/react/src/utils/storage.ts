// Isomorphic storage utility for locale persistence
export const getStoredLocale = (key: string, fallback: string): string => {
  // Server-side: return fallback (no persistence)
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    // Client-side: try localStorage first
    const stored = localStorage.getItem(key);
    if (stored) {
      return stored;
    }

    // Fallback to sessionStorage if localStorage fails
    const sessionStored = sessionStorage.getItem(key);
    if (sessionStored) {
      return sessionStored;
    }

    // Check for URL parameter (useful for sharing links with specific locale)
    const urlParams = new URLSearchParams(window.location.search);
    const urlLocale = urlParams.get('locale');
    if (urlLocale) {
      return urlLocale;
    }

    // Check for Accept-Language header (browser preference)
    const browserLocale = navigator.language?.split('-')[0];
    if (browserLocale) {
      return browserLocale;
    }

    return fallback;
  } catch (error) {
    // If storage is blocked (private browsing, etc.), fall back gracefully
    console.warn('Storage access blocked, using fallback locale:', fallback);
    return fallback;
  }
};

export const setStoredLocale = (key: string, locale: string): void => {
  // Server-side: no-op
  if (typeof window === 'undefined') {
    return;
  }

  try {
    // Try localStorage first
    localStorage.setItem(key, locale);
    
    // Also update sessionStorage for redundancy
    sessionStorage.setItem(key, locale);
  } catch (error) {
    // If localStorage fails, try sessionStorage only
    try {
      sessionStorage.setItem(key, locale);
    } catch (sessionError) {
      console.warn('Unable to persist locale preference:', sessionError);
    }
  }
};

// Utility to get browser's preferred locale
export const getBrowserLocale = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  // Try navigator.language first
  if (navigator.language) {
    return navigator.language.split('-')[0];
  }

  // Fallback to navigator.languages
  if (navigator.languages && navigator.languages.length > 0) {
    return navigator.languages[0].split('-')[0];
  }

  return null;
};

// Utility to check if a locale is supported
export const isLocaleSupported = (locale: string, supportedLocales: string[]): boolean => {
  return supportedLocales.includes(locale);
};

// Utility to get the best matching locale from supported options
export const getBestMatchingLocale = (
  preferredLocale: string, 
  supportedLocales: string[], 
  fallback: string
): string => {
  // Exact match
  if (isLocaleSupported(preferredLocale, supportedLocales)) {
    return preferredLocale;
  }

  // Try language code only (e.g., 'en' from 'en-US')
  const languageCode = preferredLocale.split('-')[0];
  if (isLocaleSupported(languageCode, supportedLocales)) {
    return languageCode;
  }

  // Try to find a similar locale (e.g., 'en-US' -> 'en-GB')
  const similarLocale = supportedLocales.find(locale => 
    locale.startsWith(languageCode + '-')
  );
  if (similarLocale) {
    return similarLocale;
  }

  return fallback;
}; 