import { generateMessageHash } from "@vocoder/core";
import { describe, expect, it } from "vitest";
import { extractText } from "../utils/extractText";

/**
 * The runtime half of the extractor/runtime key parity contract.
 *
 * `<T>` derives its lookup key from `generateMessageHash(extractText(children))`,
 * and by the time it runs the JSX compiler has already applied JSX whitespace
 * semantics to the text children. The extractor reads the same source straight
 * from the AST, where that normalisation has not happened, so it has to
 * reproduce it — see `packages/extractor/src/shared/jsx-text.ts`.
 *
 * These are the same constants asserted in
 * `packages/extractor/src/__tests__/jsx-whitespace.test.ts`. Both halves must
 * agree; a change to either the hash function or the whitespace handling fails
 * one of the two suites rather than silently splitting build-time and runtime
 * keys, which is invisible in dev and in CI and only shows up as a string that
 * never translates.
 */
const key = (children: React.ReactNode) =>
	generateMessageHash(extractText(children));

describe("runtime key parity with the extractor", () => {
	it("single-line text", () => {
		expect(extractText(<>Hello world</>)).toBe("Hello world");
		expect(key(<>Hello world</>)).toBe("0os091j");
	});

	it("text wrapped across two lines", () => {
		const node = (
			<>
				Some long static sentence that wraps.
			</>
		);
		expect(extractText(node)).toBe("Some long static sentence that wraps.");
		expect(key(node)).toBe("14nru4o");
	});

	it("text wrapped across three lines", () => {
		const node = (
			<>
				Alpha Beta Gamma
			</>
		);
		expect(extractText(node)).toBe("Alpha Beta Gamma");
		expect(key(node)).toBe("1gygm9q");
	});

	it("text padded by leading and trailing newlines", () => {
		const node = (
			<>
				Just one line
			</>
		);
		expect(extractText(node)).toBe("Just one line");
		expect(key(node)).toBe("0zobyef");
	});

	it("text containing a deliberate double space", () => {
		// The compiler preserves runs of spaces inside a line, so the extractor
		// must not collapse them either.
		expect(extractText(<>Two  spaces</>)).toBe("Two  spaces");
		expect(key(<>Two  spaces</>)).toBe("0ktsbeu");
	});
});
