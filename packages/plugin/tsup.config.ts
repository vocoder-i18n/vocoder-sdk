import { defineConfig } from "tsup";

export default defineConfig({
	entry: {
		index: "src/index.ts",
		vite: "src/vite.ts",
		webpack: "src/webpack.ts",
		rollup: "src/rollup.ts",
		esbuild: "src/esbuild.ts",
		next: "src/next.ts",
	},
	format: ["esm", "cjs"],
	dts: true,
	clean: true,
	sourcemap: true,
	target: "node18",
	outDir: "dist",
	// Bundle everything — plugin is a build tool, consumers install nothing extra.
	// unplugin, extractor, and babel are all dev deps (bundled, not installed).
	noExternal: [
		"unplugin",
		"@vocoder/extractor",
		"@vocoder/config",
		"@babel/parser",
		"@babel/traverse",
		"@babel/types",
		"@babel/core",
		"glob",
	],
	esbuildOptions(options, { format }) {
		if (format === "esm") {
			// createRequire shim: bundled CJS deps call require() internally; needs ESM equivalent.
			options.banner = {
				js: `import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);`,
			};
		}
		if (format === "cjs") {
			// Polyfill import.meta.url for bundled ESM deps (e.g. unplugin) that call createRequire(import.meta.url).
			// esbuild replaces import.meta.url with undefined in CJS output; define must reference an identifier.
			options.banner = {
				js: `const __importMetaUrl = require('url').pathToFileURL(__filename).href;`,
			};
			options.define = {
				...options.define,
				"import.meta.url": "__importMetaUrl",
			};
		}
	},
});
