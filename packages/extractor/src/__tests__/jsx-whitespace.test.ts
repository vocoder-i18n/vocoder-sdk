import { generateMessageHash } from "@vocoder/core";
import { describe, expect, it } from "vitest";
import { extractFromContent } from "../index";
import { cleanJSXText } from "../shared/jsx-text";

/**
 * Runtime hashes recorded from the React package's own test environment, where
 * the JSX compiler has already normalised text children before `<T>` runs:
 *
 *   generateMessageHash(extractText(children))
 *
 * These are the keys the browser will look up. The extractor must produce the
 * same ones from source, or the translation is uploaded under a key nothing
 * ever requests. `packages/react/src/__tests__/jsx-whitespace-parity.test.tsx`
 * asserts the other half of each pair.
 */
const RUNTIME = {
	singleLine: { text: "Hello world", hash: "0os091j" },
	wrapped2: { text: "Some long static sentence that wraps.", hash: "14nru4o" },
	wrapped3: { text: "Alpha Beta Gamma", hash: "1gygm9q" },
	padded: { text: "Just one line", hash: "0zobyef" },
	doubleSpace: { text: "Two  spaces", hash: "0ktsbeu" },
} as const;

const wrap = (jsx: string) =>
	`import { T } from '@vocoder/react';\nexport const A = () => ${jsx};`;

const extractOne = (jsx: string) => {
	const out = extractFromContent("a.tsx", wrap(jsx));
	expect(out).toHaveLength(1);
	return out[0]!;
};

describe("cleanJSXText", () => {
	it("returns single-line text unchanged", () => {
		expect(cleanJSXText("Hello world")).toBe("Hello world");
	});

	it("joins wrapped lines with exactly one space", () => {
		expect(cleanJSXText("Some long static sentence\n  that wraps.")).toBe(
			"Some long static sentence that wraps.",
		);
	});

	it("drops leading and trailing whitespace-only lines", () => {
		expect(cleanJSXText("\n  Just one line\n")).toBe("Just one line");
	});

	it("preserves runs of spaces inside a line", () => {
		// A blanket \s+ collapse would return "Two spaces" and change the key.
		expect(cleanJSXText("Two  spaces")).toBe("Two  spaces");
	});

	it("treats tabs as whitespace", () => {
		expect(cleanJSXText("\n\tTabbed line\n")).toBe("Tabbed line");
	});

	it("keeps interior blank lines from adding extra spaces", () => {
		expect(cleanJSXText("\n  Alpha\n\n  Beta\n")).toBe("Alpha Beta");
	});

	it("returns empty string for whitespace-only input", () => {
		expect(cleanJSXText("\n   \n\t\n")).toBe("");
	});

	it("handles CRLF line endings", () => {
		expect(cleanJSXText("Alpha\r\n  Beta")).toBe("Alpha Beta");
	});
});

describe("extractor/runtime key parity", () => {
	it("single-line text", () => {
		const s = extractOne("<T>Hello world</T>");
		expect(s.text).toBe(RUNTIME.singleLine.text);
		expect(s.key).toBe(RUNTIME.singleLine.hash);
	});

	it("text wrapped across two lines", () => {
		const s = extractOne("<T>Some long static sentence\n  that wraps.</T>");
		expect(s.text).toBe(RUNTIME.wrapped2.text);
		expect(s.key).toBe(RUNTIME.wrapped2.hash);
	});

	it("text wrapped across three lines", () => {
		const s = extractOne("<T>\n  Alpha\n  Beta\n  Gamma\n</T>");
		expect(s.text).toBe(RUNTIME.wrapped3.text);
		expect(s.key).toBe(RUNTIME.wrapped3.hash);
	});

	it("text padded by leading and trailing newlines", () => {
		const s = extractOne("<T>\n  Just one line\n</T>");
		expect(s.text).toBe(RUNTIME.padded.text);
		expect(s.key).toBe(RUNTIME.padded.hash);
	});

	it("text containing a deliberate double space", () => {
		const s = extractOne("<T>Two  spaces</T>");
		expect(s.text).toBe(RUNTIME.doubleSpace.text);
		expect(s.key).toBe(RUNTIME.doubleSpace.hash);
	});

	it("reflowing source does not change the key", () => {
		// The regression that motivated this: running Prettier over a file would
		// re-wrap long <T> children and orphan every translation in the diff.
		const oneLine = extractOne("<T>Some long static sentence that wraps.</T>");
		const reflowed = extractOne(
			"<T>\n  Some long static sentence\n  that wraps.\n</T>",
		);
		expect(reflowed.key).toBe(oneLine.key);
		expect(reflowed.key).toBe(RUNTIME.wrapped2.hash);
	});

	it("recorded runtime hashes are what generateMessageHash produces", () => {
		// Guards the constants themselves: if the hash function ever changes,
		// this fails here rather than silently invalidating the parity claim.
		for (const { text, hash } of Object.values(RUNTIME)) {
			expect(generateMessageHash(text)).toBe(hash);
		}
	});
});
