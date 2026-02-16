import type { LocalConfig, TranslateOptions, VocoderConfigFile } from '../types.js';
import { loadConfigFile, validateConfigFile } from './config-file.js';

import chalk from 'chalk';
import { config as loadEnv } from 'dotenv';

// Load .env file if present
loadEnv();

/**
 * Loads local configuration from environment variables
 *
 * Required environment variables:
 * - VOCODER_API_KEY: Your Vocoder project API key
 *
 * Optional environment variables:
 * - VOCODER_API_URL: Override API URL (default: https://vocoder.app)
 *
 * @returns Local configuration
 */
export function getLocalConfig(): LocalConfig {
  const apiKey = process.env.VOCODER_API_KEY;

  if (!apiKey) {
    throw new Error(
      'VOCODER_API_KEY is required. Set it in your .env file or environment:\n' +
      '  export VOCODER_API_KEY="your-api-key"\n\n' +
      'Get your API key from: https://vocoder.app/settings/api-keys'
    );
  }

  return {
    apiKey,
    apiUrl: process.env.VOCODER_API_URL || 'https://vocoder.app',
  };
}

/**
 * Validates the local configuration
 */
export function validateLocalConfig(config: LocalConfig): void {
  console.log('config', config);
  if (!config.apiKey || config.apiKey.length === 0) {
    throw new Error('Invalid API key');
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
 * 2. Config file (vocoder.config.{js,ts,mjs,cjs,json})
 * 3. Environment variables
 * 4. Defaults (lowest priority)
 *
 * @param cliOptions - Options from CLI flags
 * @param verbose - Whether to log config sources
 * @param startDir - Directory to start searching for config file (defaults to cwd)
 * @returns Merged configuration with source information
 */
export async function getMergedConfig(
  cliOptions: TranslateOptions,
  verbose: boolean = false,
  startDir?: string
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

  // 1. Load config file (if exists)
  let fileConfig: VocoderConfigFile | null = null;
  let configFilePath: string | null = null;

  try {
    const result = await loadConfigFile(startDir);
    if (result) {
      fileConfig = validateConfigFile(result.config);
      configFilePath = result.filePath;

      if (verbose) {
        console.log(chalk.dim(`   Using config from: ${chalk.cyan(configFilePath)}`));
      }
    }
  } catch (error) {
    // Config file errors should be thrown (invalid config is a hard error)
    throw error;
  }

  // 2. Defaults
  const defaults = {
    extractionPattern: ['src/**/*.{tsx,jsx,ts,js}'],
    excludePattern: [] as string[],
    apiUrl: 'https://vocoder.app',
  };

  // 3. Environment variables
  const envExtractionPattern = process.env.VOCODER_EXTRACTION_PATTERN;
  const envApiUrl = process.env.VOCODER_API_URL;

  // 4. Merge with priority: CLI > file > env > defaults

  // Extract patterns (include)
  let extractionPattern: string[];
  if (cliOptions.include && cliOptions.include.length > 0) {
    extractionPattern = cliOptions.include;
    configSources.extractionPattern = 'CLI flag';
  } else if (fileConfig?.include && fileConfig.include.length > 0) {
    extractionPattern = Array.isArray(fileConfig.include) ? fileConfig.include : [fileConfig.include];
    configSources.extractionPattern = 'config file';
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
  } else if (fileConfig?.exclude && fileConfig.exclude.length > 0) {
    excludePattern = Array.isArray(fileConfig.exclude) ? fileConfig.exclude : [fileConfig.exclude];
    configSources.excludePattern = 'config file';
  } else {
    excludePattern = defaults.excludePattern;
  }

  // API key (from env or config file)
  let apiKey: string | undefined;
  if (fileConfig?.apiKey) {
    apiKey = fileConfig.apiKey;
    configSources.apiKey = 'config file';
  } else if (process.env.VOCODER_API_KEY) {
    apiKey = process.env.VOCODER_API_KEY;
    configSources.apiKey = 'environment';
  }

  // API URL
  let apiUrl: string;
  if (fileConfig?.apiUrl) {
    apiUrl = fileConfig.apiUrl;
    configSources.apiUrl = 'config file';
  } else if (envApiUrl) {
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
