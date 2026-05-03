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
export { VocoderAPI, VocoderAPIError } from "./utils/api.js";
export { readAuthData, writeAuthData, clearAuthData, verifyStoredAuth } from "./utils/auth-store.js";
export type { AuthData, StoredAuthStatus } from "./utils/auth-store.js";
export { loadVocoderConfig } from "@vocoder/extractor";
export type { VocoderConfig } from "@vocoder/extractor";
export { defineConfig } from "@vocoder/config";
export type { SetupSnippets } from "./utils/setup-snippets.js";
export { getSetupSnippets } from "./utils/setup-snippets.js";
