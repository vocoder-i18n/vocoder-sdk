/**
 * Type declarations for virtual modules injected by @vocoder/unplugin.
 *
 * These modules are created at build time by the unplugin and contain
 * translation data fetched from the Vocoder API.  They do not exist as
 * files on disk — the bundler resolves them through the plugin's
 * `resolveId` / `load` hooks.
 */

declare module 'virtual:vocoder/manifest' {
  export const config: {
    sourceLocale: string;
    targetLocales: string[];
    locales: Record<string, { nativeName: string; dir?: string }>;
  };
  export const loaders: Record<
    string,
    () => Promise<{ default: Record<string, string> }>
  >;
}

declare module 'virtual:vocoder/translations/*' {
  const translations: Record<string, string>;
  export default translations;
}
