export { StringExtractor } from './utils/extract.js';
export {
  detectLocalEcosystem,
  buildInstallCommand,
  getPackagesToInstall,
} from './utils/detect-local.js';
export { getSetupSnippets } from './utils/setup-snippets.js';
export type {
  ExtractedString,
  APIProjectConfig,
  SyncPolicyConfig,
  TranslationBatchResponse,
  TranslationStatusResponse,
  TranslationSnapshotResponse,
  LimitErrorResponse,
  SyncPolicyErrorResponse,
} from './types.js';
export type {
  LocalDetectionResult,
  DetectedFramework,
  DetectedEcosystem,
  PackageManager,
} from './utils/detect-local.js';
export type { SetupSnippets } from './utils/setup-snippets.js';
