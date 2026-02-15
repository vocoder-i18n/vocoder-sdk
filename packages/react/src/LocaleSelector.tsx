import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

import { Globe } from 'lucide-react';
import type { LocaleSelectorProps } from './types';
import React from 'react';
import { useVocoder } from './VocoderProvider';

// Position mapping for shorthand
const POSITION_MAP: Record<string, string> = {
  'tl': 'top-left',
  'tr': 'top-right',
  'bl': 'bottom-left',
  'br': 'bottom-right',
};

/**
 * LocaleSelector component provides a globe button with dropdown for switching languages.
 *
 * Features:
 * - Globe icon button that opens a language selector
 * - Configurable position (top-left, top-right, bottom-left, bottom-right)
 * - Customizable colors via props
 * - Smart positioning: opens below for top positions, above for bottom positions
 * - Supports shorthand position notation (tl, tr, bl, br)
 * - Displays locale names in format "displayName (nativeName)" (e.g., "Spanish (Español)")
 * - Uses Intl.DisplayNames for runtime translation of locale names
 * - Configurable sorting: by English names (default), native names, or translated names
 *
 * @example Basic usage (with auto-generated locales from CLI)
 * ```tsx
 * import { LocaleSelector } from '@vocoder/react';
 * import { locales } from './.vocoder/locales';
 *
 * // Sorts by source language (English) by default - consistent order
 * <LocaleSelector locales={locales} />
 * ```
 *
 * @example Sort by native names (consistent across locales)
 * ```tsx
 * <LocaleSelector
 *   locales={locales}
 *   sortBy="native"
 * />
 * // Always shows: العربية, Deutsch, English, Español, Français, etc.
 * ```
 *
 * @example Sort by translated names (changes per viewing locale)
 * ```tsx
 * <LocaleSelector
 *   locales={locales}
 *   sortBy="translated"
 * />
 * // When viewing in Spanish: Alemán, Árabe, Español, Francés, Inglés...
 * // When viewing in English: Arabic, English, French, German, Spanish...
 * ```
 *
 * @example With custom position and colors
 * ```tsx
 * <LocaleSelector
 *   locales={locales}
 *   position="top-left"
 *   background="#1a1a1a"
 *   color="#ffffff"
 *   sortBy="source"
 * />
 * ```
 *
 * @example With shorthand position
 * ```tsx
 * <LocaleSelector locales={locales} position="br" />
 * ```
 *
 * @example Custom locales format
 * ```tsx
 * const customLocales = {
 *   'en': { nativeName: 'English' },
 *   'es': { nativeName: 'Español' },
 *   'ar': { nativeName: 'العربية', dir: 'rtl' }
 * };
 *
 * <LocaleSelector locales={customLocales} />
 * // Displays: "Spanish (Español)" when viewing in English
 * // Displays: "Español (Español)" when viewing in Spanish
 * ```
 */
export const LocaleSelector: React.FC<LocaleSelectorProps> = ({
  position = 'bottom-right',
  background = '#ffffff',
  color = '#000000',
  className = '',
  iconSize = 20,
  locales: localesProp,
  sortBy = 'source',
}) => {
  const { locale, setLocale, availableLocales, getDisplayName, locales: localesFromContext } = useVocoder();

  // Use prop if provided, otherwise fall back to context
  const locales = localesProp ?? localesFromContext;

  // Normalize position (handle shorthand)
  const normalizedPosition = POSITION_MAP[position] || position;

  // Determine dropdown side and align based on position
  const getDropdownProps = () => {
    switch (normalizedPosition) {
      case 'top-left':
        return { side: 'bottom' as const, align: 'start' as const };
      case 'top-right':
        return { side: 'bottom' as const, align: 'end' as const };
      case 'bottom-left':
        return { side: 'top' as const, align: 'start' as const };
      case 'bottom-right':
      default:
        return { side: 'top' as const, align: 'end' as const };
    }
  };

  const { side, align } = getDropdownProps();

  // Sort available locales based on sortBy prop
  const sortedLocales = React.useMemo(() => {
    if (!locales) {
      return availableLocales;
    }

    return [...availableLocales].sort((a: string, b: string) => {
      let nameA: string;
      let nameB: string;
      let compareLocale: string;

      switch (sortBy) {
        case 'native':
          // Sort by native name (consistent across all viewing locales)
          nameA = locales[a]?.nativeName || a;
          nameB = locales[b]?.nativeName || b;
          compareLocale = 'en'; // Use neutral locale for comparison
          break;

        case 'translated':
          // Sort by translated name in current viewing locale (changes per locale)
          nameA = getDisplayName(a);
          nameB = getDisplayName(b);
          compareLocale = locale;
          break;

        case 'source':
        default:
          // Sort by English names (consistent across all viewing locales)
          nameA = getDisplayName(a, 'en');
          nameB = getDisplayName(b, 'en');
          compareLocale = 'en';
          break;
      }

      return nameA.localeCompare(nameB, compareLocale, { sensitivity: 'base' });
    });
  }, [availableLocales, locale, locales, sortBy, getDisplayName]);

  // Fixed positioning styles based on position prop
  const getPositionStyles = (): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      position: 'fixed',
      zIndex: 9999,
    };

    switch (normalizedPosition) {
      case 'top-left':
        return { ...baseStyles, top: '20px', left: '20px' };
      case 'top-right':
        return { ...baseStyles, top: '20px', right: '20px' };
      case 'bottom-left':
        return { ...baseStyles, bottom: '20px', left: '20px' };
      case 'bottom-right':
      default:
        return { ...baseStyles, bottom: '20px', right: '20px' };
    }
  };

  const buttonStyles: React.CSSProperties = {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    backgroundColor: background,
    color: color,
    border: '1px solid rgba(0, 0, 0, 0.1)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    transition: 'all 0.2s ease',
  };

  const contentStyles: React.CSSProperties = {
    backgroundColor: background,
    borderRadius: '8px',
    padding: '8px',
    minWidth: '200px',
    maxHeight: '400px',
    overflowY: 'auto',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    zIndex: 10000,
  };

  const itemStyles: React.CSSProperties = {
    padding: '10px 12px',
    cursor: 'pointer',
    borderRadius: '4px',
    fontSize: '14px',
    color: color,
    outline: 'none',
    userSelect: 'none',
    transition: 'background-color 0.15s ease',
  };

  return (
    <div style={getPositionStyles()} className={className}>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            style={buttonStyles}
            onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
            }}
            onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
            }}
            aria-label="Select language"
          >
            <Globe size={iconSize} />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            style={contentStyles}
            side={side}
            align={align}
            sideOffset={8}
          >
            {sortedLocales.map((lang: string) => {
              const isActive = lang === locale;
              return (
                <DropdownMenu.Item
                  key={lang}
                  style={{
                    ...itemStyles,
                    fontWeight: isActive ? '600' : '400',
                    backgroundColor: isActive ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
                  }}
                  onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.03)';
                    }
                  }}
                  onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                  onSelect={() => setLocale(lang)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>
                      {locales?.[lang]
                        ? `${getDisplayName(lang)} (${locales[lang]!.nativeName})`
                        : lang.toUpperCase()}
                    </span>
                    {isActive && (
                      <span style={{ marginLeft: '8px', fontSize: '12px' }}>✓</span>
                    )}
                  </div>
                </DropdownMenu.Item>
              );
            })}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
};
