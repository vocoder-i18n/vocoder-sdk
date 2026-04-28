export interface VocoderPluginOptions {
  /**
   * The directory of this app relative to the repository root.
   * Only required for monorepos where multiple apps share one repository.
   * Leave unset for single-app repositories.
   *
   * Example: "apps/web"
   *
   * When not set, Vocoder auto-detects this from git context or workspace
   * configuration files (pnpm-workspace.yaml, turbo.json, etc.).
   */
  appDir?: string;
}

export interface VocoderTranslationData {
  config: {
    sourceLocale: string;
    targetLocales: string[];
    locales: Record<string, { nativeName: string; dir?: string }>;
  };
  translations: Record<string, Record<string, string>>;
  updatedAt: string | null;
}
