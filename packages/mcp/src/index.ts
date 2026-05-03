import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createClient, NO_API_KEY_MESSAGE } from "./client.js";
import { runImplementI18n } from "./tools/implement-i18n.js";
import { runInitStatus } from "./tools/init-status.js";
import { runInitComplete, runInitStart, runProjectCreate } from "./tools/project-init.js";
import { runAddLocale } from "./tools/locale.js";
import { runSetup } from "./tools/setup.js";
import { runStatus } from "./tools/status.js";
import { runSync } from "./tools/sync.js";
import { runGetTranslations } from "./tools/translations.js";

const server = new McpServer(
	{ name: "vocoder", version: "0.1.0" },
	{
		instructions: `You are a localization expert and an expert in the Vocoder i18n platform.

Your role is to autonomously implement internationalization in the user's project using the Vocoder SDK and ICU MessageFormat best practices. When the user asks you to set up, check, or fix i18n, take action — edit files, run commands, and complete the work. Do not list steps for the user to follow manually unless an action genuinely requires human input (browser authentication being the only expected case).

Key principles:
- Prefer <T> component for JSX content. Use t() for non-JSX strings (toast messages, aria-labels, window.title, etc.).
- Plurals and selects belong in <T> props (one/other, _male/_female), not in JavaScript ternaries.
- Wrap all visible UI strings. Skip: import paths, CSS classes, URLs, console.log, test files, technical HTML attributes.
- After implementing, always run vocoder_sync to extract strings and submit for translation.
- When auth is missing (vocoder_init_status returns ready: false), use the vocoder_init_start and vocoder_init_complete tools — do NOT run \`npx @vocoder/cli init\` via Bash. The CLI is an interactive TTY app and will hang. The init tools handle everything headlessly.
- Init flow order: (1) ask if GitHub App already installed, (2) call vocoder_init_start to get the auth URL, (3) show the auth URL and wait for the user to confirm they've completed the browser flow, (4) call vocoder_init_complete — this writes credentials, (5) collect sourceLocale/targetLocales/targetBranches from the user, (6) call vocoder_project_create — this resolves the workspace and creates the project.
- After vocoder_project_create returns an apiKey: find the appropriate env file for this project and write VOCODER_API_KEY there, then run /mcp reset to reload.`,
	},
);

// vocoder_setup — inspect framework and return setup info.
// Works without an API key (local detection only).
server.tool(
	"vocoder_setup",
	"Detect the current project's framework and return everything needed to understand the Vocoder i18n setup: install commands, build plugin snippet, provider placement (exact file path), usage example, string-wrapping guidance, and the full SDK API reference. Call this first to assess the project. For a step-by-step implementation plan with file discovery, call vocoder_implement_i18n instead.",
	{
		sourceLocale: z
			.string()
			.optional()
			.describe('Source language code (default: "en")'),
		targetLocales: z
			.array(z.string())
			.optional()
			.describe('Target language codes, e.g. ["es", "fr", "de"]'),
	},
	async ({ sourceLocale, targetLocales }) => {
		try {
			const apiKey = process.env.VOCODER_API_KEY;
			const result = runSetup({ sourceLocale, targetLocales }, !!apiKey);
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `Setup detection failed: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
			};
		}
	},
);

// vocoder_init_start — open auth session, show browser URL immediately.
// Auth comes first (matching CLI flow). Project config is collected while user is in browser.
server.tool(
	"vocoder_init_start",
	"Start Vocoder authentication. Before calling: ask the user one question — have they already installed the Vocoder GitHub App? (yes = mode 'link', no = mode 'install'). Then call this tool. Show the returned link to the user and tell them to reply when they've completed the browser flow. Wait for their reply before doing anything else.",
	{
		mode: z
			.enum(["install", "link"])
			.optional()
			.describe(
				'Auth mode: "install" (default) — installs GitHub App + authenticates in one browser trip; "link" — OAuth only, for users who already have the App installed.',
			),
	},
	async ({ mode }) => {
		try {
			const result = await runInitStart({ mode });
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `Failed to start initialization: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
			};
		}
	},
);

