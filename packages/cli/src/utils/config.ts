import type { LocalConfig, TranslateOptions } from '../types.js';

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
  configSources: {
    extractionPattern: string;
    excludePattern: string;
    apiKey: string;
    apiUrl: string;
  };
}> {
  const configSources = {
    extractionPattern: 'default',
    excludePattern: 'default',
    apiKey: 'environment',
    apiUrl: 'default',
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

  // Log config sources in verbose mode
  if (verbose) {
    console.log(chalk.dim('\n   Configuration sources:'));
    console.log(chalk.dim(`     Include patterns: ${configSources.extractionPattern}`));
    if (excludePattern.length > 0) {
      console.log(chalk.dim(`     Exclude patterns: ${configSources.excludePattern}`));
    }
    console.log(chalk.dim(`     API key: ${configSources.apiKey}`));
    console.log(chalk.dim(`     API URL: ${configSources.apiUrl}\n`));
  }

  return {
    extractionPattern,
    excludePattern,
    apiKey,
    apiUrl,
    configSources,
  };
}
