// Proves AC1 and AC2 on VOC-22 (see .vocoder/acceptance/022.json). Exercises
// `matchLine` directly against string fixtures — no filesystem, no git, no
// subprocess — so the suite is fast, deterministic, and testable independent
// of the git-diff plumbing in `runDisclosureScan`.
//
// Every price/rate/margin/quota value below is a synthetic placeholder
// shaped like a real one, never an actual current Vocoder figure
// (constitution §13.7). This file lives under `scripts/__tests__/`, which
// the live disclosure scan excludes from its own git-diff scan (see
// `scripts/verify/disclosure.ts`) — otherwise this feature's own PR, which
// necessarily adds these fixtures, would fail the very check it exists to
// prove works.
import { describe, expect, it } from "vitest";
import { matchLine, parseAddedLines, scanAddedLines } from "../verify/disclosure";

describe("disclosure", () => {
	it("blocks a credit-rate value", () => {
		const results = matchLine(
			"// billing: $0.035 per character credit rate",
		);

		expect(results).toHaveLength(1);
		expect(results[0].category).toBe("rate");
		expect(results[0].matchedTerm).toBe("$0.035 per character");
	});

	it("blocks a margin percentage", () => {
		const results = matchLine("// renewals run at a 23% margin on this SKU");

		expect(results).toHaveLength(1);
		expect(results[0].category).toBe("margin");
		expect(results[0].matchedTerm).toContain("23%");
		expect(results[0].matchedTerm).toContain("margin");
	});

	it("blocks a numeric plan quota", () => {
		const results = matchLine("Free plan: 50,000 characters per month");

		expect(results).toHaveLength(1);
		expect(results[0].category).toBe("quota");
		expect(results[0].matchedTerm).toBe("50,000 characters per month");
	});

	it("names the file, line, and matched term in the failure", () => {
		const findings = scanAddedLines([
			{
				file: "packages/cli/src/commands/sync.ts",
				line: 42,
				content: "// costs $0.035 per character credit rate",
			},
		]);

		expect(findings).toHaveLength(1);
		expect(findings[0].file).toBe("packages/cli/src/commands/sync.ts");
		expect(findings[0].line).toBe(42);
		expect(findings[0].matchedTerm).toBe("$0.035 per character");
		expect(findings[0].category).toBe("rate");
	});

	it("allows a plan identifier alone", () => {
		const results = matchLine(
			'throw new Error("Upgrade to pro for more locales")',
		);

		expect(results).toHaveLength(0);
	});

	it("allows an existing currency-formatting example", () => {
		// Exact shape at packages/react/README.md:299 — a bare currency value
		// demonstrating <T>'s number formatting, no pricing keyword nearby.
		const results = matchLine(
			'<T value={29.99} format="currency" currency="USD" />   // "$29.99"',
		);

		expect(results).toHaveLength(0);
	});

	it("still blocks a plan identifier next to a real price", () => {
		const results = matchLine("// pro plan: $49/month");

		expect(results.length).toBeGreaterThan(0);
		expect(results.some((r) => r.category === "rate" || r.category === "price")).toBe(
			true,
		);
		expect(results.some((r) => r.matchedTerm.includes("$49"))).toBe(true);
	});

	it("does not flag a plan identifier next to an unrelated product number", () => {
		// "Pro" names a tier; "3" is a UI constraint, not a plan quota — and
		// the line carries none of the pricing-domain keywords on its own.
		const results = matchLine("Pro users can create up to 3 projects");

		expect(results).toHaveLength(0);
	});

	it("excludes the gate's own test directory from the added-lines scan", () => {
		const findings = scanAddedLines([
			{
				file: "scripts/__tests__/disclosure.test.ts",
				line: 1,
				content: "// costs $0.035 per character credit rate",
			},
		]);

		expect(findings).toHaveLength(0);
	});

	it("parses only + lines from a unified diff, excluding the +++ header", () => {
		const diffText = [
			"diff --git a/foo.ts b/foo.ts",
			"index 111..222 100644",
			"--- a/foo.ts",
			"+++ b/foo.ts",
			"@@ -10,0 +11,2 @@ function bar() {",
			"+const price = 1;",
			'+// costs $0.035 per character credit rate',
		].join("\n");

		const added = parseAddedLines(diffText);

		expect(added).toHaveLength(2);
		expect(added[0]).toEqual({
			file: "foo.ts",
			line: 11,
			content: "const price = 1;",
		});
		expect(added[1].line).toBe(12);
	});
});
