import { generateMessageHash } from "./hash";
import type { TOptions } from "./types";
import { formatICU } from "./utils/formatMessage";

/**
 * Global translation state
 * This is synced by VocoderProvider and can be used anywhere
 */
let globalTranslations: Record<string, Record<string, string>> = {};
let globalLocale: string = "en";
let globalSourceLocale: string = "";

/**
 * Set global translations (called by VocoderProvider)
 * @internal
 */
export function _setGlobalTranslations(
	translations: Record<string, Record<string, string>>,
): void {
	globalTranslations = translations;
}

/**
 * Set global locale (called by VocoderProvider)
 * @internal
 */
export function _setGlobalLocale(locale: string): void {
	globalLocale = locale;
}

/**
 * Set source locale (called by VocoderProvider on mount)
 * @internal
 */
export function _setSourceLocale(locale: string): void {
	globalSourceLocale = locale;
}

/**
 * Translate text using global translations
 * Can be used outside React components (utilities, services, etc.)
 *
 * Supports:
 * - Simple variable interpolation: `t('Hello {name}', { name: 'John' })`
 * - ICU MessageFormat: `t('{count, plural, one {# item} other {# items}}', { count: 5 })`
 *
 * @param text - Source text to translate
 * @param values - Optional values for variable interpolation
 * @returns Translated text with interpolated variables
 *
 * @example Simple variables
 * ```tsx
 * import { t } from '@vocoder/react';
 *
 * const message = t('Hello, world!');
 * const greeting = t('Hello, {name}!', { name: 'John' });
 * ```
 *
 * @example ICU MessageFormat (pluralization)
 * ```tsx
 * const items = t('{count, plural, =0 {No items} one {# item} other {# items}}', { count: 5 });
 * // "5 items"
 *
 * const items = t('{count, plural, =0 {No items} one {# item} other {# items}}', { count: 1 });
 * // "1 item"
 * ```
 *
 * @remarks
 * - This function uses global state synced by VocoderProvider
 * - Make sure VocoderProvider is mounted before using this function
 * - For reactive translations in components, use the `<T>` component or `useVocoder()` hook
 * - Rich text with components is only supported in `<T>` component, not in `t()` function
 */
export function t(text: string, values?: Record<string, any>, options?: TOptions): string {
	const { context, id } = options ?? {};
	const hash = id ?? generateMessageHash(text, context);
	const localeTranslations = globalTranslations[globalLocale];
	const hasTranslation =
		!!localeTranslations && Object.prototype.hasOwnProperty.call(localeTranslations, hash);

	if (!hasTranslation) {
		if (
			process.env.NODE_ENV === "development" &&
			globalSourceLocale &&
			globalLocale !== globalSourceLocale
		) {
			console.warn(
				`[vocoder] Missing translation for locale "${globalLocale}": "${text.length > 60 ? `${text.slice(0, 60)}…` : text}"`,
			);
		}
		return text;
	}

	const translated = localeTranslations![hash];

	if (values && Object.keys(values).length > 0) {
		// Use IntlMessageFormat for all cases (simple interpolation, ICU, etc.)
		return formatICU(translated, values, globalLocale);
	}

	return translated;
}
