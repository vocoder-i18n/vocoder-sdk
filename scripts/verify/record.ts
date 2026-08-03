// Load and validate the acceptance record. Read-only — the gate never writes
// to a record. See specs/022-verify-acceptance-manifest/data-model.md for the
// exact shape and rules.
import fs from "node:fs";
import path from "node:path";
import type { AcceptanceRecord } from "./types";

export type RecordLoadResult =
	| { ok: true; record: AcceptanceRecord; path: string }
	| { ok: false; kind: "missing"; path: string }
	| { ok: false; kind: "malformed"; path: string; errors: string[] };

export function recordPath(rootDir: string, ticket: string): string {
	return path.join(rootDir, ".vocoder", "acceptance", `${ticket}.json`);
}

export function loadRecord(rootDir: string, ticket: string): RecordLoadResult {
	const filePath = recordPath(rootDir, ticket);
	if (!fs.existsSync(filePath)) {
		return { ok: false, kind: "missing", path: filePath };
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
	} catch (err) {
		return {
			ok: false,
			kind: "malformed",
			path: filePath,
			errors: [`invalid JSON: ${(err as Error).message}`],
		};
	}

	const errors = validateRecordShape(parsed);
	if (errors.length > 0) {
		return { ok: false, kind: "malformed", path: filePath, errors };
	}

	return { ok: true, record: parsed as AcceptanceRecord, path: filePath };
}

/**
 * Pure structural validation, independent of the filesystem, so it can be
 * exercised directly against fixture objects.
 *
 * Rules, per data-model.md:
 * - `ticket` non-empty string.
 * - `criteria` a non-empty array — an empty list is a failure, not a pass.
 * - Each criterion has a unique, non-empty `id` and non-empty `statement`.
 * - Each criterion declares exactly one of `test` or `evidence`. Both present
 *   or both absent is malformed.
 */
export function validateRecordShape(value: unknown): string[] {
	const errors: string[] = [];

	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return ["record must be a JSON object"];
	}
	const rec = value as Record<string, unknown>;

	if (typeof rec.ticket !== "string" || rec.ticket.trim().length === 0) {
		errors.push("`ticket` must be a non-empty string");
	}

	if (!Array.isArray(rec.criteria) || rec.criteria.length === 0) {
		errors.push("`criteria` must be a non-empty array");
		return errors;
	}

	const seenIds = new Set<string>();
	rec.criteria.forEach((entry, index) => {
		if (typeof entry !== "object" || entry === null) {
			errors.push(`criteria[${index}] must be an object`);
			return;
		}
		const criterion = entry as Record<string, unknown>;

		if (typeof criterion.id !== "string" || criterion.id.trim().length === 0) {
			errors.push(`criteria[${index}].id must be a non-empty string`);
		} else if (seenIds.has(criterion.id)) {
			errors.push(`criteria[${index}].id "${criterion.id}" is duplicated`);
		} else {
			seenIds.add(criterion.id);
		}

		if (
			typeof criterion.statement !== "string" ||
			criterion.statement.trim().length === 0
		) {
			errors.push(`criteria[${index}].statement must be a non-empty string`);
		}

		const hasTest =
			typeof criterion.test === "string" && criterion.test.trim().length > 0;
		const hasEvidence =
			typeof criterion.evidence === "object" && criterion.evidence !== null;
		if (hasTest === hasEvidence) {
			errors.push(
				`criteria[${index}] must declare exactly one of \`test\` or \`evidence\``,
			);
		}
	});

	return errors;
}
