import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pkgRoot = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(pkgRoot, p), "utf-8");

/**
 * `package.json` declares `bin: { "vocoder-mcp": "dist/index.js" }`. npm links
 * that file directly, so the kernel needs a shebang to know what interprets it.
 * Without one it falls through to `sh`, which chokes on the first `import` —
 * `npx @vocoder/mcp` fails on macOS and Linux while appearing to work on
 * Windows, whose shims default to node.
 *
 * tsup hoists a shebang found in the entry source above the `// @ts-nocheck`
 * banner and marks the output executable, so guarding the source guards the
 * build.
 */
describe("published binary", () => {
	it("declares a bin entry", () => {
		const pkg = JSON.parse(read("package.json"));
		expect(pkg.bin).toEqual({ "vocoder-mcp": "dist/index.js" });
	});

	it("entry source starts with a node shebang", () => {
		const src = read("src/index.ts");
		expect(src.startsWith("#!/usr/bin/env node\n")).toBe(true);
	});

	it("every package declared external to the bundle is a real dependency", () => {
		// An external that isn't a dependency resolves in the workspace and fails
		// for anyone who installs the published package.
		const pkg = JSON.parse(read("package.json"));
		const declared = new Set([
			...Object.keys(pkg.dependencies ?? {}),
			...Object.keys(pkg.peerDependencies ?? {}),
		]);
		const cfg = read("tsup.config.ts");
		const block = cfg.match(/external:\s*\[([^\]]*)\]/);
		const externals = block ? [...block[1]!.matchAll(/"([^"]+)"/g)].map((m) => m[1]!) : [];
		expect(externals.length).toBeGreaterThan(0);
		for (const name of externals) expect(declared).toContain(name);
	});
});
