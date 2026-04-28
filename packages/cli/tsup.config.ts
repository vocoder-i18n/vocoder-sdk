import { defineConfig } from "tsup";

export default defineConfig({
	entry: {
		bin: "src/bin.ts",
		lib: "src/lib.ts",
	},
	format: ["esm"],
	dts: true,
	clean: true,
	sourcemap: true,
	minify: false,
	target: "node18",
	outDir: "dist",
});
