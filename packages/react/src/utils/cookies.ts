/**
 * Cookie utilities for locale persistence
 * Works on both server and client (via document.cookie)
 */

/**
 * Get a cookie value by name
 * Works in browser and server-side (if cookies are passed)
 */
export function getCookie(name: string, cookieString?: string): string | null {
  const cookies = cookieString || (typeof document !== 'undefined' ? document.cookie : '');

  if (!cookies) {
    return null;
  }

  const value = cookies
    .split('; ')
    .find((row: string) => row.startsWith(`${name}=`))
    ?.split('=')[1];

  return value ? decodeURIComponent(value) : null;
}

/**
 * Set a cookie value
 * Only works client-side (requires document.cookie)
 */
export function setCookie(
  name: string,
  value: string,
  options: {
    maxAge?: number; // in seconds
    path?: string;
    domain?: string;
    sameSite?: 'Strict' | 'Lax' | 'None';
    secure?: boolean;
  } = {}
): void {
  if (typeof document === 'undefined') {
    // Server-side: can't set cookies directly
    // Apps should set cookies via Set-Cookie header
    return;
  }

  const {
    maxAge = 365 * 24 * 60 * 60, // 1 year default
    path = '/',
    sameSite = 'Lax',
    secure = typeof window !== 'undefined' && window.location.protocol === 'https:',
  } = options;

  let cookieString = `${name}=${encodeURIComponent(value)}`;

  if (maxAge) {
    cookieString += `; Max-Age=${maxAge}`;
  }

  if (path) {
    cookieString += `; Path=${path}`;
  }

  if (options.domain) {
    cookieString += `; Domain=${options.domain}`;
  }

  if (sameSite) {
    cookieString += `; SameSite=${sameSite}`;
  }

  if (secure) {
    cookieString += '; Secure';
  }

  document.cookie = cookieString;
}

/**
 * Find the best matching locale from available options.
 * Handles language codes and regional variants (e.g., 'en-US' -> 'en').
 */
export function getBestMatchingLocale(
  preferredLocale: string,
  supportedLocales: string[],
  fallback: string,
): string {
  if (supportedLocales.includes(preferredLocale)) {
    return preferredLocale;
  }

  const languageCode = preferredLocale.split('-')[0];
  if (languageCode && supportedLocales.includes(languageCode)) {
    return languageCode;
  }

  const similarLocale = supportedLocales.find((locale: string) =>
    locale.startsWith(`${languageCode}-`),
  );
  if (similarLocale) {
    return similarLocale;
  }

  return fallback;
}
