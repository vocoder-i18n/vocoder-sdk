import IntlMessageFormat from "intl-messageformat";

const imfCache = new Map<string, IntlMessageFormat>();

function getIMF(text: string, locale: string): IntlMessageFormat {
	const key = `${locale}:${text}`;
	let msg = imfCache.get(key);
	if (!msg) {
		// ignoreTag: true — component placeholders (<c0>, <c1>) are handled
		// by formatElements, not by IMF. IMF handles only ICU primitives.
		msg = new IntlMessageFormat(text, locale, undefined, { ignoreTag: true });
		imfCache.set(key, msg);
	}
	return msg;
}

export function formatICU(
	text: string,
	values: Record<string, unknown>,
	locale: string = "en",
): string {
	try {
		const result = getIMF(text, locale.toLowerCase()).format(values);
		return typeof result === "string" ? result : (result as unknown[]).join("");
	} catch (error) {
		console.error("Vocoder ICU formatting error:", error);
		return text;
	}
}
