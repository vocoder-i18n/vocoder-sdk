// Shapes shared across the gate. See specs/022-verify-acceptance-manifest/data-model.md
// for the authoritative description of each field.

/** One ticket's committed record at `.vocoder/acceptance/<NNN>.json`. */
export interface AcceptanceRecord {
	ticket: string;
	criteria: Criterion[];
}

/** A single acceptance criterion: what is claimed, and exactly one of how it is proven. */
export interface Criterion {
	id: string;
	statement: string;
	test?: string;
	evidence?: CriterionEvidence;
}

export interface CriterionEvidence {
	type: string;
	ref: string;
}

/**
 * - passed — reference resolved to a test that ran and passed.
 * - failed — reference resolved, test ran, did not pass. A skipped test lands here.
 * - unresolvable — reference matched no known test.
 * - observational — declared as proven by observation, listed separately.
 */
export type CriterionOutcome =
	| "passed"
	| "failed"
	| "unresolvable"
	| "observational";

export interface CriterionResult {
	id: string;
	statement: string;
	/** The `test` reference, or the observational `evidence.ref`. */
	evidenceRef: string;
	outcome: CriterionOutcome;
}

export type CheckOutcome = "pass" | "fail" | "skip";

export interface CheckResult {
	name: string;
	outcome: CheckOutcome;
	detail?: string;
	durationMs?: number;
}

/** Which shape of pricing-domain value tripped the disclosure scan. */
export type DisclosureCategory = "price" | "rate" | "margin" | "quota";

/**
 * A single disclosure match on one added line. Transient — exists only in the
 * gate's in-memory result while running, never persisted. A shape match alone
 * is never enough to produce one of these: it must co-occur with a
 * pricing-domain keyword on the same line (data-model.md, R2).
 */
export interface DisclosureFinding {
	/** Repo-relative path of the file containing the match. */
	file: string;
	/** 1-indexed line number within the file's current content. */
	line: number;
	/** The specific substring that tripped the scan, quoted verbatim in the failure message. */
	matchedTerm: string;
	category: DisclosureCategory;
}

/** In-memory only. Never persisted. */
export interface GateResult {
	verdict: "pass" | "fail";
	checks: CheckResult[];
	criteria: CriterionResult[];
	/** Populated only when the disclosure check fails. */
	disclosureFindings: DisclosureFinding[];
	failures: string[];
}
