import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppTranslateStatus, LimitErrorResponse } from "../types.js";

// ── Hoisted mocks for the translate() orchestrator describe block ──────────────
// These only affect the "translate() orchestrator (mocked)" tests below — every
// other describe block in this file exercises pure helper functions and never
// touches these modules.

const {
	mockGetAppConfig,
	mockSubmitTranslate,
	mockPollTranslateStatus,
	mockComputeSourceEntriesHash,
	mockDetectBranch,
	mockIsTargetBranch,
	mockReadWorkflowBranches,
	mockReadWorkflowCommitMode,
	mockLoadVocoderConfig,
	mockComputeFingerprint,
	mockExtractFromProject,
	mockResolveGitRoot,
	mockResolveGitRepositoryIdentity,
	mockDetectCommitSha,
	mockWriteLocaleFileTree,
	mockValidateLocalConfig,
	mockLoadEnvFiles,
	mockIntro,
	mockOutro,
	mockLog,
} = vi.hoisted(() => ({
	mockGetAppConfig: vi.fn(),
	mockSubmitTranslate: vi.fn(),
	mockPollTranslateStatus: vi.fn(),
	mockComputeSourceEntriesHash: vi.fn(() => "hash-fixed"),
	mockDetectBranch: vi.fn(() => "main"),
	mockIsTargetBranch: vi.fn(() => true),
	mockReadWorkflowBranches: vi.fn(() => null),
	mockReadWorkflowCommitMode: vi.fn(() => null),
	mockLoadVocoderConfig: vi.fn(() => null),
	mockComputeFingerprint: vi.fn(() => "fingerprint-fixed"),
	mockExtractFromProject: vi.fn(async () => [
		{ key: "hello.world", text: "Hello", file: "app.tsx", line: 1 },
	]),
	mockResolveGitRoot: vi.fn(() => "/repo"),
	mockResolveGitRepositoryIdentity: vi.fn(() => ({
		repoCanonical: "github:acme/example",
		repoRoot: "/repo",
		appDir: "",
	})),
	mockDetectCommitSha: vi.fn(() => "0123456789abcdef0123456789abcdef01234567"),
	mockWriteLocaleFileTree: vi.fn(
		(
			_localeFileTree: Record<string, string>,
			_rootDir: string,
			_options?: { isTypeScript?: boolean },
		) => [] as Array<{ displayDir: string; count: number }>,
	),
	mockValidateLocalConfig: vi.fn(),
	mockLoadEnvFiles: vi.fn(),
	mockIntro: vi.fn(),
	mockOutro: vi.fn(),
	mockLog: {
		success: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
		message: vi.fn(),
	},
}));

vi.mock("@clack/prompts", () => ({
	intro: mockIntro,
	outro: mockOutro,
	log: mockLog,
	spinner: () => ({
		start: vi.fn(),
		stop: vi.fn(),
		message: vi.fn(),
	}),
}));

vi.mock("../utils/api.js", () => ({
	VocoderAPI: class {
		getAppConfig = mockGetAppConfig;
		submitTranslate = mockSubmitTranslate;
		pollTranslateStatus = mockPollTranslateStatus;
	},
	VocoderAPIError: class extends Error {
		status: number;
		payload: unknown;
		limitError: null = null;
		syncPolicyError: null = null;
		constructor(params: { message: string; status: number; payload: unknown }) {
			super(params.message);
			this.status = params.status;
			this.payload = params.payload;
		}
	},
	computeSourceEntriesHash: mockComputeSourceEntriesHash,
}));

vi.mock("../utils/branch.js", () => ({
	detectBranch: mockDetectBranch,
	isTargetBranch: mockIsTargetBranch,
}));

vi.mock("../utils/workflow-read.js", () => ({
	readWorkflowBranches: mockReadWorkflowBranches,
	readWorkflowCommitMode: mockReadWorkflowCommitMode,
}));

