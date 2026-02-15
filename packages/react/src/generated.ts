/**
 * Auto-loader for generated translations (new split-file architecture)
 *
 * When users run `npx vocoder sync`, the CLI writes:
 * - config.js: Locale metadata and available locales
 * - en.js, es.js, etc.: Individual translation files per locale
 *
 * Loading strategy:
 * 1. Load config immediately (tiny, always needed)
 * 2. Load initial locale synchronously (for SSR + fast first paint)
 * 3. Lazy load other locales on demand (async imports)
 *
 * Initial locale selection priority:
 * 1. Cookie preference (vocoder-locale)
 * 2. localStorage preference (vocoder-locale)
 * 3. Source locale from config
 */

import type { LocalesMap, TranslationsMap } from './types';

interface VocoderConfig {
  sourceLocale: string;
  targetLocales: string[];
  locales: LocalesMap;
}

const emptyConfig: VocoderConfig = {
  sourceLocale: '',
  targetLocales: [],
  locales: {},
};

let _config: VocoderConfig = emptyConfig;
let _loadedTranslations: TranslationsMap = {};
let _initialLocale: string = '';

// Load config immediately
try {
  _config = require('.vocoder/config');
} catch {
  // Not generated yet - will fall back to source text
}

// Determine initial locale to load synchronously
function getInitialLocale(): string {
  if (!_config.sourceLocale) {
    return ''; // No config loaded
  }

  // Check cookie (SSR-compatible)
  if (typeof document !== 'undefined') {
    const cookieMatch = document.cookie.match(/vocoder-locale=([^;]+)/);
    const cookieLocale = cookieMatch?.[1];
    if (cookieLocale && _config.locales[cookieLocale]) {
      return cookieLocale;
    }
  }

  // Check localStorage (client-side only)
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const storageLocale = localStorage.getItem('vocoder-locale');
      if (storageLocale && _config.locales[storageLocale]) {
        return storageLocale;
      }
    } catch {
      // localStorage might be blocked
    }
  }

  // Fall back to source locale
  return _config.sourceLocale;
}

// Load initial locale synchronously (for SSR)
_initialLocale = getInitialLocale();
if (_initialLocale) {
  try {
    const translations = require(`.vocoder/${_initialLocale}`);
    _loadedTranslations[_initialLocale] = translations;
  } catch {
    // File not found - fall back to empty
  }
}

/**
 * Get configuration (locale metadata + available locales)
 */
export function getGeneratedConfig(): VocoderConfig {
  return _config;
}

/**
 * Get all loaded translations (initially just source locale + user preference)
 */
export function getGeneratedTranslations(): TranslationsMap {
  return _loadedTranslations;
}

/**
 * Get locale metadata
 */
export function getGeneratedLocales(): LocalesMap {
  return _config.locales;
}

/**
 * Check if any translations are loaded
 */
export function hasGeneratedData(): boolean {
  return Object.keys(_loadedTranslations).length > 0;
}

/**
 * Lazy load a locale's translations (async)
 * Use this when user switches to a new locale
 */
export async function loadLocale(locale: string): Promise<Record<string, string>> {
  // Already loaded?
  if (_loadedTranslations[locale]) {
    return _loadedTranslations[locale]!;
  }

  // Load the locale file
  try {
    // Use dynamic import for code splitting
    const translations = await import(`.vocoder/${locale}`);
    _loadedTranslations[locale] = translations.default || translations;
    return _loadedTranslations[locale]!;
  } catch (error) {
    console.error(`Failed to load translations for locale: ${locale}`, error);
    return {};
  }
}

/**
 * Preload a locale in the background (don't wait for it)
 */
export function preloadLocale(locale: string): void {
  if (_loadedTranslations[locale]) {
    return; // Already loaded
  }

  // Fire and forget
  loadLocale(locale).catch(() => {
    // Ignore errors - it's just a preload
  });
}
