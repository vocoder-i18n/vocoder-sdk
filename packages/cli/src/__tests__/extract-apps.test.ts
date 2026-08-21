import { describe, expect, it } from "vitest";
import { resolveAppDirs } from "../utils/extract-apps.js";

/**
 * `resolveAppDirs` decides which app directories a run covers, and therefore
 * what fingerprint scope each extraction gets. The MCP server used to answer
 * this question itself and always answered `""`, so every monorepo submitted
 * under a scope the plugin never computes at build time.
 */
describe("resolveAppDirs", () => {
	it("returns a single root app when there is no config", () => {
		expect(resolveAppDirs(undefined, null)).toEqual([""]);
	});

	it("returns a single root app when the config declares no apps", () => {
		expect(resolveAppDirs(undefined, { apps: [] } as never)).toEqual([""]);
	});

	it("returns every app declared in the config", () => {
		const config = {
			apps: [{ appDir: "apps/web" }, { appDir: "apps/admin" }],
		} as never;
		expect(resolveAppDirs(undefined, config)).toEqual(["apps/web", "apps/admin"]);
	});

	it("lets an explicit app dir override the config", () => {
		const config = {
			apps: [{ appDir: "apps/web" }, { appDir: "apps/admin" }],
		} as never;
		expect(resolveAppDirs("apps/admin", config)).toEqual(["apps/admin"]);
	});

	it("strips leading and trailing slashes from an explicit app dir", () => {
		// `--app-dir /apps/web/` and `apps/web` must produce the same scope,
		// or the same code submits under two different fingerprints.
		expect(resolveAppDirs("/apps/web/", null)).toEqual(["apps/web"]);
		expect(resolveAppDirs("apps/web", null)).toEqual(["apps/web"]);
	});

	it("ignores empty appDir entries in the config", () => {
		const config = {
			apps: [{ appDir: "" }, { appDir: "apps/web" }],
		} as never;
		expect(resolveAppDirs(undefined, config)).toEqual(["apps/web"]);
	});

	it("never returns an empty list", () => {
		// Returning [""] rather than [] is what keeps root-level and monorepo
		// projects on one code path — callers loop unconditionally.
		for (const cfg of [null, undefined, { apps: [] } as never]) {
			expect(resolveAppDirs(undefined, cfg).length).toBeGreaterThan(0);
		}
	});
});
