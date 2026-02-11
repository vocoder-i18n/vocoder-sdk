import { formatICUMessage, isICUMessage } from './utils/formatMessage';
import { hasComponentPlaceholders, parseRichText } from './utils/parseRichText';

import React from 'react';
import type { TProps } from './types';
import { extractText } from './utils/extractText';
import { interpolate } from './utils/interpolate';
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
 * @example ICU MessageFormat (pluralization)
 * ```tsx
 * <T count={0}>{count, plural, =0 {No items} one {# item} other {# items}}</T>
 * <T count={5}>{count, plural, =0 {No items} one {# item} other {# items}}</T>
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
  context,
  formality,
  components,
  ...values
}) => {
  const { t, locale, isLoading, error } = useVocoder();

  // Handle loading state
  if (isLoading) {
    // During loading, show the source text
    return <>{children}</>;
  }

  // Handle error state - fallback to source text
  if (error) {
    console.warn('Vocoder translation error:', error);
    return <>{children}</>;
  }

  try {
    // Extract source text from children (this becomes the translation key)
    const sourceText = extractText(children);

    // Look up translation using source text as key
    let translatedText = t(sourceText);

    // Phase 2: Check if text uses ICU MessageFormat syntax
    const isICU = isICUMessage(translatedText);

    if (isICU) {
      try {
        const formatted = formatICUMessage(translatedText, values, locale);
        translatedText = formatted;
      } catch (error) {
        console.error('[T Component] ICU format error:', error);
      }
    }
    // Phase 1: Simple variable interpolation
    else if (Object.keys(values).length > 0) {
      translatedText = interpolate(translatedText, values);
    }

    // Phase 3: Check if text has component placeholders
    if (components && hasComponentPlaceholders(translatedText)) {
      const richTextParts = parseRichText(translatedText, components);
      return <>{richTextParts}</>;
    }

    // Return plain translated text
    return <>{translatedText}</>;
  } catch (err) {
    console.error('Vocoder formatting error:', err);
    // On error, fall back to original children
    return <>{children}</>;
  }
};

// DisplayName for React DevTools
T.displayName = 'Vocoder.T';
