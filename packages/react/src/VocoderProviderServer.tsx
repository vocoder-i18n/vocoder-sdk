import type { VocoderProviderServerProps } from "./types";

/**
 * Server-compatible VocoderProvider for Next.js App Router async components.
 *
 * Renders children directly. Locale and translation context for nested <T>
 * components is supplied by the nearest client VocoderProvider in the tree
 * (typically mounted in the root layout). React 19 RSC does not support
 * createContext, so this component cannot manage its own context subtree.
 *
 * The locale and translations props are accepted for API compatibility and
 * future enhancement (e.g. passing pre-loaded translations to the client
 * provider via a hydration mechanism).
 *
 * @example
 * ```tsx
 * export default async function Page() {
 *   return (
 *     <VocoderProviderServer>
 *       <T>Server-rendered content</T>
 *     </VocoderProviderServer>
 *   )
 * }
 * ```
 */
export async function VocoderProviderServer({
	children,
}: VocoderProviderServerProps) {
	return <>{children}</>;
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
