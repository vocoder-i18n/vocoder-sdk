import {
	VocoderAPI,
	renderVocoderConfig,
	resolveLookupMatch,
	verifyStoredAuth,
} from "@vocoder/cli/lib";

import { detectRepoIdentity } from "@vocoder/cli/lib";

export interface RegenerateKeyResult {
	apiKey: string;
	projectName: string;
	apps: Array<{ appDir: string; appId: string }>;
	instructions: string;
}

export async function runRegenerateKey(): Promise<RegenerateKeyResult> {
	const apiUrl = process.env.VOCODER_API_URL || "https://vocoder.app";
	const identity = detectRepoIdentity();

	if (!identity) {
		throw new Error("Not inside a git repository. Run this tool from your project root.");
	}

	const anonApi = new VocoderAPI({ apiUrl, apiKey: "" });
	const lookup = await anonApi.lookupAppByRepo({
		repoCanonical: identity.repoCanonical,
		appDir: identity.appDir ?? "",
	});

	if (lookup.existingApps.length === 0) {
		throw new Error(
			"No Vocoder app found for this repository. Call vocoder_init_start to set one up.",
		);
	}

	// Which app this repo checkout corresponds to. Taking existingApps[0] here
	// regenerated whichever app happened to come back first, so in a monorepo an
	// agent working in apps/admin could rotate apps/web's key instead.
	const match = resolveLookupMatch(lookup, identity.appDir ?? "");
	if (!match) {
		throw new Error(
			`No Vocoder app matches ${identity.appDir ? `"${identity.appDir}"` : "the repository root"}, and this repo has no whole-repo app. Run vocoder_config to see which app directories are registered.`,
		);
	}
	const apps = lookup.existingApps.map((a) => ({ appDir: a.appDir, appId: a.appId }));

	const api = new VocoderAPI({ apiUrl, apiKey: "" });
	const storedAuth = await verifyStoredAuth(api);

	if (storedAuth.status !== "valid") {
		throw new Error(
			"No valid stored auth token. The user must run `vocoder regenerate-key` in their terminal — it opens a browser flow that cannot be automated.",
		);
	}

	let apiKey: string;
	try {
		({ apiKey } = await api.regenerateProjectApiKey(storedAuth.token, match.projectId));
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		if (msg.includes("403")) {
			throw new Error(
				"Permission denied — only admins and owners can generate API keys. Ask an admin to run `vocoder regenerate-key`.",
			);
		}
		throw new Error(`Failed to generate API key: ${msg}`);
	}

	// Rendered by the CLI so an agent writes exactly what `vocoder init` writes.
	// The previous copy emitted an `appId` field, which is not part of
	// VocoderConfig — TypeScript rejects it and the parser drops it — and pinned
	// localesDir to a value that differs from the SDK default.
	const configLines = [
		renderVocoderConfig(apps.map((a) => a.appDir)).trimEnd(),
	];

	return {
		apiKey,
		projectName: match.projectName,
		apps,
		instructions: [
			`New API key generated for "${match.projectName}"${match.appDir ? ` (${match.appDir})` : ""}.`,
			``,
			`1. Write to .env at the repo root:`,
			`   VOCODER_API_KEY=${apiKey}`,
			``,
			`2. Tell the user to update VOCODER_API_KEY in their MCP server environment config and restart their editor.`,
			``,
			`3. Each app directory needs a vocoder.config.ts with its appId:`,
			configLines.join("\n\n"),
		].join("\n"),
	};
}
