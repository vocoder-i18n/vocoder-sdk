import { randomUUID } from "node:crypto";
import {
	type VocoderAPI,
	extractProjectShortIdFromApiKey,
	loadVocoderConfig,
} from "@vocoder/cli/lib";
import {
	detectBranch,
	detectCommitSha,
	detectRepoIdentity,
	extractApps,
	resolveAppDirs,
} from "@vocoder/cli/lib";

const POLL_INTERVAL_MS = 2000;
const MAX_WAIT_MS = 60000;

export interface TranslateInput {
	branch?: string;
	force?: boolean;
	/**
	 * Restrict the run to one app directory in a monorepo. Omitted means every
	 * app declared in vocoder.config's apps[], or the repo root when there is no
	 * apps[] array. Mirrors the CLI's --app-dir.
	 */
	appDir?: string;
}

export async function runTranslate(input: TranslateInput, api: VocoderAPI): Promise<string> {
	const apiKey = process.env.VOCODER_API_KEY ?? "";
	const projectShortId = extractProjectShortIdFromApiKey(apiKey);
	if (!projectShortId) {
		return "Invalid API key format. Expected a project key (vcp_...).";
	}

	const config = await api.getAppConfig();

	if (config.targetLocales.length === 0) {
		return "No target locales configured. Add target locales to your project before translating.";
	}

	const branch = input.branch ?? detectBranch();
	const commitSha = detectCommitSha() ?? undefined;
	const identity = detectRepoIdentity();

	const projectRoot = process.cwd();
	const fileConfig = loadVocoderConfig(projectRoot);

	// Extraction is the CLI's, not a copy. The previous version here ignored
	// apps[] entirely and hardcoded appDir "" into both the fingerprint scope
	// and the submission, so every monorepo produced a fingerprint matching
	// nothing the plugin computes at build time.
	const appDirs = resolveAppDirs(input.appDir, fileConfig);
	const extractions = await extractApps({
		gitRoot: projectRoot,
		appDirs,
		rootConfig: fileConfig,
		projectShortId,
	});

	if (extractions.every((a) => a.sourceEntriesCount === 0)) {
		return 'No translatable strings found. Wrap strings with <T>text</T> or t("text") and try again.';
	}

	const apps = extractions
		.map((app) => ({
			appDir: app.appDir,
			fingerprint: app.fingerprint,
			submittable: app.stringEntries.filter(
				(e): e is typeof e & { text: string } => e.text != null,
			),
			sourceEntriesHash: input.force ? undefined : app.sourceEntriesHash,
		}))
		.filter((app) => app.submittable.length > 0);

	if (apps.length === 0) {
		return "No submittable strings found (all strings are id-only and require a localesDir source file).";
	}

	const submittedCount = apps.reduce((n, a) => n + a.submittable.length, 0);
	const fingerprint = apps.map((a) => a.fingerprint).join(", ");

	const response = await api.submitTranslate({
		apps: apps.map((app) => ({
			appDir: app.appDir,
			strings: app.submittable.map((s) => ({
				key: s.key,
				text: s.text,
				...(s.context ? { context: s.context } : {}),
				...(s.formality ? { formality: s.formality } : {}),
				...(s.uiRole ? { uiRole: s.uiRole } : {}),
			})),
			...(app.sourceEntriesHash
				? { sourceEntriesHash: app.sourceEntriesHash }
				: {}),
		})),
		branch,
		...(commitSha ? { commitSha } : {}),
		repoUrl: identity?.repoCanonical ?? "",
		clientRunId: randomUUID(),
	});

	if (response.status === "complete") {
		return `Up to date — strings unchanged since last translation. Fingerprint: ${fingerprint}`;
	}

	return await pollTranslate(api, response.jobId, submittedCount);
}

async function pollTranslate(
	api: VocoderAPI,
	jobId: string,
	totalSourceEntries: number,
): Promise<string> {
	const deadline = Date.now() + MAX_WAIT_MS;

	while (Date.now() < deadline) {
		await sleep(POLL_INTERVAL_MS);
		const status = await api.pollTranslateStatus(jobId);

		if (status.status === "complete") {
			const appStatus = status.apps[0];
			const providers = appStatus ? Object.keys(appStatus.providers).join(", ") : "";
			return `Translation complete. ${totalSourceEntries} string(s) submitted${providers ? ` via ${providers}` : ""}.`;
		}

		if (status.status === "failed") {
			const errMsg = status.apps[0]?.error ?? "Unknown error";
			return `Translation failed: ${errMsg}. Job ID: ${jobId}`;
		}
	}

	return `Translations in progress (job: ${jobId}). ${totalSourceEntries} string(s) queued. Check back shortly.`;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
