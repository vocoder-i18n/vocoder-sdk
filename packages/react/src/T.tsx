import React from 'react';
import type { TProps } from './types';
import { extractText } from './utils/extractText';
import { formatMessage } from './utils/formatMessage';
import { useVocoder } from './VocoderProvider';

/** Translate and format message text in JSX. */
export const T: React.FC<TProps> = ({
  children,
  msg,
  context,
  formality,
  components,
  ...values
}) => {
  const { t, locale, hasTranslation } = useVocoder();

  try {
    const sourceText = msg || extractText(children);

    if (!hasTranslation(sourceText)) {
      return <>{msg ?? children}</>;
    }

    const translatedText = t(sourceText);

    const formatValues: Record<string, any> = { ...values };

    if (components) {
      Object.entries(components).forEach(([key, component]) => {
        formatValues[key] = (chunks: any[]) =>
          React.cloneElement(component, { key }, chunks);
      });
    }

    const result = formatMessage(translatedText, formatValues, locale);
    return <>{result}</>;
  } catch (err) {
    console.error('Vocoder formatting error:', err);
    return <>{children}</>;
  }
};

T.displayName = 'Vocoder.T';
