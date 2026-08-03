// Branch → ticket resolution. A leading three-digit ticket number makes a
// record required; its absence makes the branch exempt. This is the same
// signal used everywhere else a ticket number is derived from a branch name,
// so exemption cannot silently disagree with the record requirement.
import { execFileSync } from "node:child_process";

const TICKET_BRANCH_PATTERN = /^(\d{3})-/;

export type BranchResolution =
	| { exempt: true; branch: string }
	| { exempt: false; branch: string; ticket: string };

export function resolveTicketFromBranch(branchName: string): BranchResolution {
	const match = branchName.match(TICKET_BRANCH_PATTERN);
	if (!match) return { exempt: true, branch: branchName };
	return { exempt: false, branch: branchName, ticket: match[1] };
}

/**
 * On a `pull_request` trigger, GitHub Actions checks out a detached-HEAD
 * merge ref (`refs/pull/N/merge`), so `git rev-parse --abbrev-ref HEAD`
 * resolves to the literal string "HEAD" rather than the source branch — the
 * one case where branch-derived ticket resolution matters most (a PR is
 * exactly what the gate blocks). `GITHUB_HEAD_REF` carries the real source
 * branch name in that context; `GITHUB_REF_NAME` covers plain pushes. Both
 * are unset locally, where `git rev-parse` is correct.
 */
export function getCurrentBranch(rootDir: string): string {
	const fromEnv = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME;
	if (fromEnv) return fromEnv;

	return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
		cwd: rootDir,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();
}
