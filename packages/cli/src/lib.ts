export type {
	APIAppConfig,
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
export { VocoderAPI, VocoderAPIError, computeSourceEntriesHash } from "./utils/api.js";
export type { SourceEntriesHashInput } from "./utils/api.js";
export { buildStringEntries } from "./utils/string-entries.js";
export { extractProjectShortIdFromApiKey } from "@vocoder/core";
export type { TranslationStringEntry } from "./types.js";
export { readAuthData, writeAuthData, clearAuthData, verifyStoredAuth } from "./utils/auth-store.js";
export { detectBranch } from "./utils/branch.js";
export { detectCommitSha, detectRepoIdentity } from "./utils/git-identity.js";
export type { GitRepositoryIdentity } from "./utils/git-identity.js";
export type { AuthData, StoredAuthStatus } from "./utils/auth-store.js";
export { detectAppDir, loadVocoderConfig } from "@vocoder/extractor";
export type { VocoderConfig } from "@vocoder/extractor";
export { defineConfig } from "@vocoder/config";
export type { SetupSnippets } from "./utils/setup-snippets.js";
export { getSetupSnippets } from "./utils/setup-snippets.js";

// Workflow generation — the MCP server calls these rather than re-implementing
// them, so the two can never emit different YAML or disagree on the filename.
export { WORKFLOW_RELATIVE_PATH } from "./utils/workflow-path.js";
export {
	renderWorkflowYaml,
	writeGitHubActionsWorkflow,
} from "./utils/workflow-write.js";
export type { WorkflowWriteResult } from "./utils/workflow-write.js";
export {
	readWorkflowBranches,
	readWorkflowCommitMode,
} from "./utils/workflow-read.js";

// Per-app extraction — the MCP server calls this rather than re-deriving which
// apps exist and what their fingerprint scope is. Its own copy hardcoded a
// single root app, so monorepos produced a fingerprint matching nothing.
export { extractApps, resolveAppDirs } from "./utils/extract-apps.js";
export type { AppExtraction, ExtractAppsOptions } from "./utils/extract-apps.js";

// Config generation — split render/write so the MCP emits exactly what
// `vocoder init` writes. Its own copy included an `appId` field that is not
// part of VocoderConfig and is silently dropped by the parser.
export { renderVocoderConfig, writeVocoderConfig } from "./utils/config-write.js";
export type { ConfigWriteResult } from "./utils/config-write.js";
export { resolveLookupMatch } from "./utils/project-lookup.js";
export type { ResolvedLookupMatch } from "./utils/project-lookup.js";
