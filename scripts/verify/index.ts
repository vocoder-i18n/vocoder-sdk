#!/usr/bin/env -S pnpm exec tsx
// Sequences every check and collects every failure rather than stopping at
// the first (FR-012, ported from `app`). Order follows
// specs/022-verify-acceptance-manifest/contracts/verify-cli.md's Behaviour
// section:
//   1. Resolve the ticket from the branch.
//   2. Load the record (if a ticket applies).
//   3. Validate its shape — malformed short-circuits with exit 2, the gate
//      could not run at all, which is distinct from a legitimate failure.
//   4. Check rule drift.
//   5. Run build, then typecheck, then lint — build first, since
//      @vocoder/mcp imports @vocoder/cli/lib from packages/cli/dist (R7).
//   6. Run every package's own unit suite plus the gate's own suite, and
//      merge their outcomes into one Unit check.
//   7. Run the disclosure scan over this change's added lines (R6).
//   8. Resolve every criterion against enumerated tests, then against
//      results.
//   9. Emit the evidence block.
//  10. Exit per the code table in the contract.
//
// A branch naming no ticket is exempt from the record and criteria steps
// only — constitution drift, the disclosure scan, and the project's
// correctness checks still run and still determine the exit code, because a
// housekeeping change quietly shipping a broken build (or a leaked price)
// is not something exemption should paper over.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { getCurrentBranch, resolveTicketFromBranch } from "./branch";
import { checkTierOne, checkTierTwo } from "./constitution";
import { runDisclosureScan } from "./disclosure";
import { renderEvidence } from "./evidence";
import { loadRecord } from "./record";
import {
	buildEnumeratedSet,
	buildOutcomeMap,
	getPackageUnitTargets,
	mergeUnitRunSummaries,
	resolveCriteria,
	runVitestJson,
	type TestOutcome,
	type UnitRunSummary,
	type UnitTarget,
} from "./resolve";
import type { AcceptanceRecord, CheckResult, GateResult } from "./types";

interface RunOptions {
	evidenceOnly?: boolean;
}

interface RunOutcome {
	exitCode: number;
	evidence: string;
	result: GateResult;
}

class ToolingMissingError extends Error {}

function log(message: string): void {
	process.stderr.write(`${message}\n`);
}

export function formatFailure(title: string, detailLines: string[]): string {
	return [`FAIL  ${title}`, ...detailLines.map((line) => `      ${line}`)].join(
		"\n",
	);
}

