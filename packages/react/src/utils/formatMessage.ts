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
    const normalizedLocale = locale.toLowerCase();
    const msg = new IntlMessageFormat(text, normalizedLocale);
    const result = msg.format(values);

    if (Array.isArray(result)) {
      const hasComponents = Object.values(values).some(
        v => typeof v === 'function' || React.isValidElement(v)
      );

      if (!hasComponents) {
        return result.join('');
      }
    }

    return result as any;
  } catch (error) {
    console.error('FormatJS formatting error:', error);
    return text;
  }
}
