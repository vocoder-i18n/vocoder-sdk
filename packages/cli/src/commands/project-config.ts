import * as p from "@clack/prompts";
import chalk from "chalk";
import { config as loadEnv } from "dotenv";
import { VocoderAPI } from "../utils/api.js";

loadEnv();

export interface ProjectConfigOptions {
	apiUrl?: string;
}

/**
 * Displays the current Vocoder project configuration.
 *
 * Shows: project name, organization, source locale, target locales,
 * target branches, primary branch, and sync policy settings.
 *
 * Reads the project API key from VOCODER_API_KEY.
 * Endpoint: GET /api/cli/config
 *
 * @throws If VOCODER_API_KEY is missing or invalid.
 */
export async function projectConfig(options: ProjectConfigOptions = {}): Promise<number> {
	const apiKey = process.env.VOCODER_API_KEY;
	if (!apiKey) {
		p.log.error(
			"VOCODER_API_KEY is not set. Run `npx @vocoder/cli init` to set up your project.",
		);
		return 1;
	}

	const apiUrl = options.apiUrl ?? process.env.VOCODER_API_URL ?? "https://vocoder.app";
	const api = new VocoderAPI({ apiKey, apiUrl });

	try {
		const config = await api.getProjectConfig();

		const lines = [
			`Project:         ${chalk.bold(config.projectName)}`,
			`Organization:    ${config.organizationName}`,
			`Source locale:   ${chalk.cyan(config.sourceLocale)}`,
			`Target locales:  ${
				config.targetLocales.length > 0
					? config.targetLocales.map((l) => chalk.cyan(l)).join(", ")
					: chalk.dim("(none)")
			}`,
			`Target branches: ${config.targetBranches.map((b) => chalk.cyan(b)).join(", ")}`,
			...(config.primaryBranch
				? [`Primary branch:  ${chalk.cyan(config.primaryBranch)}`]
				: []),
			`Sync policy:`,
			`  Blocking branches: ${config.syncPolicy.blockingBranches.map((b) => chalk.cyan(b)).join(", ")}`,
			`  Blocking mode:     ${chalk.cyan(config.syncPolicy.blockingMode)}`,
			`  Non-blocking mode: ${chalk.cyan(config.syncPolicy.nonBlockingMode)}`,
			`  Max wait:          ${chalk.cyan(String(config.syncPolicy.defaultMaxWaitMs))} ms`,
		];

		p.note(lines.join("\n"), `${config.projectName} — project config`);
		return 0;
	} catch (error) {
		p.log.error(
			error instanceof Error ? error.message : "Failed to fetch project config.",
		);
		return 1;
	}
}
