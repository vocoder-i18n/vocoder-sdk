import type { LocaleSelectorProps } from './types';
import React from 'react';
import { useTranslation } from './TranslationProvider';

export const LocaleSelector: React.FC<LocaleSelectorProps> = ({ 
  className, 
  placeholder = "Select language" 
}) => {
  const { locale, setLocale, translations, isLoading, error } = useTranslation();

  if (isLoading) {
    return (
      <select className={className} disabled>
        <option>Loading...</option>
      </select>
    );
  }

  if (error) {
    return (
      <select className={className} disabled>
        <option>Error loading languages</option>
      </select>
    );
  }

  const availableLocales = Object.keys(translations);

  return (
    <select 
      className={className}
      value={locale} 
      onChange={(e) => setLocale(e.target.value)}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {availableLocales.map((lang) => (
        <option key={lang} value={lang}>
          {lang === 'en' ? 'English' : 
           lang === 'fr' ? 'Français' : 
           lang === 'es' ? 'Español' : 
           lang}
        </option>
      ))}
    </select>
  );
}; 