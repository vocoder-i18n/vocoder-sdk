// Reserved for future plugin options.
export interface VocoderPluginOptions {}

export interface VocoderTranslationData {
	config: {
		sourceLocale: string;
		targetLocales: string[];
		locales: Record<string, { nativeName: string; dir?: string }>;
	};
	translations: Record<string, Record<string, string>>;
	updatedAt: string | null;
}
