import { createUnplugin } from "unplugin";
import {
	computeFingerprint,
	extractSourceTexts,
	fetchTranslations,
	loadEnvFile,
} from "./core";
import type { VocoderPluginOptions, VocoderTranslationData } from "./types";

export type { VocoderPluginOptions, VocoderTranslationData };
export {
	computeFingerprint,
	detectBranch,
	detectCommitSha,
	detectRepoIdentity,
} from "./core";

const VIRTUAL_PREFIX = "virtual:vocoder/";
const STRIPPED_PREFIX = "vocoder/";
const RESOLVED_PREFIX = "\0virtual:vocoder/";

// Shared across all compiler instances in the same process (Next.js runs server + client + edge).
// Keyed by cwd + apiUrl + include/exclude so different plugin configs stay isolated.
type InitResult = { fingerprint: string; data: VocoderTranslationData };
const _initCache = new Map<string, Promise<InitResult>>();

export const unplugin = createUnplugin(
	(options: VocoderPluginOptions | undefined = {}) => {
		// Load .env before reading env vars — build plugins run before bundler's own .env loading
		loadEnvFile();

		const apiUrl = process.env.VOCODER_API_URL ?? "https://vocoder.app";
		const cacheKey = [
			process.cwd(),
			apiUrl,
			JSON.stringify(options.include ?? null),
			JSON.stringify(options.exclude ?? null),
		].join("|");

		let fingerprint: string;
		let data: VocoderTranslationData | null = null;

		async function init(): Promise<void> {
			if (!_initCache.has(cacheKey)) {
				_initCache.set(cacheKey, runInit());
			}
			const result = await _initCache.get(cacheKey)!;
			fingerprint = result.fingerprint;
			data = result.data;
		}

		async function runInit(): Promise<InitResult> {
			// VOCODER_FINGERPRINT: manual escape hatch for unusual environments.
			if (process.env.VOCODER_FINGERPRINT) {
				const fp = process.env.VOCODER_FINGERPRINT;
				console.log(
					`[vocoder] Using fingerprint from VOCODER_FINGERPRINT env var → ${fp}`,
				);
				const d = await fetchTranslations(fp, apiUrl);
				return { fingerprint: fp, data: d };
			}

			const apiKey = process.env.VOCODER_API_KEY ?? "";
			const shortCode = apiKey.startsWith("vcp_")
				? apiKey.slice(4, 14)
				: null;

			if (!shortCode) {
				console.warn(
					"[vocoder] VOCODER_API_KEY missing or not a project key (vcp_...). Translations not loaded.",
				);
				return {
					fingerprint: "",
					data: {
						config: { sourceLocale: "", targetLocales: [], locales: {} },
						translations: {},
						updatedAt: null,
					},
				};
			}

			const sourceTexts = await extractSourceTexts(
				process.cwd(),
				options.include,
				options.exclude,
			);
			const fp = computeFingerprint(shortCode, sourceTexts);
			console.log(
				`[vocoder] ${sourceTexts.length} string(s) → fingerprint ${fp}`,
			);

			const d = await fetchTranslations(fp, apiUrl);

			if (d.config.sourceLocale) {
				const localeCount = d.config.targetLocales.length;
				const stringCount = Object.values(d.translations).reduce(
					(sum: number, t: Record<string, string>) =>
						sum + Object.keys(t).length,
					0,
				);
				console.log(
					`[vocoder] Loaded ${localeCount} locale(s), ${stringCount} translation(s)`,
				);
			} else {
				console.log(
					"[vocoder] No translations available yet — source text will be shown.",
				);
			}

			return { fingerprint: fp, data: d };
		}

		function getDefineValues(): Record<string, string> {
			return {
				__VOCODER_FINGERPRINT__: JSON.stringify(fingerprint ?? ""),
				__VOCODER_API_URL__: JSON.stringify(apiUrl),
				__VOCODER_BUILD_TS__: JSON.stringify(Date.now()),
			};
		}

		return {
			name: "vocoder",
			enforce: "pre" as const,

			async buildStart() {
				await init();
			},

			resolveId(id: string) {
				if (id.startsWith(VIRTUAL_PREFIX)) {
					return RESOLVED_PREFIX + id.slice(VIRTUAL_PREFIX.length);
				}
				if (id.startsWith(STRIPPED_PREFIX)) {
					return RESOLVED_PREFIX + id.slice(STRIPPED_PREFIX.length);
				}
				return null;
			},

			async load(id: string) {
				if (!id.startsWith(RESOLVED_PREFIX)) return null;

				await init();
				if (!data) return null;

				const path = id.slice(RESOLVED_PREFIX.length);

				if (path === "manifest") {
					return generateManifestModule(data);
				}

				if (path.startsWith("translations/")) {
					const locale = path.slice("translations/".length);
					const translations = data.translations[locale] ?? {};
					return `export default ${JSON.stringify(translations)};`;
				}

				return null;
			},

			vite: {
				async config() {
					await init();
					return { define: getDefineValues() };
				},
			},

			webpack(compiler) {
				try {
					const wp = require("webpack");
					new wp.DefinePlugin(getDefineValues()).apply(compiler);
				} catch {
					// Not in a webpack environment — skip
				}
			},
		};
	},
);

function generateManifestModule(data: VocoderTranslationData): string {
	const { config, translations } = data;

	const loaderEntries = Object.keys(translations)
		.map(
			(locale: string) =>
				`  ${JSON.stringify(locale)}: () => import("virtual:vocoder/translations/${locale}")`,
		)
		.join(",\n");

	return [
		`export const config = ${JSON.stringify(config)};`,
		"",
		`export const loaders = {`,
		loaderEntries,
		`};`,
	].join("\n");
}

export default unplugin;
