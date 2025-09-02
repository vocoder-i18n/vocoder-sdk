import React from 'react';
import type { TranslationProps } from './types';
import { useTranslation } from './TranslationProvider';

// Simple message formatter without react-intl
const formatMessage = (template: string, values: Record<string, any>): string => {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return values[key] !== undefined ? String(values[key]) : match;
  });
};

export const Translation: React.FC<TranslationProps> = ({ 
  id, 
  text, 
  ...values 
}) => {
  const { locale, translations, isLoading, error } = useTranslation();

  if (isLoading) {
    return <span>Loading...</span>;
  }

  if (error) {
    return <span>Translation error</span>;
  }

  // Get the translation template from the current locale
  const template = translations[locale]?.[id] || text || id;

  try {
    // Format the message with the provided values
    const result = formatMessage(template, values);
    return <>{result}</>;
  } catch (err) {
    console.error('Translation formatting error:', err);
    return <span>{template}</span>;
  }
}; 