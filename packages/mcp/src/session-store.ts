import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/**
 * Disk-backed store for in-flight `vocoder_init_*` sessions.
 *
 * These used to live in a `Map` on the server process. That map did not survive
 * a restart — and the setup flow's own instructions tell the user to restart
 * their editor after adding the API key, so the session was routinely destroyed
 * by the very step that follows it. Sessions now sit next to `auth.json` so a
 * restart mid-flow is recoverable.
 *
 * Not a cache: losing this file means the user re-runs `vocoder_init_start`,
 * which is the same recovery as before, just no longer the common case.
 */
export interface PersistedSession {
	sessionId: string;
	apiUrl: string;
	repoCanonical?: string;
	repoAppDir?: string;
	mode: "new" | "existing";
	storedToken?: string;
	resolvedToken?: string;
	pollOrganizationId?: string;
	/** ISO timestamp; sessions past this are treated as absent. */
	expiresAt: string;
}

const sessionsPath = () => join(homedir(), ".vocoder", "mcp-sessions.json");

function readAll(): Record<string, PersistedSession> {
	const p = sessionsPath();
	if (!existsSync(p)) return {};
	try {
		const parsed = JSON.parse(readFileSync(p, "utf8")) as Record<
			string,
			PersistedSession
		>;
		const now = Date.now();
		// Drop expired entries on every read so the file cannot grow without bound.
		return Object.fromEntries(
			Object.entries(parsed).filter(([, s]) => Date.parse(s.expiresAt) > now),
		);
	} catch {
		// A corrupt file is not worth failing setup over — treat as empty.
		return {};
	}
}

function writeAll(sessions: Record<string, PersistedSession>): void {
	const p = sessionsPath();
	try {
		mkdirSync(dirname(p), { recursive: true });
		writeFileSync(p, JSON.stringify(sessions, null, 2), { mode: 0o600 });
	} catch {
		// Best effort. An unwritable home directory degrades to the old
		// in-process behaviour rather than breaking the flow.
	}
}

export function saveSession(session: PersistedSession): void {
	const all = readAll();
	all[session.sessionId] = session;
	writeAll(all);
}

export function loadSession(sessionId: string): PersistedSession | null {
	return readAll()[sessionId] ?? null;
}

export function deleteSession(sessionId: string): void {
	const all = readAll();
	if (!(sessionId in all)) return;
	delete all[sessionId];
	writeAll(all);
}

/** Test helper — removes the store entirely. */
export function clearAllSessions(): void {
	try {
		rmSync(sessionsPath(), { force: true });
	} catch {
		// nothing to clear
	}
}