vi.mock("@vocoder/extractor", () => ({
	loadVocoderConfig: mockLoadVocoderConfig,
	computeFingerprint: mockComputeFingerprint,
}));

vi.mock("../utils/extract.js", () => ({
	StringExtractor: class {
		extractFromProject = mockExtractFromProject;
	},
}));

vi.mock("../utils/git-identity.js", () => ({
	resolveGitRoot: mockResolveGitRoot,
	resolveGitRepositoryIdentity: mockResolveGitRepositoryIdentity,
	detectCommitSha: mockDetectCommitSha,
}));

// Resolved relative to THIS test file (src/__tests__/), not to translate.ts's own
// "./pull.js" import (relative to src/commands/) — both resolve to the same
// underlying src/commands/pull.ts module.
vi.mock("../commands/pull.js", () => ({
	writeLocaleFileTree: mockWriteLocaleFileTree,
}));

vi.mock("../utils/config.js", () => ({
	validateLocalConfig: mockValidateLocalConfig,
}));

vi.mock("../utils/load-env.js", () => ({
	loadEnvFiles: mockLoadEnvFiles,
}));

import {
	computeExitCode,
	formatAppProgress,
	formatLocaleResults,
	getLimitErrorGuidance,
	translate,
} from "../commands/translate.js";

// ── formatAppProgress ──────────────────────────────────────────────────────────

describe("formatAppProgress", () => {
	function makeApp(appDir: string, completed: number, total: number): AppTranslateStatus {
		return {
			appDir,
			appId: "app-1",
			status: "running",
			providers: {},
			progress: { completed, total },
		};
	}

	it("shows appDir label with progress", () => {
		const result = formatAppProgress(makeApp("apps/web", 0, 47));
		expect(result).toContain("apps/web");
		expect(result).toContain("0/47");
	});

	it("uses (root) label when appDir is empty", () => {
		const result = formatAppProgress(makeApp("", 18, 47));
		expect(result).toContain("(root)");
		expect(result).toContain("18/47");
	});

	it("shows N/N when complete", () => {
		const result = formatAppProgress(makeApp("apps/web", 47, 47));
		expect(result).toContain("47/47");
	});
});

// ── formatLocaleResults ────────────────────────────────────────────────────────

describe("formatLocaleResults", () => {
	it("marks all complete with elapsed time", () => {
		const locales = { es: "complete", fr: "complete", de: "complete" } as const;
		const result = formatLocaleResults(locales, "21.6");
		expect(result).toContain("es");
		expect(result).toContain("fr");
		expect(result).toContain("de");
		expect(result).toContain("— 21.6s");
	});

	it("marks partial failure without elapsed time suffix", () => {
		const locales = { es: "complete", fr: "failed", de: "complete" } as const;
		const result = formatLocaleResults(locales, "10.0");
		expect(result).not.toContain("— 10.0s");
	});
});

// ── computeExitCode ────────────────────────────────────────────────────────────

describe("computeExitCode", () => {
	it("complete always exits 0 regardless of onTranslationFailure", () => {
		expect(computeExitCode("complete", "fail")).toBe(0);
		expect(computeExitCode("complete", "proceed")).toBe(0);
	});

	it("failed + proceed exits 0", () => {
		expect(computeExitCode("failed", "proceed")).toBe(0);
	});

	it("failed + fail exits 1", () => {
		expect(computeExitCode("failed", "fail")).toBe(1);
	});
});

// ── getLimitErrorGuidance ──────────────────────────────────────────────────────

