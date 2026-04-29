import { detectRepoIdentity } from "@vocoder/plugin";
import type { VocoderClient } from "../client.js";

export interface TranslationsInput {
	branch?: string;
	locale?: string;
}

export async function runGetTranslations(
	input: TranslationsInput,
	client: VocoderClient,
): Promise<string> {
	const branch = input.branch ?? "main";
	const identity = detectRepoIdentity();
	const snapshot = await client.getSnapshot(
		branch,
		input.locale,
		identity?.repoCanonical,
	);

	if (snapshot.status === "NOT_FOUND") {
		return `No translations found for branch "${branch}". Run vocoder_sync first to generate translations.`;
	}

	const translations = snapshot.translations ?? {};
	const locales = Object.keys(translations);

	if (locales.length === 0) {
		return `No translations available yet for branch "${branch}".`;
	}

	if (input.locale) {
		const localeTrans = translations[input.locale];
		if (!localeTrans) {
			return `No translations found for locale "${input.locale}" on branch "${branch}".`;
		}
		return JSON.stringify(
			{ branch, locale: input.locale, translations: localeTrans },
			null,
			2,
		);
	}

	return JSON.stringify({ branch, translations }, null, 2);
}
