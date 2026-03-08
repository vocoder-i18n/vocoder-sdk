import type { LocalConfig, RequestedSyncMode, TranslateOptions } from '../types.js';

import chalk from 'chalk';
import { config as loadEnv } from 'dotenv';

// Load .env file if present
loadEnv();

/**
 * Validates the local configuration
 */
export function validateLocalConfig(config: LocalConfig): void {
  if (!config.apiKey || config.apiKey.length === 0) {
    throw new Error('VOCODER_API_KEY is required. Set it in your .env file.');
  }

  if (!config.apiKey.startsWith('vc_')) {
    throw new Error('Invalid API key format. Expected format: vc_...');
  }

  if (!config.apiUrl || !config.apiUrl.startsWith('http')) {
    throw new Error('Invalid API URL');
  }
}

/**
 * Merge configuration from all sources with priority:
 * 1. CLI flags (highest priority)
 * 2. Environment variables
 * 3. Defaults (lowest priority)
 *
 * @param cliOptions - Options from CLI flags
 * @param verbose - Whether to log config sources
 * @returns Merged configuration with source information
 */
export async function getMergedConfig(
  cliOptions: TranslateOptions,
  verbose: boolean = false,
  _startDir?: string
): Promise<{
  extractionPattern: string[];
  excludePattern: string[];
  apiKey?: string;
  apiUrl?: string;
  mode: RequestedSyncMode;
  maxWaitMs?: number;
  noFallback: boolean;
  configSources: {
    extractionPattern: string;
    excludePattern: string;
    apiKey: string;
    apiUrl: string;
    mode: string;
    maxWaitMs: string;
    noFallback: string;
  };
}> {
  const configSources = {
    extractionPattern: 'default',
    excludePattern: 'default',
    apiKey: 'environment',
    apiUrl: 'default',
    mode: 'default',
    maxWaitMs: 'default',
    noFallback: 'default',
  };

  // 1. Defaults
  const defaults = {
    extractionPattern: ['src/**/*.{tsx,jsx,ts,js}'],
    excludePattern: [] as string[],
    apiUrl: 'https://vocoder.app',
  };

  // 2. Environment variables
  const envExtractionPattern = process.env.VOCODER_EXTRACTION_PATTERN;
  const envApiUrl = process.env.VOCODER_API_URL;
  const envSyncMode = process.env.VOCODER_SYNC_MODE;
  const envSyncMaxWaitMs = process.env.VOCODER_SYNC_MAX_WAIT_MS;
  const envSyncNoFallback = process.env.VOCODER_SYNC_NO_FALLBACK;

  // 3. Merge with priority: CLI > env > defaults

  // Extract patterns (include)
  let extractionPattern: string[];
  if (cliOptions.include && cliOptions.include.length > 0) {
    extractionPattern = cliOptions.include;
    configSources.extractionPattern = 'CLI flag';
  } else if (envExtractionPattern) {
    extractionPattern = [envExtractionPattern];
    configSources.extractionPattern = 'environment';
  } else {
    extractionPattern = defaults.extractionPattern;
  }

  // Exclude patterns
  let excludePattern: string[];
  if (cliOptions.exclude && cliOptions.exclude.length > 0) {
    excludePattern = cliOptions.exclude;
    configSources.excludePattern = 'CLI flag';
  } else {
    excludePattern = defaults.excludePattern;
  }

  // API key (from env)
  let apiKey: string | undefined;
  if (process.env.VOCODER_API_KEY) {
    apiKey = process.env.VOCODER_API_KEY;
    configSources.apiKey = 'environment';
  }

  // API URL
  let apiUrl: string;
  if (envApiUrl) {
    apiUrl = envApiUrl;
    configSources.apiUrl = 'environment';
  } else {
    apiUrl = defaults.apiUrl;
  }

  const modeCandidates = ['auto', 'required', 'best-effort'] as const;
  let mode: RequestedSyncMode = 'auto';
  if (cliOptions.mode && modeCandidates.includes(cliOptions.mode)) {
    mode = cliOptions.mode;
    configSources.mode = 'CLI flag';
  } else if (envSyncMode && modeCandidates.includes(envSyncMode as RequestedSyncMode)) {
    mode = envSyncMode as RequestedSyncMode;
    configSources.mode = 'environment';
  }

  let maxWaitMs: number | undefined;
  if (typeof cliOptions.maxWaitMs === 'number' && Number.isFinite(cliOptions.maxWaitMs) && cliOptions.maxWaitMs > 0) {
    maxWaitMs = Math.floor(cliOptions.maxWaitMs);
    configSources.maxWaitMs = 'CLI flag';
  } else if (envSyncMaxWaitMs) {
    const parsed = Number.parseInt(envSyncMaxWaitMs, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      maxWaitMs = parsed;
      configSources.maxWaitMs = 'environment';
    }
  }

  let noFallback = false;
  if (typeof cliOptions.noFallback === 'boolean') {
    noFallback = cliOptions.noFallback;
    configSources.noFallback = 'CLI flag';
  } else if (envSyncNoFallback) {
    noFallback = ['1', 'true', 'yes', 'on'].includes(envSyncNoFallback.toLowerCase());
    configSources.noFallback = 'environment';
  }

  // Log config sources in verbose mode
  if (verbose) {
    console.log(chalk.dim('\n   Configuration sources:'));
    console.log(chalk.dim(`     Include patterns: ${configSources.extractionPattern}`));
    if (excludePattern.length > 0) {
      console.log(chalk.dim(`     Exclude patterns: ${configSources.excludePattern}`));
    }
    console.log(chalk.dim(`     API key: ${configSources.apiKey}`));
    console.log(chalk.dim(`     API URL: ${configSources.apiUrl}\n`));
    console.log(chalk.dim(`     Sync mode: ${configSources.mode}`));
    if (maxWaitMs) {
      console.log(chalk.dim(`     Max wait: ${configSources.maxWaitMs}`));
    }
    console.log(chalk.dim(`     No fallback: ${configSources.noFallback}\n`));
  }

  return {
    extractionPattern,
    excludePattern,
    apiKey,
    apiUrl,
    mode,
    maxWaitMs,
    noFallback,
    configSources,
  };
}
