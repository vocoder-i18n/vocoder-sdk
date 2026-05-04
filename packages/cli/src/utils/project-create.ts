import * as p from "@clack/prompts";
import chalk from "chalk";
import type { VocoderAPI } from "./api.js";
import { detectGitBranches, filterableBranchSelect } from "./branch-select.js";
import type { LocaleOption } from "./locale-search.js";
import {
	searchMultiSelectLocales,
	searchSelectLocale,
} from "./locale-search.js";

export interface ExistingApp {
	appDir: string;
	projectId: string;
	projectName: string;
	organizationName: string;
}

export interface ProjectCreateParams {
	api: VocoderAPI;
	userToken: string;
	organizationId: string;
	/** Default project name (repo name or directory name) */
	defaultName?: string;
	/** Pre-detected source locale, e.g. "en" */
	defaultSourceLocale?: string;
	/** Repo canonical for binding the project, e.g. "github:owner/repo" */
	repoCanonical?: string;
	/** Default target branches */
	defaultBranches?: string[];
	/**
	 * Auto-detected scope path (CWD relative to git root).
	 * Non-empty when running from a subdirectory of the repo — monorepo use case.
	 * e.g. "apps/web"
	 */
	defaultAppDir?: string;
}

export interface AppCreateParams {
	api: VocoderAPI;
	userToken: string;
	projectId: string;
	projectName: string;
	organizationName: string;
	repoCanonical?: string;
	defaultAppDir?: string;
	/** Existing apps to display and validate against */
	existingApps: ExistingApp[];
}

export interface AppCreateResult {
	projectId: string;
	projectName: string;
	apiKey: string;
	appDir: string;
	sourceLocale: string;
	targetLocales: string[];
	targetBranches: string[];
}

export interface ProjectCreateResult {
	projectId: string;
	projectName: string;
	apiKey: string;
	sourceLocale: string;
	targetLocales: string[];
	targetBranches: string[];
	repositoryBound: boolean;
	configureUrl?: string;
}

/** All locales — used for target language selection. */
function buildLocaleOptions(
	locales: Array<{ code: string; name: string; nativeName?: string }>,
): LocaleOption[] {
	return locales.map((l) => ({
		bcp47: l.code,
		label: `${l.name} — ${l.code}`,
	}));
}

/**
 * Deduplicated language list — used for source language selection.
 * Groups locales by language family (prefix before first hyphen) and keeps one
 * representative per family, preferring the shortest/base code (e.g. "en" over
 * "en-US"). This prevents showing "English", "English (American)", "English
 * (British)" as three separate choices when the user just means "English".
 */
function buildLanguageOptions(
	locales: Array<{ code: string; name: string; nativeName?: string }>,
): LocaleOption[] {
	const byFamily = new Map<string, LocaleOption>();

	for (const l of locales) {
		const family = l.code.split("-")[0]!.toLowerCase();
		const opt: LocaleOption = { bcp47: l.code, label: `${l.name} — ${l.code}` };
		const existing = byFamily.get(family);
		// Prefer base code (shorter, no region suffix) over regional variants
		if (!existing || l.code.length < existing.bcp47.length) {
			byFamily.set(family, opt);
		}
	}

	return Array.from(byFamily.values());
}

/**
 * Run the full project configuration TUI: prompts for name, source locale,
 * target locales, and target branches, then calls POST /api/cli/projects.
 *
 * Returns the created project info (including API key), or null if cancelled.
 */
export async function runProjectCreate(
	params: ProjectCreateParams,
): Promise<ProjectCreateResult | null> {
	const { api, userToken, organizationId, repoCanonical } = params;

	// ── Project name ────────────────────────────────────────────────────────────
	// Use the detected repo name automatically — no prompt needed.
	const projectName = (params.defaultName ?? "my-project").trim();
	p.log.success(`Project: ${chalk.bold(projectName)}`);

	// ── Fetch source locales ────────────────────────────────────────────────────
	let sourceLocales: Array<{ code: string; name: string; nativeName?: string }>;
	try {
		({ sourceLocales } = await api.listLocales(userToken));
	} catch {
		p.log.error(
			"Failed to fetch supported locales. Check your connection and try again.",
		);
		return null;
	}

	const languageOptions = buildLanguageOptions(sourceLocales);

	// ── Scope path (monorepo) ───────────────────────────────────────────────────
	const appDir = params.defaultAppDir ?? "";
	if (appDir) {
		p.log.success(`App directory: ${chalk.bold(appDir)}`);
	}

	// ── Source locale ───────────────────────────────────────────────────────────
	const sourceLocale = await searchSelectLocale(
		languageOptions,
		"Source language (the language your code is written in)",
		params.defaultSourceLocale ?? "en",
	);

	if (sourceLocale === null) return null;

	// ── Compatible target locales (fetched after source is known) ───────────────
	let compatibleTargets: Array<{ code: string; name: string; nativeName?: string }>;
	try {
		compatibleTargets = await api.listCompatibleLocales(userToken, sourceLocale);
	} catch {
		p.log.error(
			"Failed to fetch compatible target locales. Check your connection and try again.",
		);
		return null;
	}

	const localeOptions = buildLocaleOptions(compatibleTargets);

	// ── Target locales ──────────────────────────────────────────────────────────
	const targetOptions = localeOptions.filter(
		(opt) => opt.bcp47 !== sourceLocale,
	);

	const targetLocales = await searchMultiSelectLocales(
		targetOptions,
		"Target languages (languages to translate into)",
	);

	if (targetLocales === null) return null;

	if (targetLocales.length === 0) {
		p.log.warn(
			"No target languages selected — you can add them later from the dashboard.",
		);
	}

	// ── Branch triggers — per-trigger selection ────────────────────────────────
	// Ask which branches should fire for each trigger type. Branches can appear
	// in both push and PR (they get both triggers). Manual is mutually exclusive:
	// a branch cannot be both automatic (push/PR) and manual-only.
	const detected = detectGitBranches();
	const initialBranches = params.defaultBranches?.length
		? params.defaultBranches
		: [detected.defaultBranch];

	// Step 1: push (required)
	let pushBranches: string[] = [];
	{
		let initial = initialBranches;
		while (pushBranches.length === 0) {
			const result = await filterableBranchSelect({
				message: "Which branches should trigger translations?",
				branches: detected.branches,
				defaultBranch: detected.defaultBranch,
				initialValues: initial,
			});
			if (result === null) return null;
			if (result.length === 0) {
				p.log.warn(
					"At least one branch is required. Please select at least one.",
				);
				initial = [detected.defaultBranch];
			} else {
				pushBranches = result;
			}
		}
	}

	const targetBranches = pushBranches;

	// ── Create project ──────────────────────────────────────────────────────────
	try {
		const result = await api.createProject(userToken, {
			organizationId,
			name: projectName,
			sourceLocale,
			targetLocales,
			targetBranches,
			appDirs: appDir ? [appDir] : [],
			repoCanonical,
		});

		p.log.success(`Project ${chalk.bold(result.projectName)} created!`);
		return result;
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		p.log.error(`Failed to create project: ${message}`);
		return null;
	}
}

