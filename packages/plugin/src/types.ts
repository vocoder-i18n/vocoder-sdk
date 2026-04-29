export interface VocoderPluginOptions {
	/**
	 * Enable verbose build-time logging: extraction patterns, timing, fetch URL.
	 * @default false
	 *
	 * Extraction patterns (include/exclude) are configured in vocoder.config.ts
	 * committed to your repository — not here. This ensures the build plugin,
	 * CLI sync, and git webhook all use identical patterns.
	 */
	verbose?: boolean;
}

export interface VocoderTranslationData {
	config: {
		sourceLocale: string;
		targetLocales: string[];
		locales: Record<string, { nativeName: string; dir?: "rtl" }>;
	};
	translations: Record<string, Record<string, string>>;
	updatedAt: string | null;
}
