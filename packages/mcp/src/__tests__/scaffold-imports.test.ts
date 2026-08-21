import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runImplementI18n } from "../tools/implement-i18n";

/**
 * The scaffolds this tool emits are the flagship agent path: an assistant is
 * told to write them verbatim into a user's project. A wrong import produces
 * code that does not compile, and nothing in this package would have noticed —
 * the strings were only ever asserted against other strings.
 *
 * So rather than pinning the current import lines, this validates them against
 * what `@vocoder/react` genuinely exports, read from its source in the
 * workspace. If someone moves an export between entry points, this fails.
 */

const REACT_SRC = join(__dirname, "..", "..", "..", "react", "src");

/** Module specifier -> the source file backing that entry in package.json exports. */
const ENTRY_SOURCES: Record<string, string> = {
	"@vocoder/react": join(REACT_SRC, "index.ts"),
	"@vocoder/react/server": join(REACT_SRC, "server.ts"),
	"@vocoder/react/locale-selector": join(REACT_SRC, "locale-selector.ts"),
};

/** Value exports of a module. `export type { … }` blocks are excluded. */
function exportedNames(file: string): Set<string> {
	const src = readFileSync(file, "utf-8").replace(
		/export\s+type\s*\{[^}]*\}[^;]*;?/g,
		"",
	);
	const names = new Set<string>();
	for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
		for (const part of (m[1] as string).split(",")) {
			const name = part.trim().split(/\s+as\s+/).pop()?.trim();
			if (name) names.add(name);
		}
	}
	for (const m of src.matchAll(
		/export\s+(?:async\s+)?(?:function|const|class)\s+([A-Za-z0-9_$]+)/g,
	)) {
		names.add(m[1] as string);
	}
	return names;
}

function namedImports(code: string): Array<{ from: string; names: string[] }> {
	return [...code.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)].map(
		(m) => ({
			from: m[2] as string,
			names: (m[1] as string)
				.split(",")
				.map((n) => n.trim().split(/\s+as\s+/)[0]?.trim())
				.filter((n): n is string => Boolean(n)),
		}),
	);
}

/** A Next.js App Router project with no layout.tsx, so the scaffold is emitted. */
function nextFixture(): string {
	const dir = mkdtempSync(join(tmpdir(), "vocoder-scaffold-"));
	mkdirSync(join(dir, "app"), { recursive: true });
	writeFileSync(
		join(dir, "package.json"),
		JSON.stringify({
			name: "fixture",
			dependencies: { next: "16.0.0", react: "19.0.0", "react-dom": "19.0.0" },
		}),
	);
	return dir;
}

describe("generated Next.js scaffold", () => {
	const result = runImplementI18n({ appDir: nextFixture() });
	const code = result.phase3_provider.fullCode;

	it("is emitted for a Next.js project with no layout", () => {
		expect(result.detectedFramework).toBe("nextjs");
		expect(code).toBeTruthy();
	});

	it("only imports names the claimed entry point actually exports", () => {
		const failures: string[] = [];
		for (const imp of namedImports(code as string)) {
			const source = ENTRY_SOURCES[imp.from];
			if (!source) continue; // external module (next/headers, react)
			const available = exportedNames(source);
			for (const name of imp.names) {
				if (!available.has(name)) {
					failures.push(`${name} is not exported by ${imp.from}`);
				}
			}
		}
		expect(failures).toEqual([]);
	});

	it("takes the server-only helpers from @vocoder/react/server", () => {
		// getConfig and getLocales live alongside getLocaleDir in the server entry.
		// They were previously imported from the root, which does not export them,
		// so the scaffold did not compile.
		const rootImports = namedImports(code as string).filter(
			(i) => i.from === "@vocoder/react",
		);
		for (const name of ["getConfig", "getLocales", "getLocaleDir"]) {
			expect(rootImports.flatMap((i) => i.names)).not.toContain(name);
		}
		const serverImports = namedImports(code as string).filter(
			(i) => i.from === "@vocoder/react/server",
		);
		expect(serverImports.flatMap((i) => i.names).sort()).toEqual([
			"getConfig",
			"getLocaleDir",
			"getLocales",
		]);
	});

	it("does not tell the agent to import server helpers from the root entry", () => {
		// The same claim appeared in prose instructions as well as in the code.
		const prose = [
			result.phase3_provider.wrapInstruction,
			...Object.values(result.phase3_provider),
		]
			.filter((v): v is string => typeof v === "string")
			.join("\n");
		expect(prose).not.toMatch(
			/getConfig\/getLocales from '@vocoder\/react'|getLocales from '@vocoder\/react'[^/]/,
		);
	});
});

describe("generated vocoder.config.ts", () => {
	const result = runImplementI18n({ appDir: nextFixture() });

	it("matches what the CLI writes for a single-app project", () => {
		// Diverging here would lay an MCP-provisioned project out differently from
		// one set up with `vocoder init`. The CLI emits defineConfig({}) and lets
		// DEFAULT_LOCALES_DIR ("locales") apply.
		expect(result.phase1_install.configFile.content).toContain(
			"export default defineConfig({});",
		);
	});

	it("does not pin a localesDir that contradicts the SDK default", () => {
		expect(result.phase1_install.configFile.content).not.toContain("localesDir");
		expect(result.phase1_install.configFile.content).not.toContain("src/locales");
	});
});

describe("file scan reporting", () => {
	it("reports whether the file list was truncated", () => {
		const result = runImplementI18n({ appDir: nextFixture() });
		// A fixture with no source files is nowhere near the cap.
		expect(result.phase4_wrapping.filesToScanTruncated).toBe(false);
		expect(typeof result.phase4_wrapping.filesToScanTruncated).toBe("boolean");
	});

	it("says so in the steps when the list is truncated", () => {
		const dir = nextFixture();
		mkdirSync(join(dir, "src"), { recursive: true });
		for (let i = 0; i < 120; i++) {
			writeFileSync(join(dir, "src", `c${i}.tsx`), "export const C = () => null;\n");
		}
		const result = runImplementI18n({ appDir: dir });
		expect(result.phase4_wrapping.filesToScanTruncated).toBe(true);
		expect(result.phase4_wrapping.filesToScan.length).toBe(100);
		expect(result.steps.join("\n")).toMatch(/truncated/i);
	});
});