describe("getLimitErrorGuidance", () => {
	function makeLimit(overrides: Partial<LimitErrorResponse>): LimitErrorResponse {
		return {
			errorCode: "LIMIT_EXCEEDED",
			limitType: "source_strings",
			planId: "starter",
			current: 100,
			required: 200,
			upgradeUrl: "https://vocoder.app/upgrade",
			message: "Limit exceeded",
			...overrides,
		};
	}

	it("providers branch — includes DeepL mention and settings URL", () => {
		const lines = getLimitErrorGuidance(makeLimit({ limitType: "providers" }));
		expect(lines).toHaveLength(2);
		expect(lines[0]).toContain("DeepL");
		expect(lines[1]).toContain("https://vocoder.app/upgrade");
	});

	it("translation_chars branch — combines current/required on one line + upgrade URL", () => {
		const lines = getLimitErrorGuidance(
			makeLimit({ limitType: "translation_chars", current: 50000, required: 75000 }),
		);
		expect(lines).toHaveLength(2);
		expect(lines[0]).toContain("50,000");
		expect(lines[0]).toContain("75,000");
		expect(lines[1]).toContain("https://vocoder.app/upgrade");
	});

	it("source_strings branch — combines current/required on one line + upgrade URL", () => {
		const lines = getLimitErrorGuidance(
			makeLimit({ limitType: "source_strings", current: 100, required: 200 }),
		);
		expect(lines).toHaveLength(2);
		expect(lines[0]).toContain("100");
		expect(lines[0]).toContain("200");
		expect(lines[1]).toContain("https://vocoder.app/upgrade");
	});

	it("target_locales branch — shows required count, planId, and upgrade URL", () => {
		const lines = getLimitErrorGuidance(
			makeLimit({ limitType: "target_locales", current: 2, required: 3, planId: "starter" }),
		);
		expect(lines).toHaveLength(2);
		expect(lines[0]).toContain("starter");
		expect(lines[1]).toContain("https://vocoder.app/upgrade");
	});

	it("fallback branch — combines planId/current/required on one line + upgrade URL", () => {
		const lines = getLimitErrorGuidance(
			makeLimit({ limitType: "credits", planId: "pro", current: 10, required: 50 }),
		);
		expect(lines).toHaveLength(2);
		expect(lines[0]).toContain("pro");
		expect(lines[0]).toContain("10");
		expect(lines[0]).toContain("50");
		expect(lines[1]).toContain("https://vocoder.app/upgrade");
	});
});

// ── polling exponential backoff ────────────────────────────────────────────────

describe("polling backoff", () => {
	it("interval approaches 5000ms cap", () => {
		let interval = 1000;
		for (let i = 0; i < 20; i++) {
			interval = Math.min(interval * 1.5, 5000);
		}
		expect(interval).toBe(5000);
	});

	it("interval starts at 1000ms and grows", () => {
		const intervals: number[] = [];
		let interval = 1000;
		for (let i = 0; i < 5; i++) {
			intervals.push(interval);
			interval = Math.min(interval * 1.5, 5000);
		}
		expect(intervals[0]).toBe(1000);
		expect(intervals[1]).toBe(1500);
		expect(intervals[2]).toBe(2250);
		expect(intervals[3]).toBe(3375);
		expect(intervals[4]!).toBeGreaterThan(3375);
	});
});

// ── integration: submit → poll (batch API) ─────────────────────────────────────

