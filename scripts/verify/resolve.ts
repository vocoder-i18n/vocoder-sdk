// Resolve criteria against tests that actually exist and actually passed.
//
// Verified against this workspace's actual vitest install (1.6.1) rather
// than recalled from `app`'s port (vitest 4.0.16 there): this version has no
// `list` subcommand at all — `vitest --help` lists only `run`, `related`,
// `watch`, `dev`, `bench`, and `typecheck`. Enumeration and outcome can't be
// separate steps here the way they are in `app`'s `resolve.ts`. Instead,
// both come from the same `vitest run --reporter=json` invocation: every
// test that appears in `assertionResults` exists (enumerated), and its
// `status` says whether it passed. A criterion naming a test that was
// renamed or never existed simply never appears in that output, which is
// exactly "unresolvable" — no separate listing step is needed to detect it.
//
// `assertionResults[].ancestorTitles` includes a leading empty string for
// the implicit file-level root suite (confirmed by direct inspection, not
// assumed) — filtered out before joining, or every key would carry a
// spurious leading " > ".
//
// This repo is a pnpm workspace: each package tests itself with its own
// `vitest.config.ts`, and the gate's own suite (`scripts/__tests__/`) is
// scoped separately at the workspace root (research R1). "Unit" therefore
// runs multiple independent vitest invocations — one per package plus one
// at the root — and merges their outcomes into a single enumerated set and
// outcome map, rather than one invocation the way `app` (a single Next.js
// app, one vitest config) does it.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Criterion, CriterionOutcome, CriterionResult } from "./types";

export interface TestOutcome {
	file: string;
	name: string;
	status: string;
}

export interface UnitRunSummary {
	numTotalTests: number;
	numPassedTests: number;
	numFailedTests: number;
	numPendingTests: number;
	success: boolean;
}

export interface UnitTarget {
	/** Human-readable label for progress logging only. */
	label: string;
	/** Directory whose nearest `vitest.config.ts` governs this run. */
	cwd: string;
	/** Extra CLI args this target's own test script declares (e.g. `--exclude`). */
	extraArgs: string[];
}

export function toKey(repoRelativeFile: string, name: string): string {
	return `${repoRelativeFile}::${name}`;
}

/** Parses `vitest run --reporter=json`'s result shape into flat outcomes. */
export function parseRunOutput(rootDir: string, json: string): TestOutcome[] {
	const data = JSON.parse(json) as {
		testResults?: Array<{
			name: string;
			assertionResults?: Array<{
				ancestorTitles?: string[];
				title: string;
				status: string;
			}>;
		}>;
	};

	const outcomes: TestOutcome[] = [];
	for (const fileResult of data.testResults ?? []) {
		const file = path
			.relative(rootDir, fileResult.name)
			.split(path.sep)
			.join("/");
		for (const assertion of fileResult.assertionResults ?? []) {
			const ancestry = (assertion.ancestorTitles ?? []).filter(
				(title) => title.length > 0,
			);
			const name = [...ancestry, assertion.title].join(" > ");
			outcomes.push({ file, name, status: assertion.status });
		}
	}
	return outcomes;
}

export function buildEnumeratedSet(outcomes: TestOutcome[]): Set<string> {
	return new Set(outcomes.map((o) => toKey(o.file, o.name)));
}

export function buildOutcomeMap(outcomes: TestOutcome[]): Map<string, string> {
	const map = new Map<string, string>();
	for (const outcome of outcomes) {
		map.set(toKey(outcome.file, outcome.name), outcome.status);
	}
	return map;
}

/**
 * Pure resolution: given what exists (`enumerated`) and what ran
 * (`outcomes`), decide each criterion's outcome. No filesystem or process
 * access, so this is directly testable against fixture data.
 */
export function resolveCriteria(
	criteria: Criterion[],
	enumerated: Set<string>,
	outcomes: Map<string, string>,
): CriterionResult[] {
	return criteria.map((criterion) => {
		if (criterion.evidence) {
			return {
				id: criterion.id,
				statement: criterion.statement,
				evidenceRef: criterion.evidence.ref,
				outcome: "observational" as CriterionOutcome,
			};
		}

		const key = criterion.test as string;
		if (!enumerated.has(key)) {
			return {
				id: criterion.id,
				statement: criterion.statement,
				evidenceRef: key,
				outcome: "unresolvable" as CriterionOutcome,
			};
		}

		// A skipped test lands here too: only an explicit "passed" status
		// counts as proven.
		const status = outcomes.get(key);
		const outcome: CriterionOutcome = status === "passed" ? "passed" : "failed";
		return {
			id: criterion.id,
			statement: criterion.statement,
			evidenceRef: key,
			outcome,
		};
	});
}

