import type {
	AppTranslateStatus,
	BatchTranslateStatusResponse,
	TranslateCommandOptions,
	TranslationStringEntry,
} from "../types.js";
import { VocoderAPI, VocoderAPIError } from "../utils/api.js";
import { loadVocoderConfig } from "@vocoder/extractor";
import { detectBranch, isTargetBranch } from "../utils/branch.js";
import { detectCommitSha, resolveGitRepositoryIdentity, resolveGitRoot } from "../utils/git-identity.js";
import {
	readWorkflowBranches,
	readWorkflowCommitMode,
} from "../utils/workflow-read.js";

import type { LimitErrorResponse } from "../types.js";
import { extractApps, resolveAppDirs } from "../utils/extract-apps.js";
import chalk from "chalk";
import {
	CommandSession,
	type CommandStep,
	displayAppDir,
	formatLabelValue,
	joinHighlighted,
} from "../utils/command-session.js";
import { dirname, join, relative, sep } from "node:path";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { writeLocaleFileTree } from "./pull.js";
import { extractProjectShortIdFromApiKey } from "@vocoder/core";
import { highlight } from "../utils/theme.js";
import { loadEnvFiles } from "../utils/load-env.js";
import { randomUUID } from "node:crypto";
import { validateLocalConfig } from "../utils/config.js";

loadEnvFiles();

type LocaleStatus = "pending" | "running" | "complete" | "failed";

/** Returns the in-progress poll line for a single app. Exported for testing. */
export function formatAppProgress(app: AppTranslateStatus): string {
	const { completed, total } = app.progress;
	const label = app.appDir || "(root)";
	return `  ⟳ ${label}: ${completed}/${total}`;
}

/** Returns the final per-locale status line. Exported for testing. */
export function formatLocaleResults(
	locales: Record<string, LocaleStatus>,
	elapsedSec: string,
): string {
	const parts = Object.entries(locales).map(([locale, s]) =>
		s === "complete" ? `${chalk.green("✓")} ${locale}` : `${chalk.red("✗")} ${locale}`,
	);
	const allComplete = Object.values(locales).every((s) => s === "complete");
	const suffix = allComplete ? ` — ${elapsedSec}s` : "";
	return `  ${parts.join("  ")}${suffix}`;
}

/** Returns the correct exit code. Exported for testing. */
export function computeExitCode(
	status: "complete" | "failed",
	onTranslationFailure: "fail" | "proceed",
): number {
	if (status === "complete") return 0;
	return onTranslationFailure === "fail" ? 1 : 0;
}

export function getLimitErrorGuidance(limitError: LimitErrorResponse): string[] {
	if (limitError.limitType === "providers") {
		return [
			"Add a DeepL API key in Dashboard → Workspace Settings → Providers.",
			`Open settings: ${limitError.upgradeUrl}`,
		];
	}
	if (limitError.limitType === "translation_chars") {
		return [
			`Used: ${limitError.current.toLocaleString()} / Needed: ${limitError.required.toLocaleString()} chars`,
			`Upgrade plan: ${limitError.upgradeUrl}`,
		];
	}
	if (limitError.limitType === "source_strings") {
		return [
			`Active strings: ${limitError.current.toLocaleString()} / Needed: ${limitError.required.toLocaleString()}`,
			`Upgrade plan: ${limitError.upgradeUrl}`,
		];
	}
	if (limitError.limitType === "target_locales") {
		return [
			`Locale limit: ${limitError.required} (${limitError.planId} plan allows ${limitError.current})`,
			`Upgrade plan: ${limitError.upgradeUrl}`,
		];
	}
	return [
		`Plan: ${limitError.planId} — Current: ${limitError.current} / Required: ${limitError.required}`,
		`Upgrade: ${limitError.upgradeUrl}`,
	];
}

type TranslateResultApp = {
	appDir: string;
	localeFileTree?: Record<string, string>;
	commitConfig?: { commitMode: string; autoMergePRs: boolean; skipCiOnDirectCommit: boolean };
	/** Paths this run wrote, repo-root-relative. The Action stages exactly these. */
	writtenPaths?: string[];
	/** Paths this run deleted — staged as deletions so they leave the repository. */
	removedPaths?: string[];
	/** Locale files present on disk but no longer a target. Reported, never deleted. */
	orphanedPaths?: string[];
};

