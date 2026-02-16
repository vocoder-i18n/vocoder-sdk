import { formatMessage } from './utils/formatMessage';

/**
 * Global translation state
 * This is synced by VocoderProvider and can be used anywhere
 */
let globalTranslations: Record<string, Record<string, string>> = {};
let globalLocale: string = 'en';

/**
 * Set global translations (called by VocoderProvider)
 * @internal
 */
export function _setGlobalTranslations(translations: Record<string, Record<string, string>>): void {
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
 * Get current global locale
 * @internal
 */
export function _getGlobalLocale(): string {
  return globalLocale;
}

/**
 * Get global translations
 * @internal
 */
export function _getGlobalTranslations(): Record<string, Record<string, string>> {
  return globalTranslations;
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
export function t(text: string, values?: Record<string, any>): string {
  const localeTranslations = globalTranslations[globalLocale];
  const hasTranslation =
    !!localeTranslations &&
    Object.prototype.hasOwnProperty.call(localeTranslations, text);

  if (!hasTranslation) {
    return text;
  }

  const translated = localeTranslations![text];

  if (values && Object.keys(values).length > 0) {
    // Use IntlMessageFormat for all cases (simple interpolation, ICU, etc.)
    const result = formatMessage(translated, values, globalLocale);
    
    // formatMessage can return React nodes for rich text, but t() is for strings only
    // If result is an array (rich text), join it as string
    if (Array.isArray(result)) {
      return result.map(part => 
        typeof part === 'string' ? part : String(part)
      ).join('');
    }
    
    return typeof result === 'string' ? result : String(result);
  }

  return translated;
}

/**
 * Alias for t() function
 */
export const translate = t;
