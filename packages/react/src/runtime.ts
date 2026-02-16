/**
 * Auto-loader for generated translations (new split-file architecture)
 *
 * When users run `pnpm exec vocoder sync`, the CLI writes:
 * - node_modules/@vocoder/generated/manifest.mjs: ESM manifest with locale loaders
 * - node_modules/@vocoder/generated/manifest.cjs: CJS manifest for SSR/Node
 * - node_modules/@vocoder/generated/en.js, es.js, etc.: Locale files
 *
 * Loading strategy:
 * 1. Load config immediately if available (SSR/Node.js)
 * 2. Load ESM manifest in the browser to discover locales + loaders
 * 3. Load initial locale synchronously on server, async on client
 * 4. Lazy load other locales on demand (async imports)
 *
 * Initial locale selection priority:
 * 1. Cookie preference (vocoder_locale)
 * 2. localStorage preference (vocoder_locale)
 * 3. Source locale from config
 */

import type { LocalesMap, TranslationsMap } from './types';

interface VocoderConfig {
  sourceLocale: string;
  targetLocales: string[];
  locales: LocalesMap;
}

interface VocoderManifest {
  config: VocoderConfig;
  loaders: Record<string, () => any>;
}

const emptyConfig: VocoderConfig = {
  sourceLocale: '',
  targetLocales: [],
  locales: {},
};

let _config: VocoderConfig = emptyConfig;
let _loadedTranslations: TranslationsMap = {};
let _loaders: Record<string, () => any> = {};
let _manifestLoaded = false;
let _manifestLoadPromise: Promise<VocoderManifest | null> | null = null;

// Load manifest immediately in Node.js/SSR (CJS)
try {
  if (typeof window === 'undefined' && typeof require !== 'undefined') {
    const mod = require('@vocoder/generated/manifest.cjs');
    const manifest = (mod?.default ?? mod) as VocoderManifest;

    if (manifest?.config) {
      _config = manifest.config;
    }
    if (manifest?.loaders) {
      _loaders = manifest.loaders;
    }

    _manifestLoaded = true;
  }
} catch {
  // Not generated yet - will fall back to source text
}

// Lazy-load ESM manifest (client + bundlers)
async function loadManifest(): Promise<VocoderManifest | null> {
  if (_manifestLoaded) {
    return _config.sourceLocale ? { config: _config, loaders: _loaders } : null;
  }
  if (_manifestLoadPromise) {
    return _manifestLoadPromise;
  }

  _manifestLoadPromise = (async () => {
    try {
      const mod = await import('@vocoder/generated/manifest');
      const manifest = (mod.default ?? mod) as VocoderManifest;

      if (manifest?.config) {
        _config = manifest.config;
      }
      if (manifest?.loaders) {
        _loaders = manifest.loaders;
      }
      _manifestLoaded = true;

      return manifest;
    } catch {
      return null;
    } finally {
      _manifestLoadPromise = null;
    }
  })();

  return _manifestLoadPromise;
}

// Determine initial locale to load synchronously
function getInitialLocale(): string {
  if (!_config.sourceLocale) {
    return ''; // No config loaded
  }

  // Check cookie (SSR-compatible)
  if (typeof document !== 'undefined') {
    const cookieMatch = document.cookie.match(/vocoder_locale=([^;]+)/);
    const cookieLocale = cookieMatch?.[1];
    if (cookieLocale && _config.locales[cookieLocale]) {
      return cookieLocale;
    }
  }

  // Check localStorage (client-side only)
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const storageLocale = localStorage.getItem('vocoder_locale');
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

// Load initial locale synchronously (for SSR/Node.js only)
// In browser/Vite, this will be loaded async by VocoderProvider
if (typeof window === 'undefined' && typeof require !== 'undefined') {
  const initialLocale = getInitialLocale();
  if (initialLocale && _loaders[initialLocale]) {
    try {
      const mod = _loaders[initialLocale]!();
      const translations = (mod as any)?.default ?? mod;
      _loadedTranslations[initialLocale] = translations || {};
    } catch {
      // File not found - fall back to empty
    }
  }
}

/**
 * Initialize translations for browser/Vite environments.
 * Loads the manifest, then loads the initial locale async.
 */
export async function initializeVocoder(): Promise<void> {
  await loadManifest();

  if (!_config.sourceLocale) return;

  const initialLocale = getInitialLocale();
  if (initialLocale && !_loadedTranslations[initialLocale]) {
    await loadLocale(initialLocale);
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
 * Lazy load a locale's translations (async)
 * Use this when user switches to a new locale
 *
 * Loading strategy:
 * - Browser: Use manifest-provided dynamic imports for code-split locale chunks
 * - Node.js/SSR: Use require() for synchronous module loading
 */
export async function loadLocale(locale: string): Promise<Record<string, string>> {
  // Already loaded?
  if (_loadedTranslations[locale]) {
    return _loadedTranslations[locale]!;
  }

  if (!_manifestLoaded) {
    await loadManifest();
  }

  // Prefer manifest loaders (client/bundler-friendly)
  if (_loaders[locale]) {
    try {
      const mod = _loaders[locale]!();
      const resolved = (mod as any)?.then ? await mod : mod;
      const translations = resolved?.default ?? resolved;
      _loadedTranslations[locale] = translations || {};
      return _loadedTranslations[locale]!;
    } catch (error) {
      console.error(`Failed to load translations via manifest for locale: ${locale}`, error);
    }
  }

  console.error(`Failed to load translations for locale: ${locale} - no loader available`);
  return {};
}

/**
 * Synchronously load a locale in Node.js/SSR using CJS manifest loaders.
 * Returns null if not available or if used in the browser.
 */
export function loadLocaleSync(locale: string): Record<string, string> | null {
  if (typeof window !== 'undefined') return null;
  if (_loadedTranslations[locale]) return _loadedTranslations[locale]!;
  if (!_manifestLoaded && typeof require !== 'undefined') {
    try {
      const mod = require('@vocoder/generated/manifest.cjs');
      const manifest = (mod?.default ?? mod) as VocoderManifest;
      if (manifest?.config) {
        _config = manifest.config;
      }
      if (manifest?.loaders) {
        _loaders = manifest.loaders;
      }
      _manifestLoaded = true;
    } catch {
      return null;
    }
  }
  if (!_manifestLoaded) return null;
  const loader = _loaders[locale];
  if (!loader) return null;

  try {
    const mod = loader();
    // If loader returns a promise (ESM), we can't sync-load
    if ((mod as any)?.then) return null;
    const translations = (mod as any)?.default ?? mod;
    if (translations && typeof translations === 'object') {
      _loadedTranslations[locale] = translations;
      return _loadedTranslations[locale]!;
    }
  } catch {
    return null;
  }

  return null;
}