type TranslationOutputApp = {
	appDir: string;
	localeFileTree?: Record<string, string>;
};

// Writes a JSON result file for the GitHub Action commit step. No-op outside CI.
//
// `writtenPaths`/`removedPaths` describe what this process actually did to the
// working tree, which is not recoverable from `localeFileTree` alone: a
// TypeScript project turns the server's `locales/loader.js` key into a
// `locales/loader.ts` file and deletes the `.js`. The Action stages this list
// verbatim rather than re-deriving it, so the two halves of the pipeline
// cannot disagree about which files exist.
function writeTranslateResult(
	jobId: string,
	apps: TranslateResultApp[],
	orphanedPaths: string[] = [],
): void {
	if (!process.env.GITHUB_ACTIONS) return;
	const runnerTemp = process.env.RUNNER_TEMP ?? "/tmp";
	try {
		writeFileSync(
			`${runnerTemp}/vocoder-result.json`,
			JSON.stringify(
				{
					jobId,
					status: "complete",
					apps,
					...(orphanedPaths.length > 0 ? { orphanedPaths } : {}),
				},
				null,
				2,
			),
		);
	} catch {
		// Non-fatal — commit step skips if file is absent
	}
}

/**
 * Warns about locale files on disk that are no longer a target, and returns
 * them as repo-root-relative paths.
 *
 * The paths travel into the result file so the Action can repeat the warning
 * as a CI annotation — a locale dropped from the project otherwise leaves its
 * stale `.json` committed forever, and this warning is the only thing that
 * says so. Reported, never deleted: the same "not in the target set" test also
 * matches a file a developer added by hand, and `vocoder clean` is the
 * deliberate, local way to remove them.
 */
function warnOrphanedLocaleFiles(
	session: CommandSession,
	apps: TranslationOutputApp[],
	rootDir: string,
): string[] {
	const writtenPaths = new Set<string>();
	const localeDirs = new Set<string>();

	for (const app of apps) {
		if (!app.localeFileTree) continue;
		for (const relativePath of Object.keys(app.localeFileTree)) {
			writtenPaths.add(join(rootDir, relativePath));
			localeDirs.add(join(rootDir, dirname(relativePath)));
		}
	}

	if (localeDirs.size === 0) return [];

	const orphaned: { name: string; path: string }[] = [];
	for (const dir of localeDirs) {
		if (!existsSync(dir)) continue;
		for (const file of readdirSync(dir)) {
			if (!file.endsWith(".json")) continue;
			if (!writtenPaths.has(join(dir, file))) {
				orphaned.push({
					name: file,
					path: relative(rootDir, join(dir, file)).split(sep).join("/"),
				});
			}
		}
	}

	if (orphaned.length === 0) return [];

	const count = orphaned.length;
	session.warn(
		`${highlight(String(count))} locale file${count === 1 ? "" : "s"} not in target locales: ${orphaned.map((o) => o.name).join(", ")}`,
	);
	session.message(
		`Run ${highlight("vocoder clean")} to remove ${count === 1 ? "it" : "them"}.`,
	);
	return orphaned.map((o) => o.path);
}

/** What `writeLocaleFileTree` did for one app, keyed so the result file can carry it. */
export interface AppWriteOutcome {
	written: string[];
	removed: string[];
}

/**
 * Writes each app's locale tree and reports it. Returns what landed on disk,
 * keyed by appDir, so the result file the Action reads describes real files
 * rather than the server's request.
 */
function renderWrittenLocaleFiles(
	session: CommandSession,
	apps: TranslationOutputApp[],
	rootDir: string,
): Map<string, AppWriteOutcome> {
	const showRootLabel = apps.length > 1;
	const outcomes = new Map<string, AppWriteOutcome>();
	for (const app of apps) {
		if (app.localeFileTree) {
			const isTypeScript =
				existsSync(join(rootDir, app.appDir, "tsconfig.json")) ||
				existsSync(join(rootDir, "tsconfig.json"));
			const outcome = writeLocaleFileTree(app.localeFileTree, rootDir, { isTypeScript });
			outcomes.set(app.appDir, { written: outcome.written, removed: outcome.removed });
			for (const result of outcome.dirs) {
				session.success(
					`Wrote ${highlight(String(result.count))} file${result.count === 1 ? "" : "s"} to ${highlight(result.displayDir)}`,
				);
			}
		}
		if (apps.length > 1 || !!app.appDir) {
			session.success(
				formatLabelValue(
					highlight(displayAppDir(app.appDir, { showRootLabel })),
					"translated",
				),
			);
		}
	}
	return outcomes;
}

