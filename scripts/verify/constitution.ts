// Rule-drift detection. Two tiers:
//
// Tier one — content-versus-marker. The repo's constitution copy carries its
// own `<!-- hash: … -->` marker next to the STAMPED block. Recomputing the
// hash of that block and comparing it to the marker catches hand-editing,
// and needs nothing but the file itself, so it runs everywhere, including CI
// (which checks out only this repo).
//
// Tier two — copy-versus-workspace-source. `../scripts/sync-constitution.sh
// --check` compares the copy against the root CONSTITUTION.md by content
// hash. That catches staleness (the source changed, the copy never got
// regenerated), but needs both repos on disk, so it only runs locally. When
// the script isn't reachable, tier two is reported as skipped rather than
// silently treated as passed — its absence in CI is stated, not hidden.
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const STAMPED_BEGIN = "<!-- STAMPED:BEGIN -->";
const STAMPED_END = "<!-- STAMPED:END -->";
const HASH_LINE = /^<!-- hash: ([a-f0-9]{64}) -->$/;

export interface TierOneResult {
	ok: boolean;
	declaredHash: string | null;
	computedHash: string | null;
	reason?: string;
}

export function extractDeclaredHash(content: string): string | null {
	const match = content.match(/<!-- hash: ([a-f0-9]{64}) -->/);
	return match ? match[1] : null;
}

/**
 * Recomputes the hash of the STAMPED block exactly as
 * `../scripts/sync-constitution.sh` does: the lines between the BEGIN/END
 * markers, excluding the hash-marker line itself, joined with "\n" and
 * sha256-hashed. Verified against the real repo file's own declared hash
 * before being relied on here.
 */
export function computeStampedHash(content: string): string | null {
	const lines = content.split("\n");
	let inStamped = false;
	const collected: string[] = [];

	for (const line of lines) {
		if (line.includes(STAMPED_BEGIN)) {
			inStamped = true;
			continue;
		}
		if (line.includes(STAMPED_END)) {
			inStamped = false;
			continue;
		}
		if (inStamped && !HASH_LINE.test(line.trim())) {
			collected.push(line);
		}
	}

	if (collected.length === 0) return null;
	return crypto.createHash("sha256").update(collected.join("\n")).digest("hex");
}

export function checkTierOne(content: string): TierOneResult {
	const declaredHash = extractDeclaredHash(content);
	const computedHash = computeStampedHash(content);

	if (declaredHash === null) {
		return {
			ok: false,
			declaredHash,
			computedHash,
			reason: "no hash marker found",
		};
	}
	if (computedHash === null) {
		return {
			ok: false,
			declaredHash,
			computedHash,
			reason: "no STAMPED block found",
		};
	}
	return { ok: declaredHash === computedHash, declaredHash, computedHash };
}

export interface TierTwoResult {
	status: "pass" | "fail" | "skipped";
	detail: string;
}

export function checkTierTwo(rootDir: string): TierTwoResult {
	const scriptPath = path.join(
		rootDir,
		"..",
		"scripts",
		"sync-constitution.sh",
	);
	if (!fs.existsSync(scriptPath)) {
		return {
			status: "skipped",
			detail:
				"../scripts/sync-constitution.sh not reachable — expected in CI, which checks out only this repo",
		};
	}

	try {
		execFileSync(scriptPath, ["--check"], {
			cwd: rootDir,
			stdio: ["ignore", "pipe", "pipe"],
		});
		return {
			status: "pass",
			detail: "constitution copy matches workspace source",
		};
	} catch {
		return {
			status: "fail",
			detail:
				"constitution copy is stale relative to the workspace source — run ../scripts/sync-constitution.sh",
		};
	}
}
