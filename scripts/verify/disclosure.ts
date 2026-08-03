// The disclosure scan (specs/022-verify-acceptance-manifest). This repo is
// public and MIT-licensed — a price, credit rate, margin, or quota value
// that lands here is disclosed permanently the moment it's pushed, whether
// or not the PR ever merges. This module never contains, and never needs, a
// real Vocoder figure to compare against (constitution §13.7): it detects
// the *shape* pricing values always take, gated on a nearby pricing-domain
// keyword so ordinary numbers — versions, counts, array lengths — never
// trip it (data-model.md, research.md R2).
//
// Scope is added lines only, diffed against the merge base (research R6) —
// this feature is forward-looking, not a historical audit, so content
// already on `main` before this PR is never scanned unless a PR happens to
// touch that exact line.
import { execFileSync } from "node:child_process";
import type { DisclosureCategory, DisclosureFinding } from "./types";

/**
 * Words that turn a shape (a currency symbol, a percentage, a bare number)
 * into a plan-economics disclosure. None of these are plan identifiers —
 * `free`, `starter`, `pro`, and `enterprise` never appear here, and never
 * contribute to a match on their own (FR-006). A shape with no keyword on
 * the same line is never a finding, by construction — this is what keeps a
 * documentation example of the `<T>` component's own currency formatting
 * (a bare `$`-prefixed number with no pricing language anywhere near it)
 * from ever being reported.
 */
export const PRICING_KEYWORDS = [
	"credit",
	"plan",
	"subscription",
	"cost",
	"price",
	"rate",
	"margin",
	"quota",
] as const;

/** Product tier names. Always inert with respect to this check (FR-006). */
export const PLAN_IDENTIFIERS = ["free", "starter", "pro", "enterprise"] as const;

/**
 * Test fixtures necessarily contain synthetic pricing-shaped strings to
 * prove the matcher works (spec.md Edge Cases: "the check must not need to
 * exempt itself from itself"). That's a statement about the matcher, not
 * about which files the live scan reads — `matchLine` below carries no
 * exemption and is exercised directly against those fixtures in
 * scripts/__tests__/disclosure.test.ts. The live git-diff scan excludes the
 * gate's own test directory so this feature's own PR — which necessarily
 * adds those fixtures — doesn't fail on the very lines that prove it works.
 * Product code and documentation carry no such exemption.
 */
const EXCLUDED_PATH_PREFIXES = ["scripts/__tests__/"];

const KEYWORD_PATTERN = new RegExp(
	`\\b(?:${PRICING_KEYWORDS.join("|")})s?\\b`,
	"i",
);

const MARGIN_WORD_PATTERN = /\bmargin\b/i;

/** A percentage value: one to three digits, an optional decimal, then `%`. */
const PERCENTAGE_SHAPE_SOURCE = String.raw`\d{1,3}(?:\.\d+)?\s?%`;

/**
 * A currency symbol and a number, optionally followed by a per-unit or
 * per-period suffix (`/month`, `per character`). The suffix, when present,
 * is what separates a one-time price from a recurring rate.
 */
const CURRENCY_SHAPE_PATTERN =
	/[$€£¥]\s?\d[\d,]*(?:\.\d+)?(?:\s*\/\s*[a-zA-Z]+|\s+per\s+[a-zA-Z]+)?/i;

const RATE_SUFFIX_PATTERN = /\/\s*[a-zA-Z]+|\bper\s+[a-zA-Z]+/i;

/**
 * A count of some billable unit (characters, words, tokens, requests, seats)
 * tied to a billing period — the shape a plan's numeric quota is always
 * phrased in.
 */
const QUOTA_SHAPE_PATTERN =
	/\d[\d,]*\s*(?:characters?|chars?|words?|tokens?|requests?|credits?|seats?)\s*(?:\/|per)\s*(?:month|year|day)\b/i;

/**
 * Finds every margin-percentage occurrence in `line`: a percentage and the
 * word "margin" within a short span of each other, in either order.
 */
function findMarginMatches(line: string): RegExpMatchArray[] {
	if (!MARGIN_WORD_PATTERN.test(line)) return [];
	const combined = new RegExp(
		`(?:${PERCENTAGE_SHAPE_SOURCE}[^\\n]{0,20}?\\bmargin\\b|\\bmargin\\b[^\\n]{0,20}?${PERCENTAGE_SHAPE_SOURCE})`,
		"gi",
	);
	return [...line.matchAll(combined)];
}

/**
 * Scans one line of source text for pricing-shaped values. A shape alone is
 * never enough — `line` must also carry a pricing-domain keyword (R2). Pure
 * and synchronous so it's directly testable against string fixtures with no
 * filesystem or git access.
 */
