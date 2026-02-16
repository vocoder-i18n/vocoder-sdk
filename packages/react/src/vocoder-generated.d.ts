declare module '@vocoder/generated/manifest' {
  import type { LocalesMap } from './types';
  export const config: {
    sourceLocale: string;
    targetLocales: string[];
    locales: LocalesMap;
  };
  export const loaders: Record<string, () => any>;
}

declare module '@vocoder/generated/manifest.cjs' {
  import type { LocalesMap } from './types';
  const manifest: {
    config: {
      sourceLocale: string;
      targetLocales: string[];
      locales: LocalesMap;
    };
    loaders: Record<string, () => any>;
  };
  export = manifest;
}

declare module '@vocoder/generated/*' {
  const translations: Record<string, string>;
  export default translations;
}