// vocoder_init_complete — poll for token, write auth.
// Workspace resolution is deferred to vocoder_project_create so re-runs don't
// hit "already claimed" errors from claimCliGitHubInstallation.
server.tool(
	"vocoder_init_complete",
	"Call this immediately after the user confirms they've finished the browser auth flow. Takes only the sessionId — no project config yet. Polls for the auth token and writes credentials to disk. Returns confirmation and instructions to collect project config next.",
	{
		sessionId: z
			.string()
			.describe("The sessionId returned by vocoder_init_start"),
	},
	async ({ sessionId }) => {
		try {
			const result = await runInitComplete({ sessionId });
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `Authentication failed: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
			};
		}
	},
);

// vocoder_project_create — collect project config and create the project.
server.tool(
	"vocoder_project_create",
	"Call this after vocoder_init_complete succeeds. Collect sourceLocale, targetLocales, targetBranches, and optional projectName from the user, then call this tool. Creates the project and returns the API key. Find the appropriate env file for this project and write VOCODER_API_KEY there, then run /mcp reset to reload.",
	{
		sessionId: z
			.string()
			.describe("The sessionId returned by vocoder_init_start"),
		sourceLocale: z
			.string()
			.describe('Source language BCP 47 code, e.g. "en"'),
		targetLocales: z
			.array(z.string())
			.describe('Target language codes to translate into, e.g. ["es", "fr", "de"]'),
		targetBranches: z
			.array(z.string())
			.describe('Git branches that trigger translation on push, e.g. ["main"]'),
		projectName: z
			.string()
			.optional()
			.describe("Project name (auto-detected from git repo name if omitted)"),
	},
	async ({ sessionId, sourceLocale, targetLocales, targetBranches, projectName }) => {
		try {
			const result = await runProjectCreate({ sessionId, sourceLocale, targetLocales, targetBranches, projectName });
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `Project creation failed: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
			};
		}
	},
);

// vocoder_init_status — check whether Vocoder is initialized with a valid API key.
// Use this to determine if auth-gated tools (vocoder_sync, vocoder_add_locale, etc.)
// are available. If ready: false, show the user the instructions field.
server.tool(
	"vocoder_init_status",
	"Check whether Vocoder is initialized and the API key is valid. Returns ready: true when the project is connected and translation tools are available. Returns ready: false with step-by-step instructions to run vocoder init when not configured. Call this before using any tool that requires VOCODER_API_KEY.",
	{},
	async () => {
		const client = createClient();
		try {
			const result = await runInitStatus(client);
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `Init status check failed: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
			};
		}
	},
);

// vocoder_implement_i18n — generate a complete implementation plan.
// Returns exact file paths, install commands, provider setup, files to scan,
// string-wrapping patterns, and the full SDK reference. Use when ready to code.
server.tool(
	"vocoder_implement_i18n",
	"Generate a complete, step-by-step i18n implementation plan for the current project. Returns exact file paths to modify, install commands, provider setup code, a list of source files to scan for hardcoded strings, wrapping patterns with before/after examples, and the full @vocoder/react SDK reference. Call this when you are ready to implement i18n — it gives you everything needed to make code changes autonomously.",
	{
		sourceLocale: z
			.string()
			.optional()
			.describe('Source language code (default: "en")'),
		targetLocales: z
			.array(z.string())
			.optional()
			.describe('Target language codes, e.g. ["es", "fr", "de"]'),
		scope: z
			.string()
			.optional()
			.describe(
				'Subdirectory to limit file scanning, e.g. "src/components". Defaults to entire project.',
			),
		appDir: z
			.string()
			.optional()
			.describe(
				"App directory override for monorepos. Absolute path to the app package root.",
			),
	},
	async ({ sourceLocale, targetLocales, scope, appDir }) => {
		try {
			const result = runImplementI18n({ sourceLocale, targetLocales, scope, appDir });
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `Implementation plan generation failed: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
			};
		}
	},
);

