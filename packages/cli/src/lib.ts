export type {
	APIProjectConfig,
	ExtractedString,
	LimitErrorResponse,
	LocaleInfo,
	LocalesMap,
	SyncPolicyConfig,
	SyncPolicyErrorResponse,
	TranslationBatchResponse,
	TranslationSnapshotResponse,
	TranslationStatusResponse,
} from "./types.js";
export type {
	DetectedEcosystem,
	DetectedFramework,
	LocalDetectionResult,
	PackageManager,
} from "./utils/detect-local.js";
export {
	buildInstallCommand,
	detectLocalEcosystem,
	getPackagesToInstall,
} from "./utils/detect-local.js";
export { StringExtractor } from "./utils/extract.js";
export type { SetupSnippets } from "./utils/setup-snippets.js";
export { getSetupSnippets } from "./utils/setup-snippets.js";
