// Proves AC3 on VOC-22 (see .vocoder/acceptance/022.json) — the record and
// criteria enforcement already proven in the `app` repo (VOC-21) applies
// here without modification. Exercises the gate's pure logic directly —
// record validation, criterion resolution, constitution hashing, evidence
// rendering — against fixture data, rather than spawning the real gate end
// to end. That keeps the suite fast and deterministic, and matches how
// scripts/verify/*.ts is factored: I/O (subprocess calls, filesystem reads)
// is kept separate from the decisions those results feed into.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkTierOne } from "../verify/constitution";
import { renderEvidence } from "../verify/evidence";
import { loadRecord } from "../verify/record";
import { resolveCriteria } from "../verify/resolve";
import type { Criterion, GateResult } from "../verify/types";

describe("verify", () => {
	it("fails when the record is missing", () => {
		const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "verify-record-"));
		try {
			const result = loadRecord(rootDir, "999");
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.kind).toBe("missing");
				expect(result.path).toBe(
					path.join(rootDir, ".vocoder", "acceptance", "999.json"),
				);
			}
		} finally {
			fs.rmSync(rootDir, { recursive: true, force: true });
		}
	});

	it("fails on unresolvable test reference", () => {
		const criteria: Criterion[] = [
			{
				id: "AC1",
				statement: "a criterion pointing at a test that does not exist",
				test: "scripts/__tests__/verify.test.ts::verify > this test does not exist",
			},
		];
		const enumerated = new Set<string>([
			"scripts/__tests__/verify.test.ts::verify > some other test",
		]);
		const outcomes = new Map<string, string>();

		const results = resolveCriteria(criteria, enumerated, outcomes);

		expect(results).toHaveLength(1);
		expect(results[0].outcome).toBe("unresolvable");
		expect(results[0].evidenceRef).toBe(criteria[0].test);
	});

	it("treats a skipped test as unproven", () => {
		const key =
			"scripts/__tests__/verify.test.ts::verify > a test that is skipped";
		const criteria: Criterion[] = [
			{
				id: "AC1",
				statement: "a criterion backed by a skipped test",
				test: key,
			},
		];
		const enumerated = new Set<string>([key]);
		const outcomes = new Map<string, string>([[key, "skipped"]]);

		const results = resolveCriteria(criteria, enumerated, outcomes);

		expect(results[0].outcome).toBe("failed");
	});

	it("passes when every criterion resolves to a passing test", () => {
		const key1 = "scripts/__tests__/verify.test.ts::verify > test one";
		const key2 = "scripts/__tests__/verify.test.ts::verify > test two";
		const criteria: Criterion[] = [
			{ id: "AC1", statement: "first criterion", test: key1 },
			{ id: "AC2", statement: "second criterion", test: key2 },
		];
		const enumerated = new Set<string>([key1, key2]);
		const outcomes = new Map<string, string>([
			[key1, "passed"],
			[key2, "passed"],
		]);

		const results = resolveCriteria(criteria, enumerated, outcomes);

		expect(results.every((r) => r.outcome === "passed")).toBe(true);
	});

	it("detects a hand-edited constitution copy", () => {
		const stampedLines = [
			"## 2. Core principles",
			"",
			"1. Done is computed, never asserted.",
		];
		const hash = crypto
			.createHash("sha256")
			.update(stampedLines.join("\n"))
			.digest("hex");
		const intact = [
			"<!-- STAMPED:BEGIN -->",
			`<!-- hash: ${hash} -->`,
			...stampedLines,
			"<!-- STAMPED:END -->",
		].join("\n");
		const tampered = intact.replace(
			"Done is computed, never asserted.",
			"Done is computed, never asserted, unless it's Friday.",
		);

		const result = checkTierOne(tampered);

		expect(result.ok).toBe(false);
		expect(result.declaredHash).toBe(hash);
		expect(result.computedHash).not.toBe(hash);
	});

	it("passes when the constitution copy is intact", () => {
		const stampedLines = [
			"## 2. Core principles",
			"",
			"1. Done is computed, never asserted.",
		];
		const hash = crypto
			.createHash("sha256")
			.update(stampedLines.join("\n"))
			.digest("hex");
		const intact = [
			"<!-- STAMPED:BEGIN -->",
			`<!-- hash: ${hash} -->`,
			...stampedLines,
			"<!-- STAMPED:END -->",
		].join("\n");

		const result = checkTierOne(intact);

		expect(result.ok).toBe(true);
	});

	it("renders observational criteria in their own section", () => {
		const result: GateResult = {
			verdict: "pass",
			checks: [{ name: "Unit", outcome: "pass" }],
			criteria: [
				{
					id: "AC1",
					statement: "proven by a passing test",
					evidenceRef: "scripts/__tests__/verify.test.ts::verify > test one",
					outcome: "passed",
				},
				{
					id: "AC4",
					statement: "proven by observation",
					evidenceRef: "PR #1 screenshots",
					outcome: "observational",
				},
			],
			disclosureFindings: [],
			failures: [],
		};

		const rendered = renderEvidence(result, "VOC-99");
		const [mainSection, observationalSection] = rendered.split(
			"### Proven by observation",
		);

		expect(observationalSection).toBeDefined();
		expect(mainSection).not.toContain("AC4");
		expect(observationalSection).toContain("AC4");
		expect(observationalSection).toContain("PR #1 screenshots");

		const withoutObservational = renderEvidence(
			{ ...result, criteria: [result.criteria[0]] },
			"VOC-99",
		);
		expect(withoutObservational).not.toContain("Proven by observation");
	});

	it("omits the disclosure findings section when there are no findings", () => {
		const result: GateResult = {
			verdict: "pass",
			checks: [{ name: "Disclosure", outcome: "pass" }],
			criteria: [],
			disclosureFindings: [],
			failures: [],
		};

		const rendered = renderEvidence(result, null);

		expect(rendered).not.toContain("Disclosure findings");
	});

	it("renders a disclosure findings section when the scan fails", () => {
		const result: GateResult = {
			verdict: "fail",
			checks: [{ name: "Disclosure", outcome: "fail", detail: "1 finding" }],
			criteria: [],
			disclosureFindings: [
				{
					file: "packages/cli/src/commands/sync.ts",
					line: 42,
					matchedTerm: "$0.035 per character",
					category: "rate",
				},
			],
			failures: [],
		};

		const rendered = renderEvidence(result, null);

		expect(rendered).toContain("## Disclosure findings");
		expect(rendered).toContain("packages/cli/src/commands/sync.ts");
		expect(rendered).toContain("42");
		expect(rendered).toContain("$0.035 per character");
		expect(rendered).toContain("rate");
	});
});
