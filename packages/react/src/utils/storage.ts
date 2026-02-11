/**
 * Locale persistence utilities
 * Uses cookies for SSR-compatible persistence
 */

import { getCookie, setCookie } from './cookies';

/**
 * Get stored locale preference from cookies
 *
 * Cookies work on both server and client, enabling perfect SSR hydration
 *
 * @param key - Storage key (e.g., 'vocoder_locale')
 * @param cookieString - Optional cookie string (for server-side rendering)
 * @returns Stored locale or null
 */
export const getStoredLocale = (key: string, cookieString?: string): string | null => {
  return getCookie(key, cookieString);
};

/**
 * Persist locale preference using cookies
 * Cookies work on both server and client for perfect SSR support
 *
 * @param key - Storage key
 * @param locale - Locale code to store
 */
export const setStoredLocale = (key: string, locale: string): void => {
  setCookie(key, locale, {
    maxAge: 365 * 24 * 60 * 60, // 1 year
    path: '/',
    sameSite: 'Lax',
  });
};

/**
 * Find the best matching locale from available options
 * Handles language codes and regional variants (e.g., 'en-US' -> 'en')
 */
export const getBestMatchingLocale = (
  preferredLocale: string,
  supportedLocales: string[],
  fallback: string
): string => {
  // Exact match
  if (supportedLocales.includes(preferredLocale)) {
    return preferredLocale;
  }

  // Try language code only (e.g., 'en' from 'en-US')
  const languageCode = preferredLocale.split('-')[0];
  if (languageCode && supportedLocales.includes(languageCode)) {
    return languageCode;
  }

  // Try to find similar locale (e.g., 'en-US' -> 'en-GB')
  const similarLocale = supportedLocales.find((locale: string) =>
    locale.startsWith(`${languageCode}-`)
  );
  if (similarLocale) {
    return similarLocale;
  }

  return fallback;
};