export function matchLine(
	line: string,
): Array<{ category: DisclosureCategory; matchedTerm: string }> {
	if (!KEYWORD_PATTERN.test(line)) return [];

	const matches: Array<{ category: DisclosureCategory; matchedTerm: string }> =
		[];

	const currencyMatch = line.match(CURRENCY_SHAPE_PATTERN);
	if (currencyMatch) {
		const category: DisclosureCategory = RATE_SUFFIX_PATTERN.test(
			currencyMatch[0],
		)
			? "rate"
			: "price";
		matches.push({ category, matchedTerm: currencyMatch[0].trim() });
	}

	for (const marginMatch of findMarginMatches(line)) {
		matches.push({ category: "margin", matchedTerm: marginMatch[0].trim() });
	}

	const quotaMatch = line.match(QUOTA_SHAPE_PATTERN);
	if (quotaMatch) {
		matches.push({ category: "quota", matchedTerm: quotaMatch[0].trim() });
	}

	return matches;
}

export interface AddedLine {
	file: string;
	line: number;
	content: string;
}

const HUNK_HEADER_PATTERN = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;
const NEW_FILE_HEADER_PATTERN = /^\+\+\+ b\/(.+)$/;

/**
 * Parses unified diff text (as produced by `git diff --unified=0`) into the
 * set of added lines, tracking each one's file and its line number in the
 * new file's content. `-` (removed) and context lines never advance past
 * what the hunk header already establishes for `+` lines, so this is
 * correct regardless of the context width the diff was generated with.
 */
export function parseAddedLines(diffText: string): AddedLine[] {
	const added: AddedLine[] = [];
	let currentFile: string | null = null;
	let nextLineNumber = 0;

	for (const line of diffText.split("\n")) {
		const fileHeaderMatch = line.match(NEW_FILE_HEADER_PATTERN);
		if (fileHeaderMatch) {
			currentFile = fileHeaderMatch[1] === "/dev/null" ? null : fileHeaderMatch[1];
			continue;
		}
		if (line.startsWith("--- ")) continue;

		const hunkMatch = line.match(HUNK_HEADER_PATTERN);
		if (hunkMatch) {
			nextLineNumber = Number(hunkMatch[1]);
			continue;
		}

		if (line.startsWith("+")) {
			if (currentFile) {
				added.push({
					file: currentFile,
					line: nextLineNumber,
					content: line.slice(1),
				});
			}
			nextLineNumber++;
			continue;
		}
		if (line.startsWith("-")) continue;
		if (currentFile) nextLineNumber++;
	}

	return added;
}

export function isExcludedPath(file: string): boolean {
	return EXCLUDED_PATH_PREFIXES.some((prefix) => file.startsWith(prefix));
}

/** Applies `matchLine` to every added line not under an excluded path. */
export function scanAddedLines(addedLines: AddedLine[]): DisclosureFinding[] {
	const findings: DisclosureFinding[] = [];
	for (const addedLine of addedLines) {
		if (isExcludedPath(addedLine.file)) continue;
		for (const match of matchLine(addedLine.content)) {
			findings.push({
				file: addedLine.file,
				line: addedLine.line,
				matchedTerm: match.matchedTerm,
				category: match.category,
			});
		}
	}
	return findings;
}

export function defaultBaseRef(): string {
	const base = process.env.GITHUB_BASE_REF || "main";
	return `origin/${base}`;
}

export interface DisclosureScanResult {
	findings: DisclosureFinding[];
	skipped: boolean;
	detail?: string;
}

/**
 * Diffs the working tree against the merge base with `baseRef` and scans
 * every added line. When the merge base can't be determined (shallow clone,
 * detached HEAD with no shared history, first commit in a repo), the scan
 * is reported as skipped rather than silently passing or failing against no
 * data — its absence is stated, not hidden, the same philosophy as the
 * constitution tier-two check when the sync script isn't reachable.
 */
export function runDisclosureScan(
	rootDir: string,
	baseRef: string = defaultBaseRef(),
): DisclosureScanResult {
	let mergeBase: string;
	try {
		mergeBase = execFileSync("git", ["merge-base", baseRef, "HEAD"], {
			cwd: rootDir,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();
	} catch {
		return {
			findings: [],
			skipped: true,
			detail: `could not determine merge base against ${baseRef}`,
		};
	}

	let diffOutput: string;
	try {
		diffOutput = execFileSync(
			"git",
			["diff", "--unified=0", `${mergeBase}...HEAD`],
			{
				cwd: rootDir,
				encoding: "utf8",
				stdio: ["ignore", "pipe", "pipe"],
				maxBuffer: 32 * 1024 * 1024,
			},
		);
	} catch {
		return {
			findings: [],
			skipped: true,
			detail: `could not diff against merge base ${mergeBase}`,
		};
	}

	const addedLines = parseAddedLines(diffOutput);
	return { findings: scanAddedLines(addedLines), skipped: false };
}
