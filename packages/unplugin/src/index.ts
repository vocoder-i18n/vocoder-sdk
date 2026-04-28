import { createUnplugin } from 'unplugin';
import type { VocoderPluginOptions, VocoderTranslationData } from './types';
import {
  computeFingerprint,
  extractSourceTexts,
  fetchTranslations,
  loadEnvFile,
} from './core';

export type { VocoderPluginOptions, VocoderTranslationData };
export { computeFingerprint, detectBranch, detectCommitSha, detectRepoIdentity } from './core';

const VIRTUAL_PREFIX = 'virtual:vocoder/';
const STRIPPED_PREFIX = 'vocoder/';
const RESOLVED_PREFIX = '\0virtual:vocoder/';

export const unplugin = createUnplugin((_options: VocoderPluginOptions | undefined = {}) => {
  // Load .env before reading env vars — build plugins run before bundler's own .env loading
  loadEnvFile();

  const apiUrl = process.env.VOCODER_API_URL ?? 'https://vocoder.app';

  let fingerprint: string;
  let data: VocoderTranslationData | null = null;
  let initPromise: Promise<void> | null = null;

  function init(): Promise<void> {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      // VOCODER_FINGERPRINT: manual escape hatch for unusual environments.
      if (process.env.VOCODER_FINGERPRINT) {
        fingerprint = process.env.VOCODER_FINGERPRINT;
        console.log(`[vocoder] Using fingerprint from VOCODER_FINGERPRINT env var → ${fingerprint}`);
        data = await fetchTranslations(fingerprint, apiUrl);
        return;
      }

      const apiKey = process.env.VOCODER_API_KEY ?? '';
      const shortCode = apiKey.startsWith('vcp_') ? apiKey.slice(4, 14) : null;

      if (!shortCode) {
        console.warn('[vocoder] VOCODER_API_KEY missing or not a project key (vcp_...). Translations not loaded.');
        data = { config: { sourceLocale: '', targetLocales: [], locales: {} }, translations: {}, updatedAt: null };
        return;
      }

      const sourceTexts = await extractSourceTexts(process.cwd());
      fingerprint = computeFingerprint(shortCode, sourceTexts);
      console.log(`[vocoder] ${sourceTexts.length} string(s) → fingerprint ${fingerprint}`);

      data = await fetchTranslations(fingerprint, apiUrl);

      if (data.config.sourceLocale) {
        const localeCount = data.config.targetLocales.length;
        const stringCount = Object.values(data.translations)
          .reduce((sum: number, t: Record<string, string>) => sum + Object.keys(t).length, 0);
        console.log(`[vocoder] Loaded ${localeCount} locale(s), ${stringCount} translation(s)`);
      } else {
        console.log('[vocoder] No translations available yet — source text will be shown.');
      }
    })();
    return initPromise;
  }

  function getDefineValues(): Record<string, string> {
    return {
      __VOCODER_FINGERPRINT__: JSON.stringify(fingerprint ?? ''),
      __VOCODER_API_URL__: JSON.stringify(apiUrl),
      __VOCODER_BUILD_TS__: JSON.stringify(Date.now()),
    };
  }

  return {
    name: 'vocoder',
    enforce: 'pre' as const,

    async buildStart() {
      await init();
    },

    resolveId(id: string) {
      if (id.startsWith(VIRTUAL_PREFIX)) {
        return RESOLVED_PREFIX + id.slice(VIRTUAL_PREFIX.length);
      }
      if (id.startsWith(STRIPPED_PREFIX)) {
        return RESOLVED_PREFIX + id.slice(STRIPPED_PREFIX.length);
      }
      return null;
    },

    async load(id: string) {
      if (!id.startsWith(RESOLVED_PREFIX)) return null;

      await init();
      if (!data) return null;

      const path = id.slice(RESOLVED_PREFIX.length);

      if (path === 'manifest') {
        return generateManifestModule(data);
      }

      if (path.startsWith('translations/')) {
        const locale = path.slice('translations/'.length);
        const translations = data.translations[locale] ?? {};
        return `export default ${JSON.stringify(translations)};`;
      }

      return null;
    },

    vite: {
      async config() {
        await init();
        return { define: getDefineValues() };
      },
    },

    webpack(compiler) {
      try {
        const wp = require('webpack');
        new wp.DefinePlugin(getDefineValues()).apply(compiler);
      } catch {
        // Not in a webpack environment — skip
      }
    },
  };
});

function generateManifestModule(data: VocoderTranslationData): string {
  const { config, translations } = data;

  const loaderEntries = Object.keys(translations)
    .map((locale: string) => `  ${JSON.stringify(locale)}: () => import("virtual:vocoder/translations/${locale}")`)
    .join(',\n');

  return [
    `export const config = ${JSON.stringify(config)};`,
    '',
    `export const loaders = {`,
    loaderEntries,
    `};`,
  ].join('\n');
}

export default unplugin;
