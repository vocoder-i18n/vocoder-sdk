import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createClient, NO_API_KEY_MESSAGE } from "./client.js";
import { runAddLocale } from "./tools/locale.js";
import { runSetup } from "./tools/setup.js";
import { runStatus } from "./tools/status.js";
import { runSync } from "./tools/sync.js";
import { runGetTranslations } from "./tools/translations.js";

const server = new McpServer({
	name: "vocoder",
	version: "0.1.0",
});

// vocoder_setup — detect framework and return setup snippets.
// Works without an API key (local detection only).
server.tool(
	"vocoder_setup",
	"Detect the current project's framework and return everything needed to add Vocoder i18n: install command, build plugin snippet, provider wrapper snippet, and usage example. Returns structured data — apply the changes using your code editing tools.",
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
