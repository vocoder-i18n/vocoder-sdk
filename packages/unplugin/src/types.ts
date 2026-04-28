export interface VocoderPluginOptions {
	/**
	 * Glob pattern(s) for files to include in string extraction.
	 * @default ["**\/*.{tsx,jsx,ts,js}"]
	 */
	include?: string | string[];
	/**
	 * Glob pattern(s) for files to exclude from string extraction.
	 * Merged with built-in excludes (node_modules, dist, build, .next, etc.).
	 */
	exclude?: string | string[];
	/**
	 * Enable verbose build-time logging: extraction patterns, timing, fetch URL.
	 * @default false
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
