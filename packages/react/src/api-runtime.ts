/**
 * Background refresh for translations at runtime.
 *
 * Reads build-time constants injected by @vocoder/unplugin:
 * - __VOCODER_FINGERPRINT__
 * - __VOCODER_API_URL__
 * - __VOCODER_BUILD_TS__
 *
 * If the unplugin is not installed, these constants are undefined and
 * background refresh is silently disabled.
 */

declare const __VOCODER_FINGERPRINT__: string | undefined;
declare const __VOCODER_API_URL__: string | undefined;
declare const __VOCODER_BUILD_TS__: number | undefined;

const fingerprint =
  typeof __VOCODER_FINGERPRINT__ !== 'undefined' ? __VOCODER_FINGERPRINT__ : null;
const apiUrl =
  typeof __VOCODER_API_URL__ !== 'undefined' ? __VOCODER_API_URL__ : null;
const buildTs =
  typeof __VOCODER_BUILD_TS__ !== 'undefined' ? __VOCODER_BUILD_TS__ : null;

/** Whether the build-time constants are available for background refresh. */
export const isRefreshAvailable =
  fingerprint !== null && apiUrl !== null;

const refreshCache = new Map<string, Record<string, string>>();
const checkedLocales = new Set<string>(); // locales confirmed up-to-date (304)
const inflightRequests = new Map<string, Promise<Record<string, string> | null>>();

/**
 * Check for updated translations for a specific locale.
 * Returns fresh translations if newer than build time, or null if unchanged.
 */
export async function checkForUpdates(
  locale: string,
): Promise<Record<string, string> | null> {
  if (!isRefreshAvailable || typeof window === 'undefined') return null;

  // Return cached result if we already refreshed this locale
  if (refreshCache.has(locale)) return refreshCache.get(locale) ?? null;
  // Already checked — server confirmed up-to-date
  if (checkedLocales.has(locale)) return null;

  // Deduplicate concurrent requests for the same locale
  const inflight = inflightRequests.get(locale);
  if (inflight) return inflight;

  const promise = (async () => {
    try {
      const sinceParam = buildTs ? `?since=${buildTs}` : '';
      const url = `${apiUrl}/api/t/${fingerprint}/${locale}${sinceParam}`;

      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
      });

      if (response.status === 304) {
        checkedLocales.add(locale);
        return null;
      }
      if (!response.ok) return null;

      const translations = (await response.json()) as Record<string, string>;
      refreshCache.set(locale, translations);
      return translations;
    } catch {
      return null;
    } finally {
      inflightRequests.delete(locale);
    }
  })();

  inflightRequests.set(locale, promise);
  return promise;
}
