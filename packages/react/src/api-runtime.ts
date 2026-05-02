/**
 * Background refresh for translations at runtime.
 *
 * Reads build-time constants injected by @vocoder/plugin:
 * - __VOCODER_FINGERPRINT__
 * - __VOCODER_API_URL__
 * - __VOCODER_CDN_URL__
 * - __VOCODER_BUILD_TS__
 *
 * If the unplugin is not installed, these constants are undefined and
 * background refresh is silently disabled.
 *
 * Delivery strategy:
 *   1. Fetch directly from the CDN, utilizing the standard HTTP `If-Modified-Since`
 *      header for conditional requests. Cloudflare R2 automatically returns 304 Not Modified
 *      responses based on the object's `Last-Modified` timestamp.
 *   2. Otherwise: fall back to the Vocoder API (`/api/t/:fingerprint/:locale`).
 *   3. If the CDN request fails (network error, unexpected status): transparently
 *      retry via the API so end users are never left without translations.
 */

declare const __VOCODER_FINGERPRINT__: string | undefined;
declare const __VOCODER_API_URL__: string | undefined;
declare const __VOCODER_CDN_URL__: string | undefined;
declare const __VOCODER_BUILD_TS__: number | undefined;

// Define constants injected by @vocoder/plugin (Vite, webpack).
// Fall back to process.env.* for Next.js Turbopack which doesn't apply DefinePlugin.
// Use || null so empty string (DefinePlugin default before buildStart runs)
// falls through to the process.env.* injected via next.config.js env field.
const fingerprint =
	(typeof __VOCODER_FINGERPRINT__ !== "undefined"
		? __VOCODER_FINGERPRINT__ || null
		: null) ??
	(typeof process !== "undefined"
		? process.env.VOCODER_FINGERPRINT || null
		: null);
const apiUrl =
	(typeof __VOCODER_API_URL__ !== "undefined"
		? __VOCODER_API_URL__ || null
		: null) ??
	(typeof process !== "undefined" ? process.env.VOCODER_API_URL || null : null) ??
	"https://vocoder.app";
const cdnUrl =
	(typeof __VOCODER_CDN_URL__ !== "undefined"
		? __VOCODER_CDN_URL__ || null
		: null) ??
	(typeof process !== "undefined" ? process.env.VOCODER_CDN_URL || null : null) ??
	"https://t.vocoder.app";
const buildTs =
	(typeof __VOCODER_BUILD_TS__ !== "undefined"
		? __VOCODER_BUILD_TS__ || null
		: null) ??
	(typeof process !== "undefined" && process.env.VOCODER_BUILD_TS
		? Number(process.env.VOCODER_BUILD_TS)
		: null);

/** Whether the build-time constants are available for background refresh. */
export const isRefreshAvailable = fingerprint !== null && (cdnUrl !== null || apiUrl !== null);

const refreshCache = new Map<string, Record<string, string>>();
const checkedLocales = new Set<string>(); // locales confirmed up-to-date (304)
const inflightRequests = new Map<
	string,
	Promise<Record<string, string> | null>
>();

/**
 * Check for updated translations for a specific locale.
 * Returns fresh translations if newer than build time, or null if unchanged.
 *
 * CDN path (preferred): fetches `{cdnUrl}/{fingerprint}/{locale}.json` and sends
 * `If-Modified-Since` so Cloudflare R2 can reply with 304 when the file hasn't
 * changed since the build. Falls back to the API on any CDN error.
 *
 * API path (fallback): fetches `/api/t/{fingerprint}/{locale}?since={buildTs}`
 * which returns 304 when the bundle hasn't changed since the given timestamp.
 */
export async function checkForUpdates(
	locale: string,
): Promise<Record<string, string> | null> {
	if (!isRefreshAvailable || typeof window === "undefined") return null;

	// Return cached result if we already refreshed this locale
	if (refreshCache.has(locale)) return refreshCache.get(locale) ?? null;
	// Already checked — CDN/server confirmed up-to-date
	if (checkedLocales.has(locale)) return null;

	// Deduplicate concurrent requests for the same locale
	const inflight = inflightRequests.get(locale);
	if (inflight) return inflight;

	const promise = (async () => {
		try {
			if (cdnUrl) {
				const result = await fetchFromCDN(locale);
				if (result !== undefined) return result;
				// CDN failed — fall through to API
			}
			return await fetchFromAPI(locale);
		} finally {
			inflightRequests.delete(locale);
		}
	})();

	inflightRequests.set(locale, promise);
	return promise;
}

/**
 * Fetch a locale bundle directly from the CDN.
 *
 * Returns:
 *   - `null`      — CDN confirmed translations are up-to-date (304)
 *   - translations — CDN returned fresh translations (200)
 *   - `undefined` — CDN request failed; caller should fall back to API
 */
async function fetchFromCDN(
	locale: string,
): Promise<Record<string, string> | null | undefined> {
	if (!cdnUrl || !fingerprint) return undefined;

	try {
		const url = `${cdnUrl}/${fingerprint}/${locale}.json`;
		const headers: Record<string, string> = { Accept: "application/json" };

		// Use If-Modified-Since so Cloudflare R2 can serve a native 304 when
		// the bundle file hasn't been updated since this build ran.
		if (buildTs) {
			headers["If-Modified-Since"] = new Date(buildTs).toUTCString();
		}

		const response = await fetch(url, { headers });

		if (response.status === 304) {
			checkedLocales.add(locale);
			return null;
		}
		if (response.status === 404) {
			// Bundle not yet in CDN — fall back to API
			return undefined;
		}
		if (!response.ok) {
			// Unexpected CDN error — fall back to API
			return undefined;
		}

		const translations = (await response.json()) as Record<string, string>;
		refreshCache.set(locale, translations);
		return translations;
	} catch {
		// Network error or parse failure — fall back to API
		return undefined;
	}
}

/**
 * Fetch a locale bundle from the Vocoder API.
 * Supports `?since=<timestamp>` for 304-based freshness checks.
 */
async function fetchFromAPI(
	locale: string,
): Promise<Record<string, string> | null> {
	if (!apiUrl || !fingerprint) return null;

	try {
		const sinceParam = buildTs ? `?since=${buildTs}` : "";
		const url = `${apiUrl}/api/t/${fingerprint}/${locale}${sinceParam}`;

		const response = await fetch(url, {
			headers: { Accept: "application/json" },
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
	}
}
