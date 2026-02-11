import IntlMessageFormat from 'intl-messageformat';

/**
 * Check if text contains ICU MessageFormat syntax
 * Examples: {count, plural, ...}, {value, select, ...}, {date, date, short}
 */
export function isICUMessage(text: string): boolean {
  // Check for ICU syntax patterns
  return /\{[\w]+,\s*(plural|select|selectordinal|number|date|time)/.test(text);
}

/**
 * Format a message using ICU MessageFormat syntax
 * Supports pluralization, select, date/time formatting, etc.
 *
 * @param text - ICU MessageFormat string
 * @param values - Values for interpolation
 * @param locale - Locale for formatting rules
 * @returns Formatted string
 *
 * @example
 * ```ts
 * formatICUMessage(
 *   '{count, plural, =0 {No items} one {# item} other {# items}}',
 *   { count: 5 },
 *   'en'
 * ) // "5 items"
 * ```
 */
export function formatICUMessage(
  text: string,
  values: Record<string, any>,
  locale: string = 'en'
): string {
  try {
    // IntlMessageFormat expects lowercase locale codes (es, en, fr, etc.)
    const normalizedLocale = locale.toLowerCase();
    const msg = new IntlMessageFormat(text, normalizedLocale);
    const result = msg.format(values);

    // IntlMessageFormat can return string or array of parts
    if (typeof result === 'string') {
      return result;
    }

    // If it's an array, join the parts
    if (Array.isArray(result)) {
      return result.join('');
    }

    return String(result);
  } catch (error) {
    console.error('ICU MessageFormat error:', error);
    // Fallback to original text on error
    return text;
  }
}
