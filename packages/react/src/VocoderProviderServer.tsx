import { createContext } from "react";
import type { VocoderProviderServerProps } from "./types";

const VocoderContext = createContext<null>(null);

/**
 * Server-compatible VocoderProvider for Next.js App Router async components.
 *
 * This version is designed for server-side rendering with no hooks or state.
 * Translations should be pre-loaded and passed as props.
 *
 * @example
 * ```tsx
 * import en from './locales/en.json'
 *
 * export default async function Page() {
 *   return (
 *     <VocoderProviderServer locale="en" translations={en}>
 *       <V>Server-rendered content</V>
 *     </VocoderProviderServer>
 *   )
 * }
 * ```
 */
export async function VocoderProviderServer({
	children,
	locale = "en",
	translations,
}: VocoderProviderServerProps) {
	const t = (text: string) =>
		(translations as Record<string, string>)[text] || text;

	const hasTranslation = (text: string) =>
		translations != null && Object.prototype.hasOwnProperty.call(translations, text);

	const getDisplayName = (targetLocale: string, viewingLocale?: string) => {
		const vl = viewingLocale ?? locale;
		try {
			const dn = new Intl.DisplayNames([vl], { type: "language" });
			return dn.of(targetLocale) ?? targetLocale;
		} catch {
			return targetLocale;
		}
	};

	const value = {
		availableLocales: [locale],
		getDisplayName,
		isReady: true,
		locale,
		dir: getLocaleDir(locale),
		setLocale: async () => {},
		t,
		hasTranslation,
	};

	return (
		<VocoderContext.Provider value={value as any}>
			{children}
		</VocoderContext.Provider>
	);
}

// Needed here to avoid circular import with server.ts
const RTL_LANGUAGES = new Set([
	"ar",
	"he",
	"fa",
	"ur",
	"ps",
	"sd",
	"ug",
	"yi",
	"dv",
	"ku",
]);

function getLocaleDir(locale: string): "ltr" | "rtl" {
	const lang = locale.split("-")[0]?.toLowerCase();
	return lang && RTL_LANGUAGES.has(lang) ? "rtl" : "ltr";
}
