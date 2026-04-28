import * as p from '@clack/prompts';

import type {
  EffectiveSyncMode,
  ExtractedString,
  LimitErrorResponse,
  ProjectConfig,
  RequestedSyncMode,
  SyncPolicyConfig,
  TranslateOptions,
  TranslationStringEntry,
} from '../types.js';
import { VocoderAPI, VocoderAPIError } from '../utils/api.js';
import { createHash, randomUUID } from 'node:crypto';
import { detectBranch, isTargetBranch } from '../utils/branch.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { getMergedConfig, validateLocalConfig } from '../utils/config.js';

import { StringExtractor } from '../utils/extract.js';
import chalk from 'chalk';
import { join } from 'path';
import { resolveGitRepositoryIdentity } from '../utils/git-identity.js';

type LocaleMetadataMap = Record<string, { nativeName: string; dir?: 'rtl' }>;
type TranslationMap = Record<string, Record<string, string>>;
type TranslationArtifactSource = 'fresh' | 'local-cache' | 'api-snapshot';

type TranslationArtifacts = {
  source: TranslationArtifactSource;
  translations: TranslationMap;
  localeMetadata?: LocaleMetadataMap;
  snapshotBatchId?: string;
  completedAt?: string | null;
  cacheBranch?: string;
};

type LocalSnapshotCache = {
  version: 1;
  branch: string;
  sourceLocale: string;
  targetLocales: string[];
  savedAt: string;
  stringsHash?: string;
  snapshotBatchId?: string;
  completedAt?: string | null;
  localeMetadata?: LocaleMetadataMap;
  translations: TranslationMap;
};

function computeStringsHash(texts: string[]): string {
  const sorted = [...texts].sort();
  return createHash('sha256').update(sorted.join('\0')).digest('hex').slice(0, 16);
}

