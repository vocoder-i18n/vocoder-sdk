export interface VocoderConfig {
	/** Glob patterns for files to extract strings from. */
	include?: string[];
	/** Glob patterns to exclude. */
	exclude?: string[];
	/**
	 * Git branches that trigger string extraction and translation.
	 * Synced to the Vocoder dashboard on each push — change here to update.
	 */
	targetBranches?: string[];
	/**
	 * Directory to write translated locale files after sync (optional).
	 * If set, `vocoder sync` writes {locale}.json files to this path.
	 */
	localesPath?: string;
}

/** Type helper for vocoder.config.ts — provides autocomplete and type checking. */
export function defineConfig(config: VocoderConfig): VocoderConfig {
	return config;
}

/**
 * Canonical translation bundle format shared by the build plugin and CLI.
 * Both read and write this shape — keeps cache files identical regardless of
 * which tool produced them.
 *
 * translations: locale → sourceKey (hash) → translated text
 * config.locales: locale metadata snapshot for the runtime
 */
export interface VocoderTranslationData {
	config: {
		sourceLocale: string;
		targetLocales: string[];
		locales: Record<string, {
			nativeName: string;
			dir?: "rtl";
			currencyCode?: string;
			ordinalSuffixes?: { zero?: string; one?: string; two?: string; few?: string; many?: string; other: string };
		}>;
	};
	translations: Record<string, Record<string, string>>;
	updatedAt: string | null;
}
