import { defineConfig } from "tsup";

// @babel/core's config-file detector probes for @babel/preset-typescript to determine whether
// .ts config files need TS parsing. Dead code with configFile:false, but esbuild statically
// resolves all require() calls — stub it to prevent bundle failure.
const stubUnreachableBabelProbes = {
	name: "stub-unreachable-babel-probes",
	setup(build: any) {
		build.onResolve(
			{ filter: /^@babel\/preset-typescript\/package\.json$/ },
			() => ({
				path: "@babel/preset-typescript/package.json",
				namespace: "babel-probe-stub",
			}),
		);
		build.onLoad({ filter: /.*/, namespace: "babel-probe-stub" }, () => ({
			contents: "module.exports = {}",
			loader: "js",
		}));
	},
};

export default defineConfig({
	entry: {
		bin: "src/bin.ts",
		lib: "src/lib.ts",
	},
	format: ["esm"],
	dts: { compilerOptions: { lib: ["ES2022", "DOM"] } },
	clean: true,
	sourcemap: true,
	minify: false,
	target: "node18",
	outDir: "dist",
	// Bundle internal vocoder packages and their deps so the CLI is self-contained.
	// Version mismatches between @vocoder/extractor and @vocoder/cli would produce
	// different extracted string sets → different fingerprints → 404 at build time.
	noExternal: [
		"@vocoder/core",
		"@vocoder/extractor",
		"@vocoder/config",
		"@babel/parser",
		"@babel/traverse",
		"@babel/types",
		"@babel/core",
		"glob",
	],
	esbuildPlugins: [stubUnreachableBabelProbes],
	esbuildOptions(options) {
		// CJS deps bundled into ESM call require() for Node built-ins (tty, os, etc.).
		// This shim makes require() available inside the ESM bundle.
		options.banner = {
			js: `// @ts-nocheck\nimport { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);`,
		};
	},
});