function readCachedStringsHash(projectRoot: string, branch: string): string | null {
  const filePath = getCacheFilePath(projectRoot, branch);
  if (!existsSync(filePath)) return null;
  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as unknown;
    if (isRecord(raw) && typeof raw.stringsHash === 'string') return raw.stringsHash;
  } catch { /* ignore */ }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseLocaleMetadata(value: unknown): LocaleMetadataMap | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const metadata: LocaleMetadataMap = {};
  for (const [locale, rawValue] of Object.entries(value)) {
    if (!isRecord(rawValue)) {
      continue;
    }

    const nativeName = rawValue.nativeName;
    if (typeof nativeName !== 'string' || nativeName.trim().length === 0) {
      continue;
    }

    const entry: { nativeName: string; dir?: 'rtl' } = { nativeName };
    if (rawValue.dir === 'rtl') {
      entry.dir = 'rtl';
    }

    metadata[locale] = entry;
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function parseTranslations(value: unknown): TranslationMap | null {
  if (!isRecord(value)) {
    return null;
  }

  const translations: TranslationMap = {};

  for (const [locale, localeValue] of Object.entries(value)) {
    if (!isRecord(localeValue)) {
      continue;
    }

    const localeTranslations: Record<string, string> = {};
    for (const [source, translated] of Object.entries(localeValue)) {
      if (typeof translated === 'string') {
        localeTranslations[source] = translated;
      }
    }

    translations[locale] = localeTranslations;
  }

  return Object.keys(translations).length > 0 ? translations : null;
}

function getCacheFilePath(projectRoot: string, branch: string): string {
  const branchHash = createHash('sha1').update(branch).digest('hex').slice(0, 12);
  return join(projectRoot, 'node_modules', '.vocoder', 'cache', 'sync', `${branchHash}.json`);
}

function readLocalSnapshotCache(params: {
  projectRoot: string;
  branch: string;
}): TranslationArtifacts | null {
  const candidateBranches = params.branch === 'main'
    ? ['main']
    : [params.branch, 'main'];

  for (const candidateBranch of candidateBranches) {
    const cacheFilePath = getCacheFilePath(params.projectRoot, candidateBranch);

    if (!existsSync(cacheFilePath)) {
      continue;
    }

    try {
      const raw = readFileSync(cacheFilePath, 'utf-8');
      const parsed = JSON.parse(raw) as unknown;
      if (!isRecord(parsed)) {
        continue;
      }

      const translations = parseTranslations(parsed.translations);
      if (!translations) {
        continue;
      }

      const localeMetadata = parseLocaleMetadata(parsed.localeMetadata);

      return {
        source: 'local-cache',
        translations,
        localeMetadata,
        snapshotBatchId:
          typeof parsed.snapshotBatchId === 'string'
            ? parsed.snapshotBatchId
            : undefined,
        completedAt:
          typeof parsed.completedAt === 'string' ? parsed.completedAt : null,
        cacheBranch: candidateBranch,
      };
    } catch {
      continue;
    }
  }

  return null;
}

function writeLocalSnapshotCache(params: {
  projectRoot: string;
  branch: string;
  sourceLocale: string;
  targetLocales: string[];
  translations: TranslationMap;
  localeMetadata?: LocaleMetadataMap;
  snapshotBatchId?: string;
  completedAt?: string | null;
  stringsHash?: string;
}): string {
  const cacheFilePath = getCacheFilePath(params.projectRoot, params.branch);
  mkdirSync(join(params.projectRoot, 'node_modules', '.vocoder', 'cache', 'sync'), {
    recursive: true,
  });

  const payload: LocalSnapshotCache = {
    version: 1,
    branch: params.branch,
    sourceLocale: params.sourceLocale,
    targetLocales: params.targetLocales,
    savedAt: new Date().toISOString(),
    ...(params.stringsHash ? { stringsHash: params.stringsHash } : {}),
    ...(params.snapshotBatchId ? { snapshotBatchId: params.snapshotBatchId } : {}),
    ...(params.completedAt ? { completedAt: params.completedAt } : {}),
    ...(params.localeMetadata ? { localeMetadata: params.localeMetadata } : {}),
    translations: params.translations,
  };

  writeFileSync(cacheFilePath, JSON.stringify(payload, null, 2), 'utf-8');
  return cacheFilePath;
}

function resolveEffectiveModeFromPolicy(params: {
  branch: string;
  requestedMode: RequestedSyncMode;
  policy: SyncPolicyConfig;
}): EffectiveSyncMode {
  const { requestedMode, policy, branch } = params;

  let mode: EffectiveSyncMode;
  if (requestedMode === 'auto') {
    const isBlockingBranch = isTargetBranch(branch, policy.blockingBranches);
    mode = isBlockingBranch ? policy.blockingMode : policy.nonBlockingMode;
  } else {
    mode = requestedMode;
  }

  return mode;
}

function resolveWaitTimeoutMs(params: {
  requestedMaxWaitMs?: number;
  policyDefaultMaxWaitMs?: number;
  fallbackTimeoutMs: number;
}): number {
  if (
    typeof params.requestedMaxWaitMs === 'number' &&
    Number.isFinite(params.requestedMaxWaitMs) &&
    params.requestedMaxWaitMs > 0
  ) {
    return Math.floor(params.requestedMaxWaitMs);
  }

  if (
    typeof params.policyDefaultMaxWaitMs === 'number' &&
    Number.isFinite(params.policyDefaultMaxWaitMs) &&
    params.policyDefaultMaxWaitMs > 0
  ) {
    return Math.floor(params.policyDefaultMaxWaitMs);
  }

  return params.fallbackTimeoutMs;
}

function normalizeTranslations(params: {
  sourceLocale: string;
  targetLocales: string[];
  sourceStrings: string[];
  translations: TranslationMap;
}): TranslationMap {
  const merged: TranslationMap = {};

  for (const [locale, values] of Object.entries(params.translations)) {
    merged[locale] = { ...values };
  }

  const expectedLocales = [
    params.sourceLocale,
    ...params.targetLocales.filter((locale) => locale !== params.sourceLocale),
  ];

  for (const locale of expectedLocales) {
    if (!merged[locale]) {
      merged[locale] = {};
    }
  }

  if (!merged[params.sourceLocale]) {
    merged[params.sourceLocale] = {};
  }

  for (const sourceText of params.sourceStrings) {
    if (!(sourceText in merged[params.sourceLocale]!)) {
      merged[params.sourceLocale]![sourceText] = sourceText;
    }
  }

  return merged;
}

export function getLimitErrorGuidance(limitError: LimitErrorResponse): string[] {
  if (limitError.limitType === 'providers') {
    return [
      'Provider setup required.',
      'Add a DeepL API key in Dashboard -> Workspace Settings -> Providers.',
      `Open settings: ${limitError.upgradeUrl}`,
    ];
  }

  if (limitError.limitType === 'translation_chars') {
    return [
      'Monthly translation character limit reached.',
      `Used this month: ${limitError.current.toLocaleString()} chars`,
      `Requested after sync: ${limitError.required.toLocaleString()} chars`,
      `Upgrade plan: ${limitError.upgradeUrl}`,
    ];
  }

  if (limitError.limitType === 'source_strings') {
    return [
      'Active source string limit reached.',
      `Current active strings: ${limitError.current.toLocaleString()}`,
      `Required for this sync: ${limitError.required.toLocaleString()}`,
      `Upgrade plan: ${limitError.upgradeUrl}`,
    ];
  }

  return [
    `Plan: ${limitError.planId}`,
    `Current: ${limitError.current}`,
    `Required: ${limitError.required}`,
    `Upgrade: ${limitError.upgradeUrl}`,
  ];
}

function getSyncPolicyErrorGuidance(
  error: NonNullable<VocoderAPIError['syncPolicyError']>,
): string[] {
  if (error.errorCode === 'BRANCH_NOT_ALLOWED') {
    const lines = ['This branch is not allowed for this project.'];
    if (error.branch) {
      lines.push(`Current branch: ${error.branch}`);
    }
    // targetBranches removed — configure branches in project settings
    lines.push('Update your project target branches in the dashboard if needed.');
    return lines;
  }

  const lines = ['This project is bound to a different repository.'];
  if (error.boundRepoLabel) {
    lines.push(`Bound repository: ${error.boundRepoLabel}`);
  }
  if (error.boundScopePath) {
    lines.push(`Bound scope: ${error.boundScopePath}`);
  }
  lines.push(
    'Run `vocoder init` from the correct repository or create a separate project.',
  );
  return lines;
}

function mergeContext(
  current: string | undefined,
  incoming: string | undefined,
): string | undefined {
  if (!incoming) return current;
  if (!current) return incoming;
  if (current === incoming) return current;

  const merged = new Set(
    [...current.split(' | '), ...incoming.split(' | ')]
      .map((part) => part.trim())
      .filter(Boolean),
  );
  return Array.from(merged).join(' | ');
}

function buildStringEntries(
  extractedStrings: ExtractedString[],
): TranslationStringEntry[] {
  const byText = new Map<string, TranslationStringEntry>();

  for (const str of extractedStrings) {
    const existing = byText.get(str.text);
    if (!existing) {
      byText.set(str.text, {
        key: str.key,
        text: str.text,
        ...(str.context ? { context: str.context } : {}),
        ...(str.formality ? { formality: str.formality } : {}),
      });
      continue;
    }

    existing.context = mergeContext(existing.context, str.context);

    if (!existing.formality && str.formality) {
      existing.formality = str.formality;
    } else if (
      existing.formality &&
      str.formality &&
      existing.formality !== str.formality
    ) {
      existing.formality = 'auto';
    }

    if (str.key < existing.key) {
      existing.key = str.key;
    }
  }

  return Array.from(byText.values());
}

async function fetchApiSnapshot(api: VocoderAPI, params: {
  branch: string;
  targetLocales: string[];
}): Promise<TranslationArtifacts | null> {
  const snapshot = await api.getTranslationSnapshot({
    branch: params.branch,
    targetLocales: params.targetLocales,
  });

  if (snapshot.status !== 'FOUND' || !snapshot.translations) {
    return null;
  }

  return {
    source: 'api-snapshot',
    translations: snapshot.translations,
    localeMetadata: snapshot.localeMetadata,
    snapshotBatchId: snapshot.snapshotBatchId,
    completedAt: snapshot.completedAt,
  };
}

/**
 * Main sync command
 */
export async function sync(options: TranslateOptions = {}): Promise<number> {
  const startTime = Date.now();
  const projectRoot = process.cwd();

  p.intro('Vocoder Sync');

  const spinner = p.spinner();

  try {
    spinner.start('Detecting branch');
    const branch = detectBranch(options.branch);
    spinner.stop(`Branch: ${chalk.cyan(branch)}`);

    spinner.start('Loading project configuration');

    const mergedConfig = await getMergedConfig(options, options.verbose);
    const localConfig = {
      apiKey: mergedConfig.apiKey || '',
      apiUrl: mergedConfig.apiUrl || 'https://vocoder.app',
    };
    validateLocalConfig(localConfig);

    const api = new VocoderAPI(localConfig);
    const apiConfig = await api.getProjectConfig();

    const requestedMode = mergedConfig.mode;
    const waitTimeoutMs = resolveWaitTimeoutMs({
      requestedMaxWaitMs: mergedConfig.maxWaitMs,
      policyDefaultMaxWaitMs: apiConfig.syncPolicy.defaultMaxWaitMs,
      fallbackTimeoutMs: 60_000,
    });

    const config: ProjectConfig = {
      ...localConfig,
      ...apiConfig,
      includePattern: mergedConfig.includePattern,
      excludePattern: mergedConfig.excludePattern,
      timeout: waitTimeoutMs,
    };

    spinner.stop('Project configuration loaded');

    if (!options.force && !isTargetBranch(branch, config.targetBranches)) {
      p.log.warn(
        `Skipping translations (${chalk.cyan(branch)} is not a target branch)`,
      );
      p.log.info(`Target branches: ${config.targetBranches.join(', ')}`);
      p.log.info('Use --force to translate anyway');
      p.outro('');
      return 0;
    }

    const patternsDisplay = Array.isArray(config.includePattern)
      ? config.includePattern.join(', ')
      : config.includePattern;

    spinner.start(`Extracting strings from ${patternsDisplay}`);
    const extractor = new StringExtractor();
    const extractedStrings = await extractor.extractFromProject(
      config.includePattern,
      projectRoot,
      config.excludePattern,
    );

    if (extractedStrings.length === 0) {
      spinner.stop('No translatable strings found');
      p.log.warn('Make sure you are wrapping translatable strings with Vocoder');
      p.outro('');
      return 0;
    }

    spinner.stop(
      `Extracted ${chalk.cyan(extractedStrings.length)} strings from ${chalk.cyan(patternsDisplay)}`,
    );

    if (options.verbose) {
      const sampleLines = extractedStrings
        .slice(0, 5)
        .map((s: ExtractedString) => `  "${s.text}" (${s.file}:${s.line})`);
      if (extractedStrings.length > 5) {
        sampleLines.push(`  ... and ${extractedStrings.length - 5} more`);
      }
      p.note(sampleLines.join('\n'), 'Sample strings');
    }

    if (options.dryRun) {
      p.note(
        [
          `Strings: ${extractedStrings.length}`,
          `Branch: ${branch}`,
          `Target locales: ${config.targetLocales.join(', ')}`,
          `Requested mode: ${requestedMode}`,
          `Max wait: ${waitTimeoutMs}ms`,
          `No fallback: ${mergedConfig.noFallback ? 'yes' : 'no'}`,
        ].join('\n'),
        'Dry run - would translate',
      );
      p.outro('No API calls made.');
      return 0;
    }

    const repoIdentity = resolveGitRepositoryIdentity();
    if (!repoIdentity && options.verbose) {
      p.log.warn(
        'Could not detect git remote origin. Sync will continue without repo metadata.',
      );
    }

    const stringEntries = buildStringEntries(extractedStrings);
    const sourceStrings = stringEntries.map((entry) => entry.text);

    if (options.verbose && stringEntries.length !== extractedStrings.length) {
      p.log.info(
        `Deduped ${extractedStrings.length} extracted entries into ${stringEntries.length} unique source strings`,
      );
    }

    // Local hash check — skip API submission if strings haven't changed since last sync.
    const currentHash = computeStringsHash(sourceStrings);
    if (!options.force) {
      const cachedHash = readCachedStringsHash(projectRoot, branch);
      if (cachedHash && cachedHash === currentHash) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        p.outro(`Up to date (${duration}s)`);
        return 0;
      }
    }

    spinner.start('Submitting strings to Vocoder API');

    const batchResponse = await api.submitTranslation(
      branch,
      stringEntries,
      config.targetLocales,
      {
        requestedMode,
        requestedMaxWaitMs: waitTimeoutMs,
        clientRunId: randomUUID(),
      },
      repoIdentity ?? undefined,
    );

    spinner.stop(`Submitted to API - Batch ${chalk.cyan(batchResponse.batchId)}`);

    const effectiveMode = batchResponse.effectiveMode ??
      resolveEffectiveModeFromPolicy({
        branch,
        requestedMode,
        policy: config.syncPolicy,
      });

    if (options.verbose) {
      p.log.info(`Requested mode: ${requestedMode}`);
      p.log.info(`Effective mode: ${effectiveMode}`);
      p.log.info(`Wait timeout: ${waitTimeoutMs}ms`);
      if (batchResponse.queueStatus) {
        p.log.info(`Queue status: ${batchResponse.queueStatus}`);
      }
    }

    if (batchResponse.status === 'UP_TO_DATE' && batchResponse.noChanges) {
      p.log.success('No changes detected - strings are up to date');
    }

    p.log.info(`New strings: ${chalk.cyan(batchResponse.newStrings)}`);

    if (batchResponse.deletedStrings && batchResponse.deletedStrings > 0) {
      p.log.info(
        `Deleted strings: ${chalk.yellow(batchResponse.deletedStrings)} (archived)`,
      );
    }

    p.log.info(`Total strings: ${chalk.cyan(batchResponse.totalStrings)}`);

    if (batchResponse.newStrings === 0) {
      p.log.success('No new strings - using existing translations');
    } else {
      p.log.info(
        `Syncing to ${config.targetLocales.length} locales (${config.targetLocales.join(', ')})`,
      );

      if (batchResponse.estimatedTime) {
        p.log.info(`Estimated time: ~${batchResponse.estimatedTime}s`);
      }
    }

    let artifacts: TranslationArtifacts | null = null;
    if (batchResponse.translations) {
      artifacts = {
        source: 'fresh',
        translations: batchResponse.translations,
      };
    }

    let waitError: Error | null = null;
    if (!artifacts && (effectiveMode === 'required' || effectiveMode === 'best-effort')) {
      spinner.start(`Waiting for translations (max ${waitTimeoutMs}ms)`);

      let lastProgress = 0;
      try {
        const completion = await api.waitForCompletion(
          batchResponse.batchId,
          waitTimeoutMs,
          (progress) => {
            const percent = Math.round(progress * 100);
            if (percent > lastProgress) {
              spinner.message(`Translating... ${percent}%`);
              lastProgress = percent;
            }
          },
        );

        artifacts = {
          source: 'fresh',
          translations: completion.translations,
          localeMetadata: completion.localeMetadata,
        };
        spinner.stop('Translations complete');
      } catch (error) {
        spinner.stop('Translation wait incomplete');
        waitError = error instanceof Error ? error : new Error(String(error));

        if (effectiveMode === 'required') {
          throw waitError;
        }

        p.log.warn(`Best-effort wait ended early: ${waitError.message}`);
      }
    }

    if (!artifacts) {
      if (mergedConfig.noFallback) {
        throw new Error(
          'Fresh translations are not available and fallback is disabled (--no-fallback).',
        );
      }

      spinner.start('Loading fallback translations');

      const localFallback = readLocalSnapshotCache({
        projectRoot,
        branch,
      });

      if (localFallback) {
        artifacts = localFallback;
        const cacheBranchLabel =
          localFallback.cacheBranch && localFallback.cacheBranch !== branch
            ? `${localFallback.cacheBranch} fallback`
            : localFallback.cacheBranch || branch;
        spinner.stop(`Using local cached snapshot (${cacheBranchLabel})`);
      } else {
        try {
          const apiSnapshot = await fetchApiSnapshot(api, {
            branch,
            targetLocales: config.targetLocales,
          });

          if (apiSnapshot) {
            artifacts = apiSnapshot;
            spinner.stop('Using latest completed API snapshot');
          } else {
            spinner.stop('No completed API snapshot available');
          }
        } catch (error) {
          spinner.stop('Failed to fetch API snapshot');
          if (options.verbose) {
            const message =
              error instanceof Error ? error.message : 'Unknown snapshot fetch error';
            p.log.warn(`Snapshot fetch error: ${message}`);
          }
        }
      }

      if (!artifacts) {
        if (waitError) {
          throw new Error(
            `No fallback snapshot available after wait failure: ${waitError.message}`,
          );
        }

        throw new Error(
          'No fallback snapshot available. Try again shortly or run with --mode required.',
        );
      }
    }

    const finalTranslations = normalizeTranslations({
      sourceLocale: config.sourceLocale,
      targetLocales: config.targetLocales,
      sourceStrings,
      translations: artifacts.translations,
    });

    try {
      const cachePath = writeLocalSnapshotCache({
        projectRoot,
        branch,
        sourceLocale: config.sourceLocale,
        targetLocales: config.targetLocales,
        translations: finalTranslations,
        localeMetadata: artifacts.localeMetadata,
        stringsHash: currentHash,
        snapshotBatchId:
          artifacts.snapshotBatchId ??
          (artifacts.source === 'fresh'
            ? batchResponse.batchId
            : batchResponse.latestCompletedBatchId),
        completedAt:
          artifacts.completedAt ??
          (artifacts.source === 'fresh' ? new Date().toISOString() : null),
      });

      if (options.verbose) {
        p.log.info(`Cached snapshot: ${cachePath}`);
      }
    } catch (error) {
      if (options.verbose) {
        const message =
          error instanceof Error ? error.message : 'Unknown cache write error';
        p.log.warn(`Failed to write local snapshot cache: ${message}`);
      }
    }

    if (artifacts.source !== 'fresh') {
      const sourceLabel =
        artifacts.source === 'local-cache'
          ? 'local cached snapshot'
          : 'completed API snapshot';
      p.log.warn(
        `Using ${sourceLabel}. New strings may appear after the background sync completes.`,
      );
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    p.outro(`Sync complete! (${duration}s)`);
    return 0;
  } catch (error) {
    spinner.stop();

    if (error instanceof VocoderAPIError && error.syncPolicyError) {
      p.log.error(error.syncPolicyError.message);
      const guidance = getSyncPolicyErrorGuidance(error.syncPolicyError);
      for (const line of guidance) {
        p.log.info(line);
      }
      return 1;
    }

    if (error instanceof VocoderAPIError && error.limitError) {
      const { limitError } = error;
      p.log.error(limitError.message);
      const guidance = getLimitErrorGuidance(limitError);
      for (const line of guidance) {
        p.log.info(line);
      }
      return 1;
    }

    if (error instanceof Error) {
      p.log.error(error.message);

      if (error.message.includes('VOCODER_API_KEY')) {
        p.log.warn('VOCODER_API_KEY is only needed for `vocoder sync` (CLI push).');
        p.log.info('  Create one at: https://vocoder.app/dashboard');
        p.log.info('  Then: export VOCODER_API_KEY="vc_..." or add it to .env');
        p.log.info('');
        p.log.info('  Note: If you use @vocoder/unplugin, `vocoder sync` is optional.');
        p.log.info('  Translations are fetched automatically at build time.');
      } else if (error.message.includes('git branch')) {
        p.log.warn('Run from a git repository, or use:');
        p.log.info('  vocoder sync --branch main');
      }

      if (options.verbose) {
        p.log.info(`Full error: ${error.stack ?? error}`);
      }
    }

    return 1;
  }
}
