import * as p from "@clack/prompts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAuthFlow } from "../utils/auth-flow.js";

vi.mock("@clack/prompts", () => ({
	log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
	confirm: vi.fn(),
	select: vi.fn(),
	cancel: vi.fn(),
	isCancel: vi.fn((v) => v === Symbol.for("clack-cancel")),
}));

vi.mock("../utils/browser.js", () => ({
	tryOpenBrowser: vi.fn().mockResolvedValue(false),
}));

vi.mock("../utils/local-server.js", () => ({
	startCallbackServer: vi.fn().mockRejectedValue(new Error("port conflict")),
}));

const CANCEL = Symbol.for("clack-cancel");

function makeApi(
	overrides: Partial<{
		startCliAuthSession: ReturnType<typeof vi.fn>;
		pollCliAuthSession: ReturnType<typeof vi.fn>;
		getCliUserInfo: ReturnType<typeof vi.fn>;
	}> = {},
) {
	return {
		startCliAuthSession: vi.fn().mockResolvedValue({
			sessionId: "sess-1",
			verificationUrl: "https://vocoder.app/auth/cli?session=sess-1",
			expiresAt: new Date(Date.now() + 60_000).toISOString(),
		}),
		pollCliAuthSession: vi.fn().mockResolvedValue({ status: "pending" }),
		getCliUserInfo: vi.fn().mockResolvedValue({
			userId: "user-1",
			email: "user@example.com",
			name: "Test User",
		}),
		...overrides,
	} as unknown as Parameters<typeof runAuthFlow>[0];
}

function makeSession() {
	return {
		step: vi.fn(),
		startStep: vi.fn(() => ({
			done: vi.fn(),
			fail: vi.fn(),
		})),
	} as unknown as Parameters<typeof runAuthFlow>[2];
}

beforeEach(() => {
	vi.clearAllMocks();
	Object.defineProperty(process.stdin, "isTTY", {
		value: false,
		configurable: true,
	});
	Object.defineProperty(process.stdout, "isTTY", {
		value: false,
		configurable: true,
	});
});

/**
 * runAuthFlow offers the browser prompt only when
 * `stdin.isTTY && stdout.isTTY && process.env.CI !== "true"`.
 * All three must be simulated: on a CI runner `CI=true` skips the prompt and
 * the flow falls through to session polling, which runs until the session
 * expires. Restores CI afterwards so later tests see the real environment.
 */
function withInteractiveTerminal(): () => void {
	const previousCI = process.env.CI;
	process.env.CI = "false";
	for (const stream of [process.stdin, process.stdout]) {
		Object.defineProperty(stream, "isTTY", {
			value: true,
			configurable: true,
		});
	}
	return () => {
		if (previousCI === undefined) delete process.env.CI;
		else process.env.CI = previousCI;
	};
}

describe("runAuthFlow", () => {
	it("returns null when the user cancels the browser confirm prompt", async () => {
		const restore = withInteractiveTerminal();
		try {
			const api = makeApi();
			const session = makeSession();
			vi.mocked(p.confirm).mockResolvedValue(CANCEL as unknown as boolean);

			const result = await runAuthFlow(api, { yes: false }, session, false);
			expect(result).toBeNull();
			expect(p.cancel).toHaveBeenCalled();
		} finally {
			restore();
		}
	});

	it("returns null when the user declines the browser confirm prompt", async () => {
		const restore = withInteractiveTerminal();
		try {
			const api = makeApi();
			const session = makeSession();
			vi.mocked(p.confirm).mockResolvedValue(false);

			const result = await runAuthFlow(api, { yes: false }, session, false);
			expect(result).toBeNull();
		} finally {
			restore();
		}
	});

	it("does not send any GitHub-App params to startCliAuthSession", async () => {
		const api = makeApi({
			pollCliAuthSession: vi.fn().mockResolvedValue({
				status: "complete",
				token: "test-token",
			}),
		});
		const session = makeSession();

		await runAuthFlow(api, { ci: true }, session, false, "github:owner/repo");

		const startCall = vi.mocked(api.startCliAuthSession).mock.calls[0]!;
		// Args: (callbackPort?, repoCanonical?) — repoCanonical is informational only.
		// No org/install/link params should ever be forwarded.
		expect(startCall.length).toBeLessThanOrEqual(2);
		expect(startCall[1]).toBe("github:owner/repo");
	});

	it("emits VOCODER_AUTH_URL pointing at the verification URL in CI mode", async () => {
		const writeSpy = vi
			.spyOn(process.stdout, "write")
			.mockImplementation(() => true);
		const session = makeSession();
		const api = makeApi({
			pollCliAuthSession: vi.fn().mockResolvedValue({
				status: "complete",
				token: "test-token",
			}),
		});

		await runAuthFlow(api, { ci: true }, session, false);

		const written = writeSpy.mock.calls.map((c) => c[0]).join("");
		expect(written).toContain("VOCODER_AUTH_URL: https://vocoder.app/auth/cli");
		expect(written).toContain("VOCODER_SESSION_ID: sess-1");
		writeSpy.mockRestore();
	});

	it("returns null and logs an error when the session expires without a token", async () => {
		const api = makeApi({
			startCliAuthSession: vi.fn().mockResolvedValue({
				sessionId: "sess-1",
				verificationUrl: "https://vocoder.app/auth/cli",
				expiresAt: new Date(Date.now() - 1000).toISOString(),
			}),
			pollCliAuthSession: vi.fn().mockResolvedValue({ status: "pending" }),
		});
		const session = makeSession();

		const result = await runAuthFlow(api, { ci: true }, session, false);
		expect(result).toBeNull();
		expect(session.startStep).toHaveBeenCalled();
	});

	it("returns the token + user info on a successful poll", async () => {
		const api = makeApi({
			pollCliAuthSession: vi.fn().mockResolvedValue({
				status: "complete",
				token: "good-token",
			}),
		});
		const session = makeSession();

		const result = await runAuthFlow(api, { ci: true }, session, false);
		expect(result).toEqual({
			token: "good-token",
			userId: "user-1",
			email: "user@example.com",
			name: "Test User",
		});
	});
});