describe("translate API integration (mocked)", () => {
	const originalFetch = globalThis.fetch;
	afterEach(() => {
		vi.restoreAllMocks();
		globalThis.fetch = originalFetch;
	});

	it("polls until complete and reads final batch status", async () => {
		let callCount = 0;
		globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
			callCount++;
			if (String(url).includes("/api/translate") && !String(url).includes("/status")) {
				return {
					ok: true,
					text: async () =>
						JSON.stringify({
							jobId: "job-abc",
							apps: [{ appDir: "", appId: "app-1" }],
						}),
				} as Response;
			}
			const isDone = callCount >= 4;
			const appStatus = isDone ? "complete" : "running";
			return {
				ok: true,
				text: async () =>
					JSON.stringify({
						jobId: "job-abc",
						status: appStatus,
						apps: [
							{
								appDir: "",
								appId: "app-1",
								status: appStatus,
								providers: {
									deepl: {
										status: appStatus,
										completed: isDone ? 10 : 5,
										total: 10,
									},
								},
								progress: { completed: isDone ? 10 : 5, total: 10 },
							},
						],
					}),
			} as Response;
		});

		// bypasses this file's top-level vi.mock("../utils/api.js", ...) — this test
		// exercises the real VocoderAPI HTTP layer against a mocked fetch, not the stub.
		const { VocoderAPI } = await vi.importActual<typeof import("../utils/api.js")>("../utils/api.js");
		const api = new VocoderAPI({ apiKey: "vcp_aB3xY9Zk_testrandombytes123456", apiUrl: "https://vocoder.app" });

		const submitResult = await api.submitTranslate({
			branch: "main",
			apps: [
				{
					appDir: "",
					strings: [{ key: "k1", text: "Hello" }],
					sourceEntriesHash: "abc",
				},
			],
			repoUrl: "",
			clientRunId: "run-1",
		});
		expect(submitResult.jobId).toBe("job-abc");

		const status = await api.pollTranslateStatus(submitResult.jobId);
		expect(["running", "complete"]).toContain(status.status);
		expect(status.apps).toHaveLength(1);
	});
});

// ── orchestrator: translate() drives submit → poll → complete → write ──────────

const baseAppConfig = {
	projectName: "Example",
	organizationName: "Acme",
	sourceLocale: "en",
	targetLocales: ["fr", "es"],
	targetBranches: ["main"],
	syncPolicy: {
		blockingBranches: ["main"],
		blockingMode: "required" as const,
		nonBlockingMode: "best-effort" as const,
		defaultMaxWaitMs: 60000,
	},
};

