import { VocoderAPI, VocoderAPIError } from "../utils/api.js";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";

import type { PullOptions } from "../types.js";
import { detectBranch } from "../utils/branch.js";
import { CommandSession, displayAppDir } from "../utils/command-session.js";
import { highlight } from "../utils/theme.js";
import { loadEnvFiles } from "../utils/load-env.js";
import { resolveGitRoot } from "../utils/git-identity.js";

loadEnvFiles();

export async function pull(options: PullOptions = {}): Promise<number> {
	const session = new CommandSession("Vocoder Pull");

	const apiKey = process.env.VOCODER_API_KEY;
	if (!apiKey) {
		return session.fail("VOCODER_API_KEY is not set.", [
			"Run vocoder init to set up your project.",
		]);
	}

	const apiUrl = options.apiUrl ?? process.env.VOCODER_API_URL ?? "https://vocoder.app";
	const api = new VocoderAPI({ apiKey, apiUrl });

	let branch: string;
	try {
		branch = detectBranch(options.branch);
	} catch (error) {
		return session.fail(
			error instanceof Error ? error.message : "Failed to detect the branch.",
			["Use --branch to specify it explicitly."],
		);
	}

	const gitRoot = resolveGitRoot() ?? process.cwd();
	const rootDir = options.output ?? gitRoot;

	// --app-dirs flag acts as a client-side filter on the apps returned by the server
	const appDirFilter =
		options.appDirs !== undefined
			? new Set(
					options.appDirs
						.split(",")
						.map((d) => d.trim().replace(/^\/|\/$/g, ""))
						.filter(Boolean),
				)
			: null;

	const step = session.startStep(`Fetching locale files for ${highlight(branch)}`);

	try {
		const response = await api.getLocaleFiles({ branch });

		const apps = appDirFilter
			? response.apps.filter((a) => appDirFilter.has(a.appDir))
			: response.apps;

		const found = apps.filter((a) => a.localeFileTree !== undefined);

		if (found.length === 0) {
			step.fail("No locale files found", [
				"Run vocoder translate to generate translations first.",
			]);
			return session.endFailure();
		}

		step.done(`Found locale files for ${highlight(branch)}`);

		for (const { appDir, localeFileTree } of apps) {
			if (!localeFileTree) {
				session.warn(
					`No translations found for ${highlight(displayAppDir(appDir, { showRootLabel: true }))} on ${highlight(branch)}.`,
				);
				continue;
			}
			const isTypeScript =
				existsSync(join(rootDir, appDir, "tsconfig.json")) ||
				existsSync(join(rootDir, "tsconfig.json"));
			for (const result of writeLocaleFileTree(localeFileTree, rootDir, { isTypeScript }).dirs) {
				session.success(
					`Wrote ${highlight(String(result.count))} file${result.count === 1 ? "" : "s"} to ${highlight(result.displayDir)}`,
				);
			}
		}

		return session.end("Up to date.");
	} catch (error) {
		if (error instanceof VocoderAPIError) {
			step.fail(
				error.message,
				error.status === 401 || error.status === 403
					? [
							"Project API key rejected — refresh VOCODER_API_KEY for this repo.",
							"Run vocoder init or vocoder regenerate-key.",
						]
					: [],
			);
			return session.endFailure();
		}
		step.fail(
			error instanceof Error ? error.message : "Could not fetch locale files",
		);
		return session.endFailure();
	}
}

export interface LocaleWriteResult {
	displayDir: string;
	count: number;
}

export interface LocaleTreeWriteOutcome {
	/** Per-directory counts, for the "Wrote N files to locales/" line. */
	dirs: LocaleWriteResult[];
	/**
	 * Paths this call wrote, relative to `rootDir` with forward slashes.
	 * These are the paths as they landed on disk — `locales/loader.ts` for a
	 * TypeScript project, not the `locales/loader.js` key the server sent.
	 * The GitHub Action stages exactly this list, so it must describe the
	 * files that exist rather than the request that produced them.
	 */
	written: string[];
	/**
	 * Paths this call deleted: a `loader.js` (and its `loader.d.ts`) made
	 * obsolete by writing `loader.ts`. Staged as deletions by the Action, so
	 * the superseded file does not stay committed forever.
	 */
	removed: string[];
}

/**
 * Normalizes a tree key to the path it actually lands at, relative to the
 * repository root, with forward slashes on every platform.
 *
 * The reported list is fed straight to `git add`, so a key like
 * `app/../locales/en.json` has to become `locales/en.json` — git would
 * otherwise be asked to stage a path whose first segment may not exist.
 * Containment is checked separately by `assertPathsStayInsideRoot`.
 */
function toRepoRelative(relativePath: string, rootDir: string): string {
	const rel = relative(resolve(rootDir), resolve(rootDir, relativePath));
	return sep === "/" ? rel : rel.split(sep).join("/");
}

/**
 * Rejects any key that would write outside `rootDir`.
 *
 * The tree is server-supplied and lands in a repository checkout where the
 * Action holds `contents: write`, so a key of `../../.github/workflows/deploy.yml`
 * would otherwise be written and committed. Checked for the whole tree before
 * anything is written, so a bad key aborts rather than leaving a half-applied
 * update behind.
 */
function assertPathsStayInsideRoot(
	localeFileTree: Record<string, string>,
	rootDir: string,
): void {
	const root = resolve(rootDir);
	for (const relativePath of Object.keys(localeFileTree)) {
		const target = resolve(root, relativePath);
		const rel = relative(root, target);
		if (isAbsolute(relativePath) || rel === "" || rel.startsWith("..")) {
			throw new Error(
				`Refusing to write locale file outside the repository: ${relativePath}`,
			);
		}
	}
}

export function writeLocaleFileTree(
	localeFileTree: Record<string, string>,
	rootDir: string,
	options?: { isTypeScript?: boolean },
): LocaleTreeWriteOutcome {
	assertPathsStayInsideRoot(localeFileTree, rootDir);

	const dirCounts = new Map<string, number>();
	const written: string[] = [];
	const removed: string[] = [];

	for (let [relativePath, content] of Object.entries(localeFileTree)) {
		if (relativePath.endsWith("loader.js") && options?.isTypeScript) {
			// Write loader.ts with type annotations for TypeScript projects.
			// Clean up any previously-generated loader.js and loader.d.ts.
			const jsPath = join(rootDir, relativePath);
			const dtsRelative = relativePath.replace(/\.js$/, ".d.ts");
			if (existsSync(jsPath)) removed.push(toRepoRelative(relativePath, rootDir));
			if (existsSync(join(rootDir, dtsRelative)))
				removed.push(toRepoRelative(dtsRelative, rootDir));
			rmSync(jsPath, { force: true });
			rmSync(jsPath.replace(/\.js$/, ".d.ts"), { force: true });
			relativePath = relativePath.replace(/\.js$/, ".ts");
			content = content.replace(
				"async function loadLocale(locale)",
				"async function loadLocale(locale: string): Promise<Record<string, string>>",
			);
		}

		const filePath = join(rootDir, relativePath);
		mkdirSync(dirname(filePath), { recursive: true });
		writeFileSync(filePath, content, "utf-8");
		written.push(toRepoRelative(relativePath, rootDir));
		const dir = dirname(relativePath);
		dirCounts.set(dir, (dirCounts.get(dir) ?? 0) + 1);
	}

	return {
		dirs: Array.from(dirCounts.entries()).map(([dir, count]) => ({
			displayDir: dir === "." ? "./" : `${dir}/`,
			count,
		})),
		written,
		removed,
	};
}
