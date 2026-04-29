import React from "react";
import type { TProps } from "./types";
import { generateMessageHash } from "./hash";
import { extractText } from "./utils/extractText";
import { formatMessage } from "./utils/formatMessage";
import { useVocoder } from "./VocoderProvider";

// CLDR plural categories that unambiguously indicate plural mode.
// "other" is excluded because it doubles as the fallback in select mode.
const PLURAL_CLDR = new Set(["zero", "one", "two", "few", "many"]);
// Full set used in ICU builders where mode is already resolved.
const ALL_CLDR = new Set(["zero", "one", "two", "few", "many", "other"]);

/**
 * Classify a rest prop key for plural/select mode detection.
 * Spread props are NEVER used as interpolation values — use the `values` prop instead.
 *
 * - "zero","one","two","few","many" or _N (digits) → plural category / exact match
 * - "other" → shared fallback (plural or select depending on context)
 * - _word (letters after underscore) → select case
 * - anything else → ignored (not used as interpolation — avoids collisions with reserved names)
 */
function classifyProp(key: string): "plural" | "select" | "other" | "ignore" {
	if (PLURAL_CLDR.has(key) || /^_\d+$/.test(key)) return "plural";
	if (key === "other") return "other";
	if (/^_[a-zA-Z]/.test(key)) return "select";
	return "ignore";
}

/**
 * Build an ICU plural string from plural props.
 * Exact matches (_0 → =0) come before CLDR categories.
 * Internal variable is always "count" for consistent lookup keys.
 */
function buildPluralICU(props: Record<string, string>): string {
	const exact: string[] = [];
	const cldr: string[] = [];

	for (const [key, text] of Object.entries(props)) {
		const exactMatch = key.match(/^_(\d+)$/);
		if (exactMatch) {
			exact.push(`=${exactMatch[1]} {${text}}`);
		} else if (ALL_CLDR.has(key)) {
			cldr.push(`${key} {${text}}`);
		}
	}

	return `{count, plural, ${[...exact, ...cldr].join(" ")}}`;
}

/**
 * Build an ICU select string from select props.
 * Internal variable is always "value" for consistent lookup keys.
 */
function buildSelectICU(props: Record<string, string>): string {
	const cases: string[] = [];
	let hasOther = false;

	for (const [key, text] of Object.entries(props)) {
		if (key === "other") {
			hasOther = true;
			cases.push(`other {${text}}`);
		} else {
			const wordCase = key.match(/^_([a-zA-Z].*)$/);
			if (wordCase) cases.push(`${wordCase[1]} {${text}}`);
		}
	}

	if (!hasOther) cases.push("other {other}");
	return `{value, select, ${cases.join(" ")}}`;
}

/** Translate and format message text in JSX. Supports three modes:
 *
 * **Interpolation** (default):
 * ```tsx
 * <T message="Hello {name}!" values={{ name }} />
 * <T>Hello {name}!</T>                    // natural syntax: build plugin injects message + values
 * <T id="welcome" message="Hello!" />     // key-based lookup
 * ```
 *
 * **Plural** (triggered by one/other/two/few/many props or _N exact matches):
 * ```tsx
 * <T value={count} _0="No items" one="# item" other="# items" />
 * ```
 *
 * **Select** (triggered by _word props without CLDR categories):
 * ```tsx
 * <T value={gender} _male="his" _female="her" other="their" />
 * ```
 */
export const T: React.FC<TProps> = ({
	id,
	children,
	message,
	msg,
	context: _context,
	formality: _formality,
	components,
	values: valuesObj,
	value,
	...rest
}) => {
	const { t, locale, hasTranslation } = useVocoder();

	try {
		// Collect plural/select mode props from rest.
		// Spread props are NOT used as interpolation values — use the `values` prop instead.
		// "other" is ambiguous: the required fallback in both plural and select modes.
		const pluralProps: Record<string, string> = {};
		const selectProps: Record<string, string> = {};
		let otherValue: string | undefined;

		for (const [key, val] of Object.entries(rest)) {
			const kind = classifyProp(key);
			if (kind === "plural" && typeof val === "string") {
				pluralProps[key] = val;
			} else if (kind === "select" && typeof val === "string") {
				selectProps[key] = val;
			} else if (kind === "other" && typeof val === "string") {
				otherValue = val;
			}
			// "ignore" — intentionally dropped. Use values={{ key: val }} for interpolation.
		}

		const hasPluralMode = Object.keys(pluralProps).length > 0;
		const hasSelectMode = !hasPluralMode && Object.keys(selectProps).length > 0;

		if (otherValue !== undefined) {
			if (hasPluralMode) pluralProps.other = otherValue;
			else if (hasSelectMode) selectProps.other = otherValue;
		}

		let sourceText: string;
		let formatValues: Record<string, any>;

		if (hasPluralMode && value !== undefined) {
			// Plural mode: build ICU from props, count = value
			sourceText = buildPluralICU(pluralProps);
			formatValues = { count: value, ...(valuesObj ?? {}) };
		} else if (hasSelectMode && value !== undefined) {
			// Select mode: build ICU from _word props, value = value
			sourceText = buildSelectICU(selectProps);
			formatValues = { value, ...(valuesObj ?? {}) };
		} else {
			// Interpolation mode: values come exclusively from the `values` prop
			sourceText = message ?? msg ?? extractText(children);
			formatValues = { ...(valuesObj ?? {}) };
		}

		// Lookup key: explicit id > content hash of sourceText.
		// Build transform injects id="hash" automatically for <T> with children.
		// For plural/select ICU built from props, we hash the ICU string.
		// Using hash keys keeps the wire payload small (7 chars vs full source string).
		const lookupKey = id ?? generateMessageHash(sourceText, _context);

		// Get translated text or fall back to source
		const textToFormat = hasTranslation(lookupKey) ? t(lookupKey) : sourceText;

		// Nothing to format (id-only with no translation and no message)
		if (!textToFormat) {
			if (process.env.NODE_ENV === "development" && id) {
				console.warn(`[vocoder] Missing translation for key "${id}"`);
			}
			return <>{id ?? children ?? null}</>;
		}

		// Build format values including component renderers
		if (components) {
			for (const [key, component] of Object.entries(components)) {
				formatValues[key] = (chunks: any[]) =>
					React.cloneElement(component, { key }, chunks);
			}
		}

		const result = formatMessage(textToFormat, formatValues, locale);
		return <>{result}</>;
	} catch (err) {
		console.error("Vocoder formatting error:", err);
		return <>{children}</>;
	}
};

T.displayName = "Vocoder.T";
