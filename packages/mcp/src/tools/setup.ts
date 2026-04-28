import {
	buildInstallCommand,
	detectLocalEcosystem,
	getPackagesToInstall,
	getSetupSnippets,
} from "@vocoder/cli/lib";

export interface SetupInput {
	sourceLocale?: string;
	targetLocales?: string[];
}

export interface SetupResult {
	framework: string | null;
	ecosystem: string | null;
	packagesAlreadyInstalled: boolean;
	installCommand: string | null;
	pluginFile: string | null;
	pluginCode: string | null;
	providerFile: string | null;
	providerCode: string | null;
	wrapExample: string;
	authStatus: "configured" | "missing";
	nextSteps: string;
}

export function runSetup(input: SetupInput, hasApiKey: boolean): SetupResult {
	const sourceLocale = input.sourceLocale ?? "en";
	const detection = detectLocalEcosystem();
	const packagesToInstall = getPackagesToInstall(detection);
	const installCommand =
		packagesToInstall.length > 0
			? buildInstallCommand(detection.packageManager, packagesToInstall)
			: null;

	const snippets = getSetupSnippets({
		framework: detection.framework,
		ecosystem: detection.ecosystem,
		sourceLocale,
		translationTriggers: ["push"],
	});

	const authNextStep = hasApiKey
		? null
		: "Run `npx @vocoder/cli init` to connect this project to Vocoder and get your API key. Then add it to your MCP config as VOCODER_API_KEY.";

	const parts = [snippets.whatsNext, authNextStep].filter(Boolean);

	return {
		framework: detection.framework,
		ecosystem: detection.ecosystem,
		packagesAlreadyInstalled: packagesToInstall.length === 0,
		installCommand,
		pluginFile: snippets.pluginStep?.file ?? null,
		pluginCode: snippets.pluginStep?.code ?? null,
		providerFile: snippets.providerStep?.file ?? null,
		providerCode: snippets.providerStep?.code ?? null,
		wrapExample: snippets.wrapStep.code,
		authStatus: hasApiKey ? "configured" : "missing",
		nextSteps: parts.join("\n"),
	};
}
