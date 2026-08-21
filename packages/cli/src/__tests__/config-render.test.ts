import { describe, expect, it } from "vitest";
import { renderVocoderConfig } from "../utils/config-write.js";
import { resolveLookupMatch } from "../utils/project-lookup.js";

/**
 * Both helpers exist as single implementations because the MCP server had its
 * own copies and both had drifted — one emitted a config field that does not
 * exist, the other picked the wrong app in a monorepo.
 */

describe("renderVocoderConfig", () => {
	it("emits an empty config for a root-level project", () => {
		expect(renderVocoderConfig([])).toContain("export default defineConfig({});");
	});

	it("treats an empty appDir as root rather than a named app", () => {
		expect(renderVocoderConfig([""])).toContain("defineConfig({});");
		expect(renderVocoderConfig([""])).not.toContain("apps:");
	});

	it("emits an apps array for a monorepo", () => {
		const out = renderVocoderConfig(["apps/web", "apps/admin"]);
		expect(out).toContain("apps: [");
		expect(out).toContain("{ appDir: 'apps/web' },");
		expect(out).toContain("{ appDir: 'apps/admin' },");
	});

	it("never emits appId — it is not a field on VocoderConfig", () => {
		// TypeScript rejects it and the config parser silently drops it, so a
		// scaffold that includes it produces a file the user has to fix by hand.
		expect(renderVocoderConfig(["apps/web"])).not.toContain("appId");
		expect(renderVocoderConfig([])).not.toContain("appId");
	});

	it("never pins localesDir, so the SDK default applies", () => {
		expect(renderVocoderConfig([])).not.toContain("localesDir");
		expect(renderVocoderConfig(["apps/web"])).not.toContain("localesDir");
	});
});

describe("resolveLookupMatch", () => {
	const app = (appDir: string, projectId: string) => ({
		appDir,
		appId: `app_${projectId}`,
		projectId,
		projectName: `proj-${projectId}`,
		organizationName: "acme",
	});

	it("prefers an exact appDir match over whatever came back first", () => {
		// This is the monorepo bug: taking existingApps[0] would rotate the key
		// for apps/web while the agent is working in apps/admin.
		const lookup = {
			exactMatch: {
				projectId: "p-admin",
				projectName: "proj-p-admin",
				organizationName: "acme",
			},
			hasWholeRepoApp: false,
			existingApps: [app("apps/web", "p-web"), app("apps/admin", "p-admin")],
		} as never;
		const match = resolveLookupMatch(lookup, "apps/admin");
		expect(match?.kind).toBe("exact");
		expect(match?.projectId).toBe("p-admin");
	});

	it("falls back to the whole-repo app when there is no exact match", () => {
		const lookup = {
			exactMatch: null,
			hasWholeRepoApp: true,
			existingApps: [app("apps/web", "p-web"), app("", "p-root")],
		} as never;
		const match = resolveLookupMatch(lookup, "apps/other");
		expect(match?.kind).toBe("whole-repo");
		expect(match?.projectId).toBe("p-root");
		expect(match?.appDir).toBe("");
	});

	it("returns null when nothing matches and there is no whole-repo app", () => {
		// The MCP previously threw its own generic error here after picking an
		// arbitrary app; returning null lets the caller say which dir was missing.
		const lookup = {
			exactMatch: null,
			hasWholeRepoApp: false,
			existingApps: [app("apps/web", "p-web")],
		} as never;
		expect(resolveLookupMatch(lookup, "apps/admin")).toBeNull();
	});
});