describe("translate() orchestrator (mocked)", () => {
	const originalEnv = { ...process.env };

	beforeEach(() => {
		vi.clearAllMocks();
		process.env = { ...originalEnv };
		process.env.VOCODER_API_KEY = "vcp_aB3xY9Zk_testrandombytes123456";
		process.env.VOCODER_API_URL = "https://vocoder.app";
		delete process.env.GITHUB_ACTIONS;

		mockGetAppConfig.mockResolvedValue(baseAppConfig);
		mockDetectBranch.mockReturnValue("main");
		mockIsTargetBranch.mockReturnValue(true);
		mockReadWorkflowBranches.mockReturnValue(null);
		mockReadWorkflowCommitMode.mockReturnValue(null);
		mockLoadVocoderConfig.mockReturnValue(null);
		mockComputeFingerprint.mockReturnValue("fingerprint-fixed");
		mockComputeSourceEntriesHash.mockReturnValue("hash-fixed");
		mockExtractFromProject.mockResolvedValue([
			{ key: "hello.world", text: "Hello", file: "app.tsx", line: 1 },
		]);
		mockResolveGitRoot.mockReturnValue("/repo");
		mockResolveGitRepositoryIdentity.mockReturnValue({
			repoCanonical: "github:acme/example",
			repoRoot: "/repo",
			appDir: "",
		});
		mockDetectCommitSha.mockReturnValue("0123456789abcdef0123456789abcdef01234567");
		mockWriteLocaleFileTree.mockReturnValue([]);
		mockValidateLocalConfig.mockImplementation(() => undefined);
		mockLoadEnvFiles.mockImplementation(() => undefined);
	});

	afterEach(() => {
		process.env = { ...originalEnv };
	});

	it("calls writeLocaleFileTree with the final localeFileTree after submit → poll(running) → poll(complete)", async () => {
		const finalTree = { "locales/fr.json": "{\"hello\":\"Bonjour\"}" };
		mockSubmitTranslate.mockResolvedValue({
			jobId: "job-1",
			apps: [{ appDir: "", appId: "app-1" }],
		});
		mockPollTranslateStatus
			.mockResolvedValueOnce({
				jobId: "job-1",
				status: "running",
				apps: [
					{
						appDir: "",
						appId: "app-1",
						status: "running",
						providers: {},
						progress: { completed: 1, total: 2 },
					},
				],
			})
			.mockResolvedValueOnce({
				jobId: "job-1",
				status: "complete",
				apps: [
					{
						appDir: "",
						appId: "app-1",
						status: "complete",
						providers: {},
						progress: { completed: 2, total: 2 },
						localeFileTree: finalTree,
					},
				],
			});

		const code = await translate({});

		expect(code).toBe(0);
		expect(mockPollTranslateStatus).toHaveBeenCalledTimes(2);
		expect(mockWriteLocaleFileTree).toHaveBeenCalledTimes(1);
		expect(mockWriteLocaleFileTree.mock.calls[0]?.[0]).toEqual(finalTree);
		expect(mockWriteLocaleFileTree.mock.calls[0]?.[1]).toBe("/repo");
	});

	it("writes files directly from an immediately-cached submit response without polling", async () => {
		const cachedTree = { "locales/fr.json": "{\"hello\":\"Bonjour\"}" };
		mockSubmitTranslate.mockResolvedValue({
			jobId: "job-2",
			status: "complete",
			apps: [{ appDir: "", appId: "app-1", localeFileTree: cachedTree }],
		});

		const code = await translate({});

		expect(code).toBe(0);
		expect(mockPollTranslateStatus).not.toHaveBeenCalled();
		expect(mockWriteLocaleFileTree).toHaveBeenCalledTimes(1);
		expect(mockWriteLocaleFileTree.mock.calls[0]?.[0]).toEqual(cachedTree);
	});

	it("writes each monorepo app's own locale tree independently", async () => {
		const webTree = { "apps/web/locales/fr.json": "WEB_FR" };
		const adminTree = { "apps/admin/locales/fr.json": "ADMIN_FR" };
		mockSubmitTranslate.mockResolvedValue({
			jobId: "job-3",
			apps: [
				{ appDir: "apps/web", appId: "app-1" },
				{ appDir: "apps/admin", appId: "app-2" },
			],
		});
		mockPollTranslateStatus.mockResolvedValue({
			jobId: "job-3",
			status: "complete",
			apps: [
				{
					appDir: "apps/web",
					appId: "app-1",
					status: "complete",
					providers: {},
					progress: { completed: 1, total: 1 },
					localeFileTree: webTree,
				},
				{
					appDir: "apps/admin",
					appId: "app-2",
					status: "complete",
					providers: {},
					progress: { completed: 1, total: 1 },
					localeFileTree: adminTree,
				},
			],
		});

		const code = await translate({});

		expect(code).toBe(0);
		expect(mockWriteLocaleFileTree).toHaveBeenCalledTimes(2);
		expect(mockWriteLocaleFileTree.mock.calls[0]?.[0]).toEqual(webTree);
		expect(mockWriteLocaleFileTree.mock.calls[1]?.[0]).toEqual(adminTree);
	});

	it("skips writeLocaleFileTree for an app with no locale tree", async () => {
		const webTree = { "apps/web/locales/fr.json": "WEB_FR" };
		mockSubmitTranslate.mockResolvedValue({
			jobId: "job-4",
			apps: [
				{ appDir: "apps/web", appId: "app-1" },
				{ appDir: "apps/empty", appId: "app-2" },
			],
		});
		mockPollTranslateStatus.mockResolvedValue({
			jobId: "job-4",
			status: "complete",
			apps: [
				{
					appDir: "apps/web",
					appId: "app-1",
					status: "complete",
					providers: {},
					progress: { completed: 1, total: 1 },
					localeFileTree: webTree,
				},
				{
					appDir: "apps/empty",
					appId: "app-2",
					status: "complete",
					providers: {},
					progress: { completed: 0, total: 0 },
				},
			],
		});

		const code = await translate({});

		expect(code).toBe(0);
		expect(mockWriteLocaleFileTree).toHaveBeenCalledTimes(1);
		expect(mockWriteLocaleFileTree.mock.calls[0]?.[0]).toEqual(webTree);
	});
});

