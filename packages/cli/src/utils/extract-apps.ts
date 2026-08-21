import { computeFingerprint, type VocoderConfig } from "@vocoder/extractor";
import type { TranslationStringEntry } from "../types.js";
import { computeSourceEntriesHash } from "./api.js";
// The CLI's own extractor wrapper, not @vocoder/extractor's — matching what
// commands/translate.ts imported before this was factored out. Importing from
// the wrong one silently bypasses the test suite's mock of this module.
import { StringExtractor } from "./extract.js";
import { buildStringEntries } from "./string-entries.js";

export interface AppExtraction {
	appDir: string;
	stringEntries: TranslationStringEntry[];
	sourceEntriesCount: number;
	sourceEntriesHash: string;
	fingerprint: string;
	localesDir?: string;
}

export interface ExtractAppsOptions {
	/** Repository root — extraction always resolves patterns from here. */
	gitRoot: string;
	/** App directories to extract. `[""]` means a single root-level app. */
	appDirs: string[];
	/** Parsed vocoder.config.*, or null when the project has none. */
	rootConfig: VocoderConfig | null | undefined;
	/** Short id from the project API key; part of the fingerprint scope. */
	projectShortId: string;
	/** Optional progress hook. The CLI renders a spinner; other callers pass nothing. */
	onAppStart?: (appDir: string, patterns: string) => void;
	onAppDone?: (appDir: string, stringCount: number) => void;
}

/**
 * Extract translatable strings for every app directory in a project.
 *
 * This is the part of `vocoder translate` that decides *what* gets uploaded,
 * and it is deliberately free of any terminal dependency so that callers other
 * than the CLI command can reach it. The MCP server previously reimplemented
 * this and hardcoded a single root app (`appDir: ""`), which produced a
 * fingerprint matching nothing the plugin computes at build time for any
 * monorepo.
 *
 * Two details are load-bearing and easy to lose in a rewrite:
 *
 * - Per-app config is the root config with the matching `apps[]` entry merged
 *   over it, so an app can override `include`, `exclude`, `localesDir` or
 *   `industry` while inheriting everything else.
 * - The fingerprint scope is `${projectShortId}:${appDir}` over *sorted keys*,
 *   which must match the formula in `@vocoder/plugin` and on the server. Drift
 *   here means the runtime asks for a bundle that was never built.
 */
export async function extractApps(
	options: ExtractAppsOptions,
): Promise<AppExtraction[]> {
	const { gitRoot, appDirs, rootConfig, projectShortId } = options;
	const results: AppExtraction[] = [];

	for (const appDir of appDirs) {
		const appEntry = appDir
			? rootConfig?.apps?.find((a) => a.appDir === appDir)
			: undefined;
		const appConfig = appEntry ? { ...rootConfig, ...appEntry } : rootConfig;

		const defaultInclude = appDir
			? [`${appDir}/**/*.{tsx,jsx,ts,js}`]
			: ["**/*.{tsx,jsx,ts,js}"];
		const includePattern: string | string[] = appConfig?.include?.length
			? appConfig.include
			: defaultInclude;
		const excludePattern = appConfig?.exclude?.length
			? appConfig.exclude
			: undefined;
		const industry = appConfig?.industry;

		options.onAppStart?.(
			appDir,
			Array.isArray(includePattern)
				? includePattern.join(", ")
				: includePattern,
		);

		const extractor = new StringExtractor();
		const extractedStrings = await extractor.extractFromProject(
			includePattern,
			gitRoot,
			excludePattern,
		);

		options.onAppDone?.(appDir, extractedStrings.length);

		const stringEntries = buildStringEntries(extractedStrings);
		const sourceEntriesHash = computeSourceEntriesHash({
			entries: stringEntries,
			industry: industry ?? null,
		});
		const scope = `${projectShortId}:${appDir}`;
		const fingerprint = computeFingerprint(
			scope,
			stringEntries.map((e) => e.key),
		);

		results.push({
			appDir,
			stringEntries,
			sourceEntriesCount: stringEntries.length,
			sourceEntriesHash,
			fingerprint,
			localesDir: appConfig?.localesDir,
		});
	}

	return results;
}

/**
 * Resolve which app directories a run covers.
 *
 * Precedence: an explicit `--app-dir` wins; otherwise the `apps[]` array from
 * vocoder.config; otherwise a single root-level app represented as `[""]`.
 * Returning `[""]` rather than `[]` is what keeps root-level and monorepo
 * projects on one code path.
 */
export function resolveAppDirs(
	explicitAppDir: string | undefined,
	rootConfig: VocoderConfig | null | undefined,
): string[] {
	// Leading/trailing slashes are stripped so `--app-dir /apps/web/` and
	// `apps/web` produce the same fingerprint scope.
	if (explicitAppDir) return [explicitAppDir.replace(/^\/|\/$/g, "")];
	const configured =
		rootConfig?.apps?.map((a) => a.appDir).filter(Boolean) ?? null;
	return configured && configured.length > 0 ? (configured as string[]) : [""];
}
