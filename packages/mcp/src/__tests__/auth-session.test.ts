import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearAllSessions, loadSession, saveSession } from "../session-store.js";

vi.mock("@vocoder/plugin", () => ({ vocoder: () => ({ name: "vocoder" }) }));

const pollMock = vi.fn();

vi.mock("@vocoder/cli/lib", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@vocoder/cli/lib")>();
	return {
		...actual,
		detectRepoIdentity: () => ({ repoCanonical: "github:acme/app", appDir: "" }),
		verifyStoredAuth: vi.fn().mockResolvedValue({ status: "none" }),
		writeAuthData: vi.fn(),
		VocoderAPI: vi.fn().mockImplementation(() => ({
			lookupAppByRepo: vi.fn().mockResolvedValue({ existingApps: [] }),
			startCliAuthSession: vi.fn().mockResolvedValue({
				sessionId: "sess-pending-1",
				verificationUrl: "https://vocoder.app/verify?code=abc",
				expiresAt: new Date(Date.now() + 300000).toISOString(),
			}),
			pollCliAuthSession: pollMock,
			getCliUserInfo: vi.fn().mockResolvedValue({
				userId: "u1",
				email: "e@example.com",
				name: "E",
			}),
		})),
	};
});

const { runInitStart, runInitComplete } = await import("../tools/create-project.js");

describe("auth handoff", () => {
	beforeEach(() => {
		clearAllSessions();
		pollMock.mockReset();
	});

	it("returns promptly when sign-in has not finished, instead of blocking", async () => {
		// The old implementation looped for five minutes here. Most MCP clients
		// time out long before that, killing the call while the auth session was
		// still valid and leaving no way to resume.
		pollMock.mockResolvedValue({ status: "pending" });
		const { sessionId } = await runInitStart({});

		const started = Date.now();
		const result = await runInitComplete({ sessionId });
		const elapsed = Date.now() - started;

		expect(result.pending).toBe(true);
		expect(result.authenticated).toBe(false);
		expect(result.instructions).toMatch(/call vocoder_init_complete again/i);
		expect(elapsed).toBeLessThan(2000);
	});

	it("polls once per call rather than in a loop", async () => {
		pollMock.mockResolvedValue({ status: "pending" });
		const { sessionId } = await runInitStart({});
		await runInitComplete({ sessionId });
		expect(pollMock).toHaveBeenCalledTimes(1);
	});

	it("completes on a later call with the same sessionId", async () => {
		pollMock.mockResolvedValueOnce({ status: "pending" });
		const { sessionId } = await runInitStart({});
		expect((await runInitComplete({ sessionId })).pending).toBe(true);

		pollMock.mockResolvedValueOnce({ status: "complete", token: "tok_1" });
		const done = await runInitComplete({ sessionId });
		expect(done.authenticated).toBe(true);
		expect(done.pending).toBeFalsy();
	});

	it("still fails loudly when the auth session is rejected", async () => {
		pollMock.mockResolvedValue({ status: "failed", reason: "denied" });
		const { sessionId } = await runInitStart({});
		await expect(runInitComplete({ sessionId })).rejects.toThrow(/denied/);
	});
});

describe("session store", () => {
	beforeEach(() => clearAllSessions());

	it("survives a server restart", () => {
		// The setup flow tells the user to restart their editor after adding the
		// API key — which used to destroy the session the next step needs.
		saveSession({
			sessionId: "s1",
			apiUrl: "https://api.test",
			mode: "new",
			expiresAt: new Date(Date.now() + 60_000).toISOString(),
		});
		// A fresh read is what a restarted process does; no in-memory state.
		expect(loadSession("s1")?.apiUrl).toBe("https://api.test");
	});

	it("treats an expired session as absent", () => {
		saveSession({
			sessionId: "old",
			apiUrl: "https://api.test",
			mode: "new",
			expiresAt: new Date(Date.now() - 1000).toISOString(),
		});
		expect(loadSession("old")).toBeNull();
	});

	it("returns null for an unknown session rather than throwing", () => {
		expect(loadSession("nope")).toBeNull();
	});
});
