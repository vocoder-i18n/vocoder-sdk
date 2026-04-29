import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type PackageManager = "pnpm" | "npm" | "yarn" | "bun";

export type DetectedFramework =
	| "nextjs"
	| "vite"
	| "remix"
	| "nuxt"
	| "sveltekit"
	| "gatsby"
	| "angular"
	| null;

export type DetectedEcosystem = "react" | "vue" | "svelte" | "angular" | null;

export interface LocalDetectionResult {
	ecosystem: DetectedEcosystem;
	framework: DetectedFramework;
	packageManager: PackageManager;
	uiPackage: string | null;
	hasUnplugin: boolean;
	hasUiPackage: boolean;
	sourceLocale: string | null;
}

/**
 * Detect the local project's ecosystem, framework, and package manager
 * by inspecting filesystem artifacts. No network calls.
 */
export function detectLocalEcosystem(
	cwd: string = process.cwd(),
): LocalDetectionResult {
	const packageManager = detectPackageManager(cwd);
	const pkg = readPackageJson(cwd);

	if (!pkg) {
		return {
			ecosystem: null,
			framework: null,
			packageManager,
			uiPackage: null,
			hasUnplugin: false,
			hasUiPackage: false,
			sourceLocale: null,
		};
	}

	const allDeps = {
		...((pkg.dependencies as Record<string, string>) ?? {}),
		...((pkg.devDependencies as Record<string, string>) ?? {}),
	};

	const hasUnplugin = "@vocoder/plugin" in allDeps;

	// Detect ecosystem + framework
	const { ecosystem, framework, uiPackage } = detectFromDeps(allDeps, cwd);
	const hasUiPackage = uiPackage !== null && uiPackage in allDeps;

	return {
		ecosystem,
		framework,
		packageManager,
		uiPackage,
		hasUnplugin,
		hasUiPackage,
		sourceLocale: null,
	};
}

function detectPackageManager(cwd: string): PackageManager {
	if (existsSync(join(cwd, "pnpm-lock.yaml"))) return "pnpm";
	if (existsSync(join(cwd, "bun.lockb")) || existsSync(join(cwd, "bun.lock")))
		return "bun";
	if (existsSync(join(cwd, "yarn.lock"))) return "yarn";
	return "npm";
}

function readPackageJson(cwd: string): Record<string, unknown> | null {
	const pkgPath = join(cwd, "package.json");
	if (!existsSync(pkgPath)) return null;
	try {
		return JSON.parse(readFileSync(pkgPath, "utf-8")) as Record<
			string,
			unknown
		>;
	} catch {
		return null;
	}
}

function detectFromDeps(
	allDeps: Record<string, string>,
	cwd: string,
): {
	ecosystem: DetectedEcosystem;
	framework: DetectedFramework;
	uiPackage: string | null;
} {
	// Vue ecosystem
	if ("vue" in allDeps) {
		const framework = "nuxt" in allDeps ? ("nuxt" as const) : null;
		return { ecosystem: "vue", framework, uiPackage: "@vocoder/vue" };
	}

	// Svelte ecosystem
	if ("svelte" in allDeps) {
		const framework =
			"@sveltejs/kit" in allDeps ? ("sveltekit" as const) : null;
		return { ecosystem: "svelte", framework, uiPackage: "@vocoder/svelte" };
	}

	// Angular ecosystem
	if ("@angular/core" in allDeps || existsSync(join(cwd, "angular.json"))) {
		return {
			ecosystem: "angular",
			framework: "angular",
			uiPackage: "@vocoder/angular",
		};
	}

	// React ecosystem (most common — check last)
	if ("react" in allDeps) {
		let framework: DetectedFramework = null;
		if ("next" in allDeps) framework = "nextjs";
		else if ("@remix-run/react" in allDeps) framework = "remix";
		else if ("gatsby" in allDeps) framework = "gatsby";
		else if ("vite" in allDeps) framework = "vite";
		return { ecosystem: "react", framework, uiPackage: "@vocoder/react" };
	}

	return { ecosystem: null, framework: null, uiPackage: null };
}

/**
 * Build the install command for packages that aren't already installed.
 */
export function buildInstallCommand(
	packageManager: PackageManager,
	packages: string[],
): string {
	if (packages.length === 0) return "";
	const pkgList = packages.join(" ");
	switch (packageManager) {
		case "pnpm":
			return `pnpm add ${pkgList}`;
		case "yarn":
			return `yarn add ${pkgList}`;
		case "bun":
			return `bun add ${pkgList}`;
		default:
			return `npm install ${pkgList}`;
	}
}

/**
 * Get the list of packages that need to be installed.
 */
export function getPackagesToInstall(
	detection: LocalDetectionResult,
): string[] {
	const packages: string[] = [];
	if (!detection.hasUnplugin) {
		packages.push("@vocoder/plugin");
		packages.push("@vocoder/extractor");
	}
	if (detection.uiPackage && !detection.hasUiPackage)
		packages.push(detection.uiPackage);
	return packages;
}
