// Enforces that a spec's Blast Radius section (data-model.md,
// specs/015-blast-radius-spec-section/) is actually filled in, not just
// present as template scaffolding. Mirrors `constitution.ts`'s shape: pure
// file-content checks returning a typed result, no dependency on the rest of
// the gate's control flow.
//
// Resolution follows the same exemption convention already established by
// `resolveTicketFromBranch` and used throughout `index.ts`: a branch naming
// no ticket is exempt (skip), and a ticket with no matching spec on disk is
// also skip, not fail — this check is additive/forward-looking (SC-003), it
// never penalizes a spec that predates the section existing at all.
import fs from "node:fs";
import path from "node:path";
import type { BranchResolution } from "./branch";

export type BlastRadiusStatus = "pass" | "fail" | "skip";

export interface BlastRadiusResult {
	status: BlastRadiusStatus;
	detail: string;
}

const HEADING_BLAST_RADIUS = /^##\s+Blast Radius\b/;
const HEADING_LAYERS_TOUCHED = /^###\s+Layers touched\b/;
const HEADING_DOWNSTREAM_EFFECTS = /^###\s+Downstream effects\b/;
const HEADING_COUPLING_MAP_ENTRIES = /^###\s+Coupling map entries\b/;
const HEADING_JOURNEY_POSITION = /^###\s+Journey position\b/;

interface ProseSubsection {
	name: string;
	heading: RegExp;
}

const PROSE_SUBSECTIONS: ProseSubsection[] = [
	{ name: "Downstream effects", heading: HEADING_DOWNSTREAM_EFFECTS },
	{ name: "Coupling map entries", heading: HEADING_COUPLING_MAP_ENTRIES },
	{ name: "Journey position", heading: HEADING_JOURNEY_POSITION },
];

/**
 * Returns the body text of the first heading matching `headingPattern`, up
 * to (but not including) the next heading of equal or shallower depth, or
 * `null` if no heading matches. Depth-aware so that extracting `## Blast
 * Radius` captures its `###` subsections, while extracting a `###`
 * subsection stops at the next `###` (or `##`) without bleeding into its
 * siblings.
 */
export function extractSection(
	content: string,
	headingPattern: RegExp,
): string | null {
	const lines = content.split("\n");
	let startIndex = -1;
	let startDepth = 0;

	for (let i = 0; i < lines.length; i++) {
		if (headingPattern.test(lines[i])) {
			const depthMatch = lines[i].match(/^#+/);
			startIndex = i;
			startDepth = depthMatch ? depthMatch[0].length : 0;
			break;
		}
	}
	if (startIndex === -1) return null;

	let endIndex = lines.length;
	for (let i = startIndex + 1; i < lines.length; i++) {
		const headingMatch = lines[i].match(/^(#{1,6})\s/);
		if (headingMatch && headingMatch[1].length <= startDepth) {
			endIndex = i;
			break;
		}
	}

	return lines.slice(startIndex + 1, endIndex).join("\n");
}

/**
 * A subsection counts as blank if it has no content besides whitespace, or
 * if its entire content is still the template's own bracketed placeholder
 * (e.g. `[For each layer...]`) with nothing added. "None" — or any other
 * real prose, including prose that happens to mention brackets — passes.
 */
export function isBlankOrPlaceholder(sectionBody: string): boolean {
	const trimmed = sectionBody.trim();
	if (trimmed.length === 0) return true;
	return /^\[[^\]]*\]$/.test(trimmed);
}

/**
 * Locates the `<ticket>-`-prefixed directory beneath `rootDir`'s `specs/`
 * directory and returns the path to its `spec.md`, using a plain prefix
 * scan (`fs.readdirSync`) rather than pulling in a glob dependency, matching
 * this codebase's existing plain-fs style. Returns `null` when no matching
 * directory — or no `spec.md` inside it — exists.
 */
function findSpecPath(rootDir: string, ticket: string): string | null {
	const specsDir = path.join(rootDir, "specs");
	if (!fs.existsSync(specsDir)) return null;

	const prefix = `${ticket}-`;
	const match = fs
		.readdirSync(specsDir, { withFileTypes: true })
		.find((entry) => entry.isDirectory() && entry.name.startsWith(prefix));
	if (!match) return null;

	const specPath = path.join(specsDir, match.name, "spec.md");
	return fs.existsSync(specPath) ? specPath : null;
}

export function checkBlastRadius(
	rootDir: string,
	branchResolution: BranchResolution,
): BlastRadiusResult {
	if (branchResolution.exempt) {
		return {
			status: "skip",
			detail: `branch "${branchResolution.branch}" names no ticket — exempt`,
		};
	}

	const specPath = findSpecPath(rootDir, branchResolution.ticket);
	if (!specPath) {
		return {
			status: "skip",
			detail: `no specs/${branchResolution.ticket}-*/spec.md found — nothing to check`,
		};
	}

	const relPath = path.relative(rootDir, specPath);
	const content = fs.readFileSync(specPath, "utf8");

	if (extractSection(content, HEADING_BLAST_RADIUS) === null) {
		return { status: "fail", detail: `${relPath} — Blast Radius section missing` };
	}

	if (extractSection(content, HEADING_LAYERS_TOUCHED) === null) {
		return {
			status: "fail",
			detail: `${relPath} — Layers touched subsection missing`,
		};
	}

	for (const { name, heading } of PROSE_SUBSECTIONS) {
		const body = extractSection(content, heading);
		if (body === null) {
			return { status: "fail", detail: `${relPath} — ${name} subsection missing` };
		}
		if (isBlankOrPlaceholder(body)) {
			return { status: "fail", detail: `${relPath} — ${name} subsection is blank` };
		}
	}

	return { status: "pass", detail: `${relPath} — Blast Radius section complete` };
}
