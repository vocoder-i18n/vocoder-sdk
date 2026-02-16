import IntlMessageFormat from 'intl-messageformat';
import React from 'react';

/**
 * Resolve a locale to its default ISO 4217 currency code.
 * Uses Intl.NumberFormat to detect what currency the runtime associates with the locale.
 * Falls back to 'USD' if detection fails.
 */
/**
 * Universal message formatter using IntlMessageFormat
 * Handles all cases: simple interpolation, ICU plurals/select, and rich text with components
 *
 * @param text - Message string (can be simple or ICU MessageFormat)
 * @param values - Values for interpolation (strings, numbers, or React component functions)
 * @param locale - Locale for formatting rules
 * @returns Formatted result (string or React nodes)
 *
 * @example Simple interpolation
 * ```ts
 * formatMessage("Hello {name}!", { name: "John" }, "en")
 * // → "Hello John!"
 * ```
 *
 * @example ICU plural
 * ```ts
 * formatMessage("{count, plural, one {# item} other {# items}}", { count: 5 }, "en")
 * // → "5 items"
 * ```
 *
 * @example Rich text with components
 * ```ts
 * formatMessage(
 *   "Click <link>here</link> for help",
 *   { link: (chunks) => <a href="/help">{chunks}</a> },
 *   "en"
 * )
 * // → ["Click ", <a href="/help">here</a>, " for help"]
 * ```
 */
export function formatMessage(
  text: string,
  values: Record<string, any>,
  locale: string = 'en'
): string | React.ReactNode[] {
  try {
    // IntlMessageFormat expects lowercase locale codes
    const normalizedLocale = locale.toLowerCase();
    const msg = new IntlMessageFormat(text, normalizedLocale);
    const result = msg.format(values);

    // CRITICAL FIX: IntlMessageFormat.format() can return an array of parts.
    // When React renders an array directly (e.g., ["Tienes ", 1, " mensajes"]),
    // whitespace between elements gets collapsed: "Tienes1mensajes".
    // Solution: Join arrays to strings when no React components are involved.
    if (Array.isArray(result)) {
      // Check if any values are React components (functions or elements)
      const hasComponents = Object.values(values).some(
        v => typeof v === 'function' || React.isValidElement(v)
      );

      if (!hasComponents) {
        // No components - join array to single string to preserve whitespace
        return result.join('');
      }
    }

    // Return as-is for component cases or string results
    return result as any;
  } catch (error) {
    console.error('FormatJS formatting error:', error);
    // Fallback to original text on error
    return text;
  }
}

/**
 * Check if text contains ICU MessageFormat syntax
 * Examples: {count, plural, ...}, {value, select, ...}, {date, date, short}
 */
export function isICUMessage(text: string): boolean {
  return /\{[\w]+,\s*(plural|select|selectordinal|number|date|time)/.test(text);
}
