/**
 * Runtime loading for translation manifest and locale modules.
 *
 * Translations are injected as virtual modules by @vocoder/unplugin at build
 * time.  The plugin creates `virtual:vocoder/manifest` (config + per-locale
 * dynamic-import loaders) and `virtual:vocoder/translations/<locale>` modules
 * which the bundler code-splits automatically.
 *
 * If the unplugin is not installed the SDK starts with empty translations and
 * falls back to rendering source text.
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

function applyManifest(mod: any): void {
  const manifest = (mod?.default ?? mod) as VocoderManifest;
  if (manifest?.config) _config = manifest.config;
  if (manifest?.loaders) _loaders = manifest.loaders;
  _manifestLoaded = true;
}

// Server: load manifest synchronously at module init via CJS require.
try {
  if (typeof window === 'undefined' && typeof require !== 'undefined') {
    applyManifest(require('virtual:vocoder/manifest'));
  }
} catch {
  // Unplugin not installed — translations will be empty until loaded.
}

// Client: load manifest asynchronously via ESM import.
let _manifestLoadPromise: Promise<void> | null = null;

async function loadManifest(): Promise<void> {
  if (_manifestLoaded) return;
  if (_manifestLoadPromise) return _manifestLoadPromise;

  _manifestLoadPromise = import('virtual:vocoder/manifest')
    .then(applyManifest)
    .catch(() => {})
    .finally(() => { _manifestLoadPromise = null; });

  return _manifestLoadPromise;
}

// Server: eagerly load the initial locale at module init.
if (typeof window === 'undefined' && _manifestLoaded) {
  const initialLocale = getInitialLocale();
  if (initialLocale && _loaders[initialLocale]) {
    try {
      const mod = _loaders[initialLocale]!();
      const translations = (mod as any)?.default ?? mod;
      if (translations && typeof translations === 'object') {
        _loadedTranslations[initialLocale] = translations;
      }
    } catch {
      // Keep empty translations for this locale.
    }
  }
}

function getInitialLocale(): string {
  if (!_config.sourceLocale) return '';

  if (typeof document !== 'undefined') {
    const cookieMatch = document.cookie.match(/vocoder_locale=([^;]+)/);
    const cookieLocale = cookieMatch?.[1];
    if (cookieLocale && _config.locales[cookieLocale]) {
      return cookieLocale;
    }
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const storageLocale = localStorage.getItem('vocoder_locale');
      if (storageLocale && _config.locales[storageLocale]) {
        return storageLocale;
      }
    } catch {
      // Ignore blocked storage access.
    }
  }

  return _config.sourceLocale;
}

/** Initialize manifest and initial locale on the client. */
export async function initializeVocoder(): Promise<void> {
  await loadManifest();
  if (!_config.sourceLocale) return;

  const initialLocale = getInitialLocale();
  if (initialLocale && !_loadedTranslations[initialLocale]) {
    await loadLocale(initialLocale);
  }
}

export function getConfig(): VocoderConfig {
  return _config;
}

export function getTranslations(): TranslationsMap {
  return _loadedTranslations;
}

export function getLocales(): LocalesMap {
  return _config.locales;
}

/** Load locale translations via manifest loader. */
export async function loadLocale(locale: string): Promise<Record<string, string>> {
  if (_loadedTranslations[locale]) {
    return _loadedTranslations[locale]!;
  }

  if (!_manifestLoaded) {
    await loadManifest();
  }

  const loader = _loaders[locale];
  if (loader) {
    try {
      const mod = await Promise.resolve(loader());
      const translations = mod?.default ?? mod;
      _loadedTranslations[locale] = translations || {};
      return _loadedTranslations[locale]!;
    } catch (error) {
      console.error(`Failed to load translations for locale: ${locale}`, error);
    }
  }

  return {};
}

/** Load a locale synchronously on the server via CJS loader. */
export function loadLocaleSync(locale: string): Record<string, string> | null {
  if (typeof window !== 'undefined') return null;
  if (_loadedTranslations[locale]) return _loadedTranslations[locale]!;
  if (!_manifestLoaded) return null;

  const loader = _loaders[locale];
  if (!loader) return null;

  try {
    const mod = loader();
    if ((mod as any)?.then) return null; // Async loader, can't use sync
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