// vocoder_status — show project config and health.
server.tool(
	"vocoder_status",
	"Get the current Vocoder project status: project name, source locale, target locales, target branches, and sync policy.",
	{},
	async () => {
		const client = createClient();
		if (!client)
			return { content: [{ type: "text", text: NO_API_KEY_MESSAGE }] };
		try {
			const text = await runStatus(client);
			return { content: [{ type: "text", text }] };
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `Status check failed: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
			};
		}
	},
);

// vocoder_sync — extract strings and submit for translation.
server.tool(
	"vocoder_sync",
	"Extract all translatable strings from the current project and submit them to Vocoder for translation. Polls until translations are ready (up to 60 seconds).",
	{
		branch: z
			.string()
			.optional()
			.describe("Git branch to sync (auto-detected from git if not provided)"),
		force: z
			.boolean()
			.optional()
			.describe("Force re-sync even if strings are unchanged"),
		mode: z
			.enum(["auto", "required", "best-effort"])
			.optional()
			.describe(
				'Sync mode: "auto" (default), "required" (block until done), "best-effort" (queue and return immediately)',
			),
	},
	async ({ branch, force, mode }) => {
		const client = createClient();
		if (!client)
			return { content: [{ type: "text", text: NO_API_KEY_MESSAGE }] };
		try {
			const text = await runSync({ branch, force, mode }, client);
			return { content: [{ type: "text", text }] };
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `Sync failed: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
			};
		}
	},
);

// vocoder_get_translations — fetch the current translation snapshot.
server.tool(
	"vocoder_get_translations",
	"Fetch the current translation snapshot for a branch. Returns a JSON map of { locale: { sourceText: translatedText } }.",
	{
		branch: z
			.string()
			.optional()
			.describe('Branch to fetch translations for (default: "main")'),
		locale: z
			.string()
			.optional()
			.describe(
				'Specific locale to return (e.g. "es"). Returns all locales if omitted.',
			),
	},
	async ({ branch, locale }) => {
		const client = createClient();
		if (!client)
			return { content: [{ type: "text", text: NO_API_KEY_MESSAGE }] };
		try {
			const text = await runGetTranslations({ branch, locale }, client);
			return { content: [{ type: "text", text }] };
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `Failed to fetch translations: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
			};
		}
	},
);

// vocoder_list_locales — list all locales Vocoder supports.
server.tool(
	"vocoder_list_locales",
	"List all locales supported by Vocoder. Returns BCP 47 codes with display names. Call this before vocoder_add_locale to find the correct code for a language.",
	{},
	async () => {
		const client = createClient();
		if (!client)
			return { content: [{ type: "text", text: NO_API_KEY_MESSAGE }] };
		try {
			const { locales } = await client.listLocales();
			const lines = locales.map((l) =>
				l.nativeName && l.nativeName !== l.name
					? `${l.code} — ${l.name} (${l.nativeName})`
					: `${l.code} — ${l.name}`,
			);
			return { content: [{ type: "text", text: lines.join("\n") }] };
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `Failed to list locales: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
			};
		}
	},
);

// vocoder_add_locale — add a new target language to the project.
server.tool(
	"vocoder_add_locale",
	'Add a new target locale to the Vocoder project. The locale must be a valid BCP 47 code (e.g. "fr", "de", "pt-BR", "zh-TW").',
	{
		locale: z
			.string()
			.describe('BCP 47 locale code to add, e.g. "fr" or "pt-BR"'),
	},
	async ({ locale }) => {
		const client = createClient();
		if (!client)
			return { content: [{ type: "text", text: NO_API_KEY_MESSAGE }] };
		try {
			const text = await runAddLocale(locale, client);
			return { content: [{ type: "text", text }] };
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `Failed to add locale: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
			};
		}
	},
);

const transport = new StdioServerTransport();
await server.connect(transport);