export async function translate(options: TranslateCommandOptions = {}): Promise<number> {
	const startTime = Date.now();
	const cwd = process.cwd();
	// Git root anchors YAML lookup, config loading, and extraction paths so they work
	// correctly regardless of which subdirectory the CLI was invoked from.
	// Falls back to cwd when not inside a git repository.
	const gitRoot = resolveGitRoot() ?? cwd;

	const session = new CommandSession("Vocoder Translate");

	const apiKey = process.env.VOCODER_API_KEY;
	if (!apiKey) {
		return session.fail("VOCODER_API_KEY is not set.", [
			"Run vocoder init or set VOCODER_API_KEY in .env.local.",
		]);
	}

	const apiUrl = options.apiUrl ?? process.env.VOCODER_API_URL ?? "https://vocoder.app";
	const localConfig = { apiKey, apiUrl };

	try {
		validateLocalConfig(localConfig);
	} catch (e) {
		return session.fail(e instanceof Error ? e.message : String(e));
	}

	const projectShortId = extractProjectShortIdFromApiKey(apiKey);
	if (!projectShortId) {
		return session.fail("Invalid API key format. Expected a project key (vcp_...).");
	}

	let activeStep: CommandStep | null = null;

	try {
		const branch = detectBranch(options.branch);

		activeStep = session.startStep("Loading project configuration");
		const api = new VocoderAPI(localConfig);
		const apiConfig = await api.getAppConfig();
		activeStep.done(formatLabelValue("Branch", highlight(branch)));
		activeStep = null;

		// YAML branches are the source of truth — fall back to server config if YAML absent.
		const yamlBranches = readWorkflowBranches(gitRoot);
		const yamlCommitMode = readWorkflowCommitMode(gitRoot);
		const effectiveTargetBranches = yamlBranches ?? apiConfig.targetBranches;

		if (!isTargetBranch(branch, effectiveTargetBranches)) {
			session.warn(`Skipping translations for ${highlight(branch)}.`);
			session.step("Target branches", joinHighlighted(effectiveTargetBranches));
			return session.end();
		}

		// onTranslationFailure is a job-level setting — load from git root, not per-app.
		// VOCODER_ON_FAILURE env var takes highest precedence.
		const rootConfig = loadVocoderConfig(gitRoot);
		const onTranslationFailure =
			(process.env.VOCODER_ON_FAILURE as "fail" | "proceed" | undefined) ??
			rootConfig?.onTranslationFailure ??
			"proceed";

		// --app-dir flag > vocoder.config.ts apps[] > single-app root ("")
		// Monorepo users declare app dirs in vocoder.config.ts; flag overrides for per-app workflows.
		const effectiveAppDirs = resolveAppDirs(options.appDir, rootConfig);

		// Validate and display named app dirs. Root ("") always valid — skip for single-app projects.
		const namedAppDirs = effectiveAppDirs.filter(Boolean);
		if (namedAppDirs.length > 0) {
			activeStep = session.startStep("Checking app directories");
			for (const appDir of namedAppDirs) {
				if (!existsSync(`${gitRoot}/${appDir}`)) {
					activeStep.fail(`App directory not found: ${highlight(appDir)}`, [
						"Fix app dirs in vocoder.config.ts or --app-dir.",
					]);
					return session.endFailure();
				}
			}
			activeStep.done(formatLabelValue("Apps", joinHighlighted(namedAppDirs)));
			activeStep = null;
		}

		// Extraction itself lives in utils/extract-apps.ts so callers without a
		// terminal — the MCP server — run exactly this code rather than their own
		// copy of it. The callbacks below are the only CLI-specific part.
		const appExtractions = await extractApps({
			gitRoot,
			appDirs: effectiveAppDirs,
			rootConfig,
			projectShortId,
			onAppStart: (appDir, patterns) => {
				activeStep = session.startStep(
					appDir
						? `Extracting strings from ${highlight(appDir)} (${patterns})`
						: `Extracting strings from ${patterns}`,
				);
			},
			onAppDone: (appDir, count) => {
				activeStep?.done(
					appDir
						? formatLabelValue(
								highlight(appDir),
								`${highlight(String(count))} string${count === 1 ? "" : "s"}`,
							)
						: formatLabelValue("Strings", `${highlight(String(count))}`),
				);
				activeStep = null;
			},
		});

		const totalSourceEntries = appExtractions.reduce((sum, a) => sum + a.sourceEntriesCount, 0);
		if (totalSourceEntries === 0) {
			session.warn(
				"No translatable strings found — deleted strings will still be synced.",
			);
		}

		if (options.dryRun) {
			const showRootLabel = appExtractions.length > 1;
			session.section("Dry run");
			session.step("Branch", highlight(branch));
			session.step("Target locales", joinHighlighted(apiConfig.targetLocales));
			for (const extraction of appExtractions) {
				session.step(
					displayAppDir(extraction.appDir, { showRootLabel }) || "App",
					`${highlight(String(extraction.sourceEntriesCount))} string${extraction.sourceEntriesCount === 1 ? "" : "s"}, fingerprint ${highlight(extraction.fingerprint)}`,
				);
			}
			return session.end("No API calls made.");
		}

		const repoIdentity = resolveGitRepositoryIdentity();
		const commitSha = options.commitSha ?? detectCommitSha() ?? undefined;

		if (options.verbose && !repoIdentity) {
			session.warn(
				"Could not detect git remote origin. Translation will continue without repo metadata.",
			);
		}

		// Build per-app submissions — filter out id-only entries (text: null)
		const apps = appExtractions.map((a) => ({
			appDir: a.appDir,
			strings: a.stringEntries
				.filter((e): e is TranslationStringEntry & { text: string } => e.text != null)
				.map((e) => ({
					key: e.key,
					text: e.text,
					...(e.context ? { context: e.context } : {}),
					...(e.formality ? { formality: e.formality } : {}),
					...(e.uiRole ? { uiRole: e.uiRole } : {}),
				})),
			sourceEntriesHash: a.sourceEntriesHash,
			// Forward YAML commit-mode so DB stays in sync when the YAML is updated.
			// Omitted when YAML is absent — server value is preserved in that case.
			...(yamlCommitMode ? { commitMode: yamlCommitMode } : {}),
			// Forward localesDir so server persists any change from vocoder.config.ts.
			// Omitted when unset — server value is preserved in that case.
			...(a.localesDir ? { localesDir: a.localesDir } : {}),
		}));

		activeStep = session.startStep(
			apps.length > 1
				? `Submitting ${apps.length} apps to Vocoder`
				: "Submitting to Vocoder",
		);
		const submitResult = await api.submitTranslate({
			apps,
			branch,
			...(commitSha ? { commitSha } : {}),
			repoUrl: repoIdentity?.repoCanonical ?? "",
			clientRunId: randomUUID(),
			// Send branches so server can reconcile project.targetBranches.
			// Prefer config file value; fall back to YAML; omit if neither found (preserves server value).
			...(rootConfig?.targetBranches ?? yamlBranches
				? { targetBranches: (rootConfig?.targetBranches ?? yamlBranches) as string[] }
				: {}),
		});

		// All apps cached — stop spinner with that result, no polling needed
		if (submitResult.status === "complete") {
			const duration = ((Date.now() - startTime) / 1000).toFixed(1);
			activeStep.done(`Cached translations ready in ${duration}s`);
			activeStep = null;
			// Files are written before the result is recorded: the Action stages
			// the paths this reports, so they have to be the paths that exist.
			const writeOutcomes = renderWrittenLocaleFiles(session, submitResult.apps, gitRoot);
			const orphanedPaths = warnOrphanedLocaleFiles(session, submitResult.apps, gitRoot);
			writeTranslateResult(
				submitResult.jobId,
				submitResult.apps.map((a) => {
					const outcome = writeOutcomes.get(a.appDir);
					return {
						appDir: a.appDir,
						...(a.localeFileTree ? { localeFileTree: a.localeFileTree } : {}),
						...(a.commitConfig ? { commitConfig: a.commitConfig } : {}),
						...(outcome ? { writtenPaths: outcome.written } : {}),
						...(outcome && outcome.removed.length > 0
							? { removedPaths: outcome.removed }
							: {}),
					};
				}),
				orphanedPaths,
			);
			return session.end("Up to date.");
		}

		activeStep.done("Queued translation job");
		activeStep = null;

		const { jobId } = submitResult;
		const localeList = joinHighlighted(apiConfig.targetLocales);

		activeStep = session.startStep(
			`Translating ${totalSourceEntries} string${totalSourceEntries === 1 ? "" : "s"} → ${localeList}`,
		);

		let interval = 1000;
		let finalStatus: BatchTranslateStatusResponse | null = null;

		while (true) {
			await new Promise((resolve) =>
				setTimeout(resolve, interval + Math.floor(Math.random() * 200)),
			);
			const status = await api.pollTranslateStatus(jobId);

			// Update spinner message with per-app progress for monorepo
			for (const app of status.apps) {
				if (app.status === "running" && app.appDir) {
					const { completed, total } = app.progress;
					activeStep.update(`${highlight(app.appDir)}: ${completed}/${total}`);
				}
			}

			if (status.status === "complete" || status.status === "failed") {
				finalStatus = status;
				break;
			}

			interval = Math.min(interval * 1.5, 5000);
		}

		if (!finalStatus) {
			activeStep.fail("No final translation status received.");
			return session.endFailure();
		}

		const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);

		if (finalStatus.status === "complete") {
			activeStep.done(`Translations ready in ${elapsedSec}s`);
			activeStep = null;
			// Files are written before the result is recorded: the Action stages
			// the paths this reports, so they have to be the paths that exist.
			const writeOutcomes = renderWrittenLocaleFiles(session, finalStatus.apps, gitRoot);
			const orphanedPaths = warnOrphanedLocaleFiles(session, finalStatus.apps, gitRoot);
			writeTranslateResult(
				finalStatus.jobId,
				finalStatus.apps.map((a) => {
					const outcome = writeOutcomes.get(a.appDir);
					return {
						appDir: a.appDir,
						...(a.localeFileTree ? { localeFileTree: a.localeFileTree } : {}),
						...(a.commitConfig ? { commitConfig: a.commitConfig } : {}),
						...(outcome ? { writtenPaths: outcome.written } : {}),
						...(outcome && outcome.removed.length > 0
							? { removedPaths: outcome.removed }
							: {}),
					};
				}),
				orphanedPaths,
			);
			return session.end("Up to date.");
		}

		activeStep.fail("Translation incomplete");
		for (const app of finalStatus.apps) {
			if ((finalStatus.apps.length > 1 || !!app.appDir) && app.status !== "complete") {
				const label = displayAppDir(app.appDir, {
					showRootLabel: finalStatus.apps.length > 1,
				});
				session.warn(`${highlight(label)}${app.error ? `: ${app.error}` : ""}`);
			}
		}
		activeStep = null;

		if (computeExitCode("failed", onTranslationFailure) === 0) {
			return session.end("Continuing with existing translations.");
		}

		return session.endFatal("Build halted — translation failed.");
	} catch (error) {
		if (error instanceof VocoderAPIError && error.limitError) {
			const { limitError } = error;
			if (activeStep) {
				activeStep.fail(limitError.message, getLimitErrorGuidance(limitError));
				return session.endFailure();
			}
			return session.fail(limitError.message, getLimitErrorGuidance(limitError));
		}

		if (error instanceof VocoderAPIError) {
			const guidance =
				error.status === 401 || error.status === 403
					? [
							"API key rejected — the project may have been deleted or the key revoked.",
							"Run vocoder init or vocoder regenerate-key.",
						]
					: [];
			if (activeStep) {
				activeStep.fail(error.message, guidance);
				return session.endFailure();
			}
			return session.fail(error.message, guidance);
		}

		if (error instanceof Error) {
			const guidance: string[] = [];
			if (error.message.includes("git branch")) {
				guidance.push("Run from a git repository, or use vocoder translate --branch main.");
			}
			if (options.verbose) {
				guidance.push(`Full error: ${error.stack ?? error}`);
			}
			if (activeStep) {
				activeStep.fail(error.message, guidance);
				return session.endFailure();
			}
			return session.fail(error.message, guidance);
		}

		if (activeStep) {
			activeStep.fail("Translation failed.");
			return session.endFailure();
		}
		return session.fail("Translation failed.");
	}
}
