import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Write vocoder.config.ts to cwd if one doesn't already exist.
 * Returns true if the file was written, false if it already existed or write failed.
 */
export function writeVocoderConfig(options: {
	targetBranches?: string[];
	cwd?: string;
}): boolean {
	const { targetBranches = ["main"], cwd = process.cwd() } = options;
	const configPath = join(cwd, "vocoder.config.ts");
	if (existsSync(configPath)) return false;

	const branchesStr = targetBranches.map((b) => `'${b}'`).join(", ");
	const content = `import { defineConfig } from '@vocoder/config'

export default defineConfig({
  targetBranches: [${branchesStr}],
  include: ['**/*.{tsx,jsx,ts,js}'],
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
		return true;
	} catch {
		return false;
	}
}
