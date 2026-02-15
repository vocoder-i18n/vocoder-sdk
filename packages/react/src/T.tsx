import React from 'react';
import type { TProps } from './types';
import { extractText } from './utils/extractText';
import { formatMessage } from './utils/formatMessage';
import { useVocoder } from './VocoderProvider';

/**
 * T component marks text as translatable.
 *
 * Supports three levels of complexity:
 * - Phase 1: Simple variable interpolation
 * - Phase 2: ICU MessageFormat for pluralization
 * - Phase 3: Rich text with component placeholders
 *
 * @example Simple variables
 * ```tsx
 * <T>Welcome to our app!</T>
 * <T name="John">Hello, {name}!</T>
 * <T count={5}>You have {count} messages</T>
 * ```
 *
 * @example ICU MessageFormat with msg prop (cleaner syntax)
 * ```tsx
 * <T msg="{count, plural, =0 {No items} one {# item} other {# items}}" count={0} />
 * <T msg="{count, plural, =0 {No items} one {# item} other {# items}}" count={5} />
 * ```
 *
 * @example ICU MessageFormat with children (legacy, requires escaping)
 * ```tsx
 * <T count={0}>{"{count, plural, =0 {No items} one {# item} other {# items}}"}</T>
 * ```
 *
 * @example Rich text with components
 * ```tsx
 * <T components={{ link: <a href="/help">link</a> }}>
 *   Click <link>here</link> for help
 * </T>
 * ```
 */
export const T: React.FC<TProps> = ({
  children,
  msg,
  context,
  formality,
  components,
  ...values
}) => {
  const { t, locale } = useVocoder();

  try {
    // Extract source text - prefer msg prop over children
    // msg prop is cleaner for ICU syntax (no JSX escaping needed)
    const sourceText = msg || extractText(children);

    // Look up translation using source text as key
    const translatedText = t(sourceText);

    // Prepare values for FormatJS
    // Convert component elements to FormatJS function format
    const formatValues: Record<string, any> = { ...values };
    
    if (components) {
      Object.entries(components).forEach(([key, component]) => {
        // FormatJS expects functions that receive chunks and return React elements
        formatValues[key] = (chunks: any[]) => 
          React.cloneElement(component, { key }, chunks);
      });
    }

    // Use IntlMessageFormat for ALL cases:
    // - Simple interpolation: "Hello {name}!" → "Hello John!"
    // - ICU plurals/select: "{count, plural, ...}" → "5 items"
    // - Rich text: "Click <link>here</link>" → ["Click ", <a>here</a>]
    const result = formatMessage(translatedText, formatValues, locale);

    // Return formatted result (can be string or React nodes)
    return <>{result}</>;
  } catch (err) {
    console.error('Vocoder formatting error:', err);
    // On error, fall back to original children
    return <>{children}</>;
  }
};

// DisplayName for React DevTools
T.displayName = 'Vocoder.T';