/**
 * Configure and create a new App under an existing project.
 * Used when the repo already has a project (monorepo: adding a new app directory).
 * No plan limit check runs — only a new App is created, not a new Project.
 */
export async function runAppCreate(
	params: AppCreateParams,
): Promise<AppCreateResult | null> {
	const { api, userToken, projectId, projectName, repoCanonical } = params;
	const existingScopes = new Set(params.existingApps.map((a) => a.appDir));

	// ── Fetch source locales ────────────────────────────────────────────────────
	let sourceLocales: Array<{ code: string; name: string; nativeName?: string }>;
	try {
		({ sourceLocales } = await api.listLocales(userToken));
	} catch {
		p.log.error(
			"Failed to fetch supported locales. Check your connection and try again.",
		);
		return null;
	}

	const languageOptions = buildLanguageOptions(sourceLocales);

	// ── App directory ───────────────────────────────────────────────────────────
	const appDir = params.defaultAppDir ?? "";
	if (existingScopes.has(appDir)) {
		p.log.error(`App directory "${appDir}" is already configured for this project.`);
		return null;
	}
	if (appDir) {
		p.log.success(`App directory: ${chalk.bold(appDir)}`);
	}

	// ── Source locale ───────────────────────────────────────────────────────────
	const sourceLocale = await searchSelectLocale(
		languageOptions,
		"Source language",
		"en",
	);
	if (sourceLocale === null) return null;

	// ── Compatible target locales (fetched after source is known) ───────────────
	let compatibleTargets: Array<{ code: string; name: string; nativeName?: string }>;
	try {
		compatibleTargets = await api.listCompatibleLocales(userToken, sourceLocale);
	} catch {
		p.log.error(
			"Failed to fetch compatible target locales. Check your connection and try again.",
		);
		return null;
	}

	// ── Target locales ──────────────────────────────────────────────────────────
	const targetOptions = buildLocaleOptions(compatibleTargets).filter(
		(opt) => opt.bcp47 !== sourceLocale,
	);
	const targetLocales = await searchMultiSelectLocales(
		targetOptions,
		"Target languages",
	);
	if (targetLocales === null) return null;
	if (targetLocales.length === 0) {
		p.log.warn(
			"No target languages selected — you can add them later from the dashboard.",
		);
	}

	// ── Branch triggers — per-trigger selection (same logic as runProjectCreate) ─
	const detectedApp = detectGitBranches();

	let appPushBranches: string[] = [];
	{
		let initial = [detectedApp.defaultBranch];
		while (appPushBranches.length === 0) {
			const result = await filterableBranchSelect({
				message: "Which branches should trigger translations?",
				branches: detectedApp.branches,
				defaultBranch: detectedApp.defaultBranch,
				initialValues: initial,
			});
			if (result === null) return null;
			if (result.length === 0) {
				p.log.warn("At least one branch is required.");
				initial = [detectedApp.defaultBranch];
			} else {
				appPushBranches = result;
			}
		}
	}

	const targetBranches = appPushBranches;

	// ── Create the App ─────────────────────────────────────────────────────────
	try {
		const result = await api.createApp(userToken, {
			projectId,
			appDir,
			sourceLocale,
			targetLocales,
			targetBranches,
			repoCanonical: repoCanonical ?? "",
		});

		p.log.success(
			`App ${chalk.bold(appDir)} added to ${chalk.bold(projectName)}!`,
		);
		return {
			projectId: result.projectId,
			projectName: result.projectName,
			apiKey: result.apiKey,
			appDir: result.appDir,
			sourceLocale,
			targetLocales,
			targetBranches,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		p.log.error(`Failed to add app: ${message}`);
		return null;
	}
}