/**
 * Runs one vitest invocation and returns its outcomes plus summary counts.
 * The JSON reporter's own stdout is not reliable to parse directly: code
 * under test can write its own output to stdout, interleaving with the
 * reporter's report. `--outputFile` routes the report to a dedicated file
 * instead, so only the file's content is ever parsed as JSON.
 */
export function runVitestJson(
	rootDir: string,
	target: Pick<UnitTarget, "cwd" | "extraArgs">,
	fileArgs: string[] = [],
): { outcomes: TestOutcome[]; raw: UnitRunSummary } {
	const outputFile = path.join(
		fs.mkdtempSync(path.join(os.tmpdir(), "verify-vitest-")),
		"report.json",
	);

	try {
		execFileSync(
			"pnpm",
			[
				"exec",
				"vitest",
				"run",
				...fileArgs,
				...target.extraArgs,
				"--reporter=json",
				`--outputFile=${outputFile}`,
			],
			{ cwd: target.cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
		);
	} catch {
		// vitest exits non-zero when any test fails; the report file is still
		// written and is what we need to resolve criteria against.
	}

	const raw = fs.readFileSync(outputFile, "utf8");
	fs.rmSync(path.dirname(outputFile), { recursive: true, force: true });

	const data = JSON.parse(raw) as UnitRunSummary;
	return { outcomes: parseRunOutput(rootDir, raw), raw: data };
}

/**
 * Reads each workspace package's own `test` script and turns its extra CLI
 * flags (e.g. cli's `--exclude 'src/__tests__/integration/**'`) into argv
 * tokens — derived from the package's own script rather than restated here,
 * so a package's test scope can't silently drift from what the gate runs
 * (§4.1.2). A package with no `test` script (e.g. `@vocoder/config`, which
 * has no tests) contributes no target.
 */
export function getPackageUnitTargets(rootDir: string): UnitTarget[] {
	const packagesDir = path.join(rootDir, "packages");
	if (!fs.existsSync(packagesDir)) return [];

	const targets: UnitTarget[] = [];
	for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const pkgDir = path.join(packagesDir, entry.name);
		const pkgJsonPath = path.join(pkgDir, "package.json");
		if (!fs.existsSync(pkgJsonPath)) continue;

		const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8")) as {
			name?: string;
			scripts?: Record<string, string>;
		};
		const testScript = pkgJson.scripts?.test;
		if (!testScript) continue;

		targets.push({
			label: pkgJson.name ?? entry.name,
			cwd: pkgDir,
			extraArgs: parseTestScriptArgs(testScript),
		});
	}
	return targets;
}

/**
 * Tokenizes a package.json `test` script's arguments after the leading
 * `vitest`/`vitest run`, respecting single and double quotes so a quoted
 * glob (`--exclude 'src/__tests__/integration/**'`) survives as one token
 * rather than being split on its internal spaces (there are none here, but
 * a future glob might carry them).
 */
export function parseTestScriptArgs(script: string): string[] {
	const remainder = script.replace(/^vitest(\s+run)?\s*/, "");
	const tokens: string[] = [];
	const tokenPattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
	let match: RegExpExecArray | null = tokenPattern.exec(remainder);
	while (match !== null) {
		tokens.push(match[1] ?? match[2] ?? match[3]);
		match = tokenPattern.exec(remainder);
	}
	return tokens;
}

export function mergeUnitRunSummaries(
	summaries: UnitRunSummary[],
): UnitRunSummary {
	return summaries.reduce<UnitRunSummary>(
		(acc, summary) => ({
			numTotalTests: acc.numTotalTests + summary.numTotalTests,
			numPassedTests: acc.numPassedTests + summary.numPassedTests,
			numFailedTests: acc.numFailedTests + summary.numFailedTests,
			numPendingTests: acc.numPendingTests + summary.numPendingTests,
			success: acc.success && summary.success,
		}),
		{
			numTotalTests: 0,
			numPassedTests: 0,
			numFailedTests: 0,
			numPendingTests: 0,
			success: true,
		},
	);
}
