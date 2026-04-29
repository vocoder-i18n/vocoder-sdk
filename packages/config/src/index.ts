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
