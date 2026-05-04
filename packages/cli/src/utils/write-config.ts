import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Returns the path of an existing vocoder.config file in cwd, trying
 * .ts → .js → .json in order. Returns null when none is found.
 */
export function findExistingConfig(cwd: string = process.cwd()): string | null {
	for (const name of [
		"vocoder.config.ts",
		"vocoder.config.js",
		"vocoder.config.json",
	]) {
		const candidate = join(cwd, name);
		if (existsSync(candidate)) return candidate;
	}
	return null;
}

/**
 * Write a vocoder.config file to cwd if one doesn't already exist.
 * Pass `useTypeScript: false` for plain-JS projects — writes vocoder.config.js
 * instead of vocoder.config.ts. The config content is identical; only the
 * file extension (and therefore the import style in the user's editor) differs.
 *
 * Returns the filename that was written, or null if the file already existed
 * or the write failed.
 */
export function writeVocoderConfig(options: {
	targetBranches?: string[];
	useTypeScript?: boolean;
	cwd?: string;
	appDir?: string;
}): string | null {
	const {
		targetBranches = ["main"],
		useTypeScript = true,
		cwd = process.cwd(),
		appDir,
	} = options;

	// Don't write if any config variant already exists
	if (findExistingConfig(cwd)) return null;

	const ext = useTypeScript ? "ts" : "js";
	const configPath = join(cwd, `vocoder.config.${ext}`);
	const branchesStr = targetBranches.map((b) => `'${b}'`).join(", ");

	const defaultIncludes = ["**/*.{tsx,jsx,ts,js}"];
	// Scope include patterns to the app subdirectory when running from a monorepo subdir
	const includes = appDir
		? defaultIncludes.map((p) => `${appDir}/${p}`)
		: defaultIncludes;
	const includesStr = includes.map((p) => `'${p}'`).join(", ");

	// Both TS and JS use ESM import syntax — the content is identical.
	// TypeScript users get type-checking from defineConfig; JS users get
	// the same runtime behaviour with no TS toolchain required.
	const content = `import { defineConfig } from '@vocoder/config'

export default defineConfig({
  targetBranches: [${branchesStr}],
  include: [${includesStr}],
  exclude: [
    '**/node_modules/**',
    '**/.next/**',
    '**/dist/**',
    '**/build/**',
    '**/*.test.*',
    '**/*.spec.*',
  ],
})
`;

	try {
		writeFileSync(configPath, content, "utf-8");
		return `vocoder.config.${ext}`;
	} catch {
		return null;
	}
}
