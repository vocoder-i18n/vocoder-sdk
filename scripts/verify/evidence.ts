// Renders the reviewer's evidence block. Pure formatting — no I/O, no
// process access — so it can be exercised directly against a constructed
// GateResult. Shape matches
// specs/022-verify-acceptance-manifest/contracts/verify-cli.md.
import type {
	CheckResult,
	CriterionResult,
	DisclosureFinding,
	GateResult,
} from "./types";

function formatCheckRow(check: CheckResult): string {
	const label = check.detail
		? `${check.outcome} — ${check.detail}`
		: check.outcome;
	return `| ${check.name} | ${label} |`;
}

function formatCriterionRow(criterion: CriterionResult): string {
	return `| ${criterion.id} | ${criterion.statement} | \`${criterion.evidenceRef}\` | ${criterion.outcome} |`;
}

function formatDisclosureRow(finding: DisclosureFinding): string {
	return `| ${finding.file} | ${finding.line} | "${finding.matchedTerm}" | ${finding.category} |`;
}

export function renderEvidence(
	result: GateResult,
	ticket: string | null,
): string {
	const lines: string[] = [];

	lines.push("## Gate", "", "| Check | Result |", "|---|---|");
	for (const check of result.checks) {
		lines.push(formatCheckRow(check));
	}

	if (result.disclosureFindings.length > 0) {
		lines.push(
			"",
			"## Disclosure findings",
			"",
			"| File | Line | Matched term | Category |",
			"|---|---|---|---|",
		);
		for (const finding of result.disclosureFindings) {
			lines.push(formatDisclosureRow(finding));
		}
	}

	if (ticket) {
		const tested = result.criteria.filter((c) => c.outcome !== "observational");
		const observational = result.criteria.filter(
			(c) => c.outcome === "observational",
		);

		lines.push("", `## Acceptance criteria — ${ticket}`, "");
		lines.push("| AC | Statement | Evidence | Result |", "|---|---|---|---|");
		for (const criterion of tested) {
			lines.push(formatCriterionRow(criterion));
		}

		if (observational.length > 0) {
			lines.push("", "### Proven by observation", "");
			lines.push("| AC | Statement | Reference |", "|---|---|---|");
			for (const criterion of observational) {
				lines.push(
					`| ${criterion.id} | ${criterion.statement} | ${criterion.evidenceRef} |`,
				);
			}
		}
	}

	return `${lines.join("\n")}\n`;
}
