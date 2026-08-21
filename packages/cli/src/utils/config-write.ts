import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface ConfigWriteResult {
	/** Absolute path the file lives at (whether written now or already present). */
	path: string;
	/** Path relative to `repoRoot` — used in user-facing output. */
	relativePath: string;
	/** True when this call created the file. False when it was already present. */
	written: boolean;
}

/**
 * Write `vocoder.config.ts` (TypeScript projects) or `vocoder.config.js`
 * (JavaScript projects) under `repoRoot`. TypeScript is detected by the
 * presence of `tsconfig.json`. Skips silently if the file already exists.
 *
 * Branch triggers are intentionally omitted — the CLI reads them from the
 * GitHub Actions YAML (`on.push.branches`), so no duplication is needed.
 * Per-app `targetBranches` overrides can be added manually for advanced monorepo setups.
 */
export function writeVocoderConfig(
	repoRoot: string,
	opts: { appDirs?: string[] },
): ConfigWriteResult {
	const isTypeScript = existsSync(join(repoRoot, "tsconfig.json"));
	const ext = isTypeScript ? "ts" : "js";
	const relativePath = `vocoder.config.${ext}`;
	const absolutePath = join(repoRoot, relativePath);

	if (existsSync(absolutePath)) {
		return { path: absolutePath, relativePath, written: false };
	}

	const content = renderVocoderConfig(opts.appDirs ?? []);

	writeFileSync(absolutePath, content, "utf-8");
	return { path: absolutePath, relativePath, written: true };
}

/**
 * Render the contents of `vocoder.config.*`.
 *
 * Separated from the writer so callers that hand the text to someone else —
 * the MCP server, which returns it for an agent to write — emit exactly what
 * `vocoder init` would have written. Its own copy previously included an
 * `appId` field, which is not part of VocoderConfig at all: TypeScript rejects
 * it and the config parser silently drops it.
 *
 * No `localesDir` is emitted. Omitting it lets DEFAULT_LOCALES_DIR apply, and
 * pinning a different value here would lay a project out differently depending
 * on whether it was set up through the CLI or through an agent.
 */
export function renderVocoderConfig(appDirs: string[]): string {
	const namedDirs = appDirs.filter(Boolean);
	if (namedDirs.length === 0) {
		return [
			"import { defineConfig } from '@vocoder/config';",
			"",
			"export default defineConfig({});",
			"",
		].join("\n");
	}
	const appLines = namedDirs.map((dir) => `    { appDir: '${dir}' },`).join("\n");
	return [
		"import { defineConfig } from '@vocoder/config';",
		"",
		"export default defineConfig({",
		"  apps: [",
		appLines,
		"  ],",
		"});",
		"",
	].join("\n");
}