function runShellCheck(
	name: string,
	cmd: string,
	args: string[],
	cwd: string,
): CheckResult {
	const start = Date.now();
	try {
		execFileSync(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
		return { name, outcome: "pass", durationMs: Date.now() - start };
	} catch (err) {
		const nodeErr = err as NodeJS.ErrnoException & {
			stdout?: Buffer | string;
			stderr?: Buffer | string;
		};
		if (nodeErr.code === "ENOENT") {
			throw new ToolingMissingError(`${cmd} not found on PATH`);
		}
		const raw = (
			nodeErr.stderr?.toString() ||
			nodeErr.stdout?.toString() ||
			""
		).trim();
		const detail =
			raw.split("\n").filter(Boolean).slice(-10).join(" / ") ||
			"command failed";
		return { name, outcome: "fail", detail, durationMs: Date.now() - start };
	}
}

function summarize(raw: UnitRunSummary): string {
	const parts = [`${raw.numPassedTests} passed`];
	if (raw.numPendingTests > 0) parts.push(`${raw.numPendingTests} skipped`);
	if (raw.numFailedTests > 0) parts.push(`${raw.numFailedTests} failed`);
	return parts.join(", ");
}

function distinctCriteriaFiles(record: AcceptanceRecord): string[] {
	const files = new Set<string>();
	for (const criterion of record.criteria) {
		if (criterion.test) {
			const separatorIndex = criterion.test.indexOf("::");
			if (separatorIndex !== -1)
				files.add(criterion.test.slice(0, separatorIndex));
		}
	}
	return [...files];
}

/** Runs every unit target and merges their outcomes into one result. */
function runAllUnitTargets(
	rootDir: string,
	targets: UnitTarget[],
): { outcomes: TestOutcome[]; raw: UnitRunSummary } {
	const allOutcomes: TestOutcome[] = [];
	const summaries: UnitRunSummary[] = [];
	for (const target of targets) {
		log(`verify: unit tests (${target.label})...`);
		const targetRun = runVitestJson(rootDir, target);
		allOutcomes.push(...targetRun.outcomes);
		summaries.push(targetRun.raw);
	}
	return { outcomes: allOutcomes, raw: mergeUnitRunSummaries(summaries) };
}

export async function run(
	rootDir: string,
	opts: RunOptions = {},
): Promise<RunOutcome> {
	const checks: CheckResult[] = [];
	const failures: string[] = [];
	let ticket: string | null = null;

	// --- 1. branch → ticket ---
	const branchName = getCurrentBranch(rootDir);
	const branchRes = resolveTicketFromBranch(branchName);
	if (branchRes.exempt) {
		log(`verify: branch "${branchName}" names no ticket — exempt`);
	} else {
		ticket = branchRes.ticket;
		log(`verify: branch "${branchName}" names ticket ${ticket}`);
	}

	// --- 2/3. load + validate record ---
	let record: AcceptanceRecord | null = null;
	if (!branchRes.exempt) {
		const loaded = loadRecord(rootDir, branchRes.ticket);
		if (!loaded.ok && loaded.kind === "malformed") {
			const message = formatFailure("acceptance record malformed", [
				path.relative(rootDir, loaded.path),
				...loaded.errors,
			]);
			log(message);
			const result: GateResult = {
				verdict: "fail",
				checks: [],
				criteria: [],
				disclosureFindings: [],
				failures: [message],
			};
			return { exitCode: 2, evidence: renderEvidence(result, ticket), result };
		}
		if (!loaded.ok && loaded.kind === "missing") {
			failures.push(
				formatFailure("acceptance record", [
					`expected ${path.relative(rootDir, loaded.path)} — branch ${branchName} names ticket ${ticket}`,
					"create the record, or branch without a ticket number if this work is exempt",
				]),
			);
		}
		if (loaded.ok) record = loaded.record;
	}

	try {
		// --- 4. rule drift ---
		log("verify: checking constitution drift...");
		const constitutionPath = path.join(
			rootDir,
			".specify",
			"memory",
			"constitution.md",
		);
		if (!fs.existsSync(constitutionPath)) {
			checks.push({
				name: "Constitution",
				outcome: "fail",
				detail: "missing .specify/memory/constitution.md",
			});
			failures.push(
				formatFailure("constitution missing", [
					`expected ${path.relative(rootDir, constitutionPath)}`,
					"run: specify init --here --integration claude",
				]),
			);
		} else {
			const content = fs.readFileSync(constitutionPath, "utf8");
			const tierOne = checkTierOne(content);
			const tierTwo = checkTierTwo(rootDir);
			if (!tierOne.ok) {
				checks.push({
					name: "Constitution",
					outcome: "fail",
					detail: "hand-edited — content no longer matches its own hash marker",
				});
				failures.push(
					formatFailure("constitution drift", [
						"repo copy's content no longer hashes to its own embedded marker",
						"fix: ../scripts/sync-constitution.sh",
					]),
				);
			} else if (tierTwo.status === "fail") {
				checks.push({
					name: "Constitution",
					outcome: "fail",
					detail: tierTwo.detail,
				});
				failures.push(formatFailure("constitution drift", [tierTwo.detail]));
			} else if (tierTwo.status === "skipped") {
				checks.push({
					name: "Constitution",
					outcome: "pass",
					detail: `tier two skipped — ${tierTwo.detail}`,
				});
			} else {
				checks.push({ name: "Constitution", outcome: "pass" });
			}
		}

		// --- 5. build, typecheck, lint ---
		if (!opts.evidenceOnly) {
			const shellChecks: Array<[string, string, string[]]> = [
				["Build", "pnpm", ["run", "build"]],
				["Typecheck", "pnpm", ["run", "typecheck"]],
				["Lint", "pnpm", ["run", "lint"]],
			];
			for (const [name, cmd, args] of shellChecks) {
				log(`verify: ${name.toLowerCase()}...`);
				const check = runShellCheck(name, cmd, args, rootDir);
				checks.push(check);
				if (check.outcome === "fail") {
					failures.push(
						formatFailure(name.toLowerCase(), [check.detail ?? "command failed"]),
					);
				}
			}
		} else {
			for (const name of ["Build", "Typecheck", "Lint"]) {
				checks.push({ name, outcome: "skip", detail: "not run (--evidence)" });
			}
		}

		// --- 6. unit tests (also feeds criterion resolution) ---
		let enumerated = new Set<string>();
		let outcomes = new Map<string, string>();

		if (!opts.evidenceOnly) {
			const targets: UnitTarget[] = [
				{ label: "scripts", cwd: rootDir, extraArgs: [] },
				...getPackageUnitTargets(rootDir),
			];
			const unitRun = runAllUnitTargets(rootDir, targets);
			enumerated = buildEnumeratedSet(unitRun.outcomes);
			outcomes = buildOutcomeMap(unitRun.outcomes);
			const unitOutcome = unitRun.raw.numFailedTests === 0 ? "pass" : "fail";
			checks.push({
				name: "Unit",
				outcome: unitOutcome,
				detail: summarize(unitRun.raw),
			});
			if (unitOutcome === "fail") {
				failures.push(formatFailure("unit tests", [summarize(unitRun.raw)]));
			}
		} else {
			// --evidence: skip every package's full suite, but still resolve
			// criteria against a targeted run of exactly the files the record
			// references — all of which live under the gate's own scope.
			if (record) {
				const targetFiles = distinctCriteriaFiles(record);
				if (targetFiles.length > 0) {
					const targetedRun = runVitestJson(
						rootDir,
						{ cwd: rootDir, extraArgs: [] },
						targetFiles,
					);
					enumerated = buildEnumeratedSet(targetedRun.outcomes);
					outcomes = buildOutcomeMap(targetedRun.outcomes);
				}
			}
			checks.push({
				name: "Unit",
				outcome: "skip",
				detail: "not run (--evidence)",
			});
		}

		// --- 7. disclosure scan ---
		log("verify: disclosure scan...");
		const disclosureResult = runDisclosureScan(rootDir);
		if (disclosureResult.skipped) {
			checks.push({
				name: "Disclosure",
				outcome: "pass",
				detail: `skipped — ${disclosureResult.detail}`,
			});
		} else if (disclosureResult.findings.length > 0) {
			checks.push({
				name: "Disclosure",
				outcome: "fail",
				detail: `${disclosureResult.findings.length} finding${disclosureResult.findings.length === 1 ? "" : "s"}`,
			});
			for (const finding of disclosureResult.findings) {
				failures.push(
					formatFailure("disclosure", [
						`${finding.file}:${finding.line} — "${finding.matchedTerm}"`,
						"remove pricing/rate/margin/quota data from this diff, or use a plan identifier alone",
					]),
				);
			}
		} else {
			checks.push({ name: "Disclosure", outcome: "pass" });
		}

		// --- 8. resolve criteria ---
		const criteriaResults = record
			? resolveCriteria(record.criteria, enumerated, outcomes)
			: [];
		for (const criterion of criteriaResults) {
			if (criterion.outcome === "unresolvable") {
				failures.push(
					formatFailure(`${criterion.id} unresolvable`, [
						`"${criterion.evidenceRef}"`,
						"no test with that name — it may have been renamed",
					]),
				);
			} else if (criterion.outcome === "failed") {
				failures.push(
					formatFailure(`${criterion.id} failed`, [
						`"${criterion.evidenceRef}" did not pass`,
					]),
				);
			}
		}

		const verdict: GateResult["verdict"] =
			failures.length === 0 ? "pass" : "fail";
		const result: GateResult = {
			verdict,
			checks,
			criteria: criteriaResults,
			disclosureFindings: disclosureResult.findings,
			failures,
		};
		const displayTicket = record?.ticket ?? ticket;
		const evidence = renderEvidence(result, displayTicket);

		for (const failure of failures) log(failure);
		log(`verify: ${verdict}`);

		return { exitCode: verdict === "pass" ? 0 : 1, evidence, result };
	} catch (err) {
		if (err instanceof ToolingMissingError) {
			const message = formatFailure("gate tooling missing", [err.message]);
			log(message);
			const result: GateResult = {
				verdict: "fail",
				checks,
				criteria: [],
				disclosureFindings: [],
				failures: [message],
			};
			return { exitCode: 2, evidence: renderEvidence(result, ticket), result };
		}
		throw err;
	}
}

async function main(): Promise<void> {
	const rootDir = process.cwd();
	const evidenceOnly = process.argv.includes("--evidence");
	const { exitCode, evidence } = await run(rootDir, { evidenceOnly });
	process.stdout.write(evidence);
	process.exitCode = exitCode;
}

const isMain =
	process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
	main().catch((err) => {
		process.stderr.write(
			`verify: internal error — ${(err as Error).stack ?? err}\n`,
		);
		process.exitCode = 2;
	});
}
