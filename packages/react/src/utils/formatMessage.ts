import IntlMessageFormat from 'intl-messageformat';
import React from 'react';

/**
 * Universal message formatter using IntlMessageFormat
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
