import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { pathToFileURL } from 'url';
import type { VocoderConfigFile } from '../types.js';

const CONFIG_FILE_NAMES = [
  'vocoder.config.ts',
  'vocoder.config.js',
  'vocoder.config.mjs',
  'vocoder.config.cjs',
  'vocoder.config.json',
];

/**
 * Search up the directory tree for a config file
 *
 * @param startDir - Directory to start searching from
 * @returns Path to config file, or null if not found
 */
function findConfigFile(startDir: string): string | null {
  let currentDir = startDir;

  // Search up to the root directory
  while (true) {
    // Check current directory for config files
    for (const fileName of CONFIG_FILE_NAMES) {
      const filePath = join(currentDir, fileName);
      if (existsSync(filePath)) {
        return filePath;
      }
    }

    // Move up one directory
    const parentDir = dirname(currentDir);

    // Stop if we've reached the root (parent === current)
    if (parentDir === currentDir) {
      break;
    }

    currentDir = parentDir;
  }

  return null;
}

/**
 * Load a TypeScript config file using tsx
 *
 * @param filePath - Path to the .ts config file
 * @returns Loaded configuration
 */
async function loadTypeScriptConfig(filePath: string): Promise<VocoderConfigFile> {
  try {
    // Use tsx to register TypeScript loader
    const { register } = await import('tsx/esm/api');
    const unregister = register();

    try {
      // Convert to file URL for ESM import
      const fileUrl = pathToFileURL(filePath).href;
      const module = await import(fileUrl);

      // Support both default export and named exports
      return module.default || module;
    } finally {
      unregister();
    }
  } catch (error) {
    throw new Error(
      `Failed to load TypeScript config file ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Load a JavaScript config file using dynamic import
 *
 * @param filePath - Path to the .js/.mjs/.cjs config file
 * @returns Loaded configuration
 */
async function loadJavaScriptConfig(filePath: string): Promise<VocoderConfigFile> {
  try {
    // Convert to file URL for ESM import
    const fileUrl = pathToFileURL(filePath).href;
    const module = await import(fileUrl);

    // Support both default export and named exports
    return module.default || module;
  } catch (error) {
    throw new Error(
      `Failed to load JavaScript config file ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Load a JSON config file
 *
 * @param filePath - Path to the .json config file
 * @returns Loaded configuration
 */
function loadJsonConfig(filePath: string): VocoderConfigFile {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(
      `Failed to load JSON config file ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Load configuration from vocoder.config.{js,ts,mjs,cjs,json}
 * Searches up the directory tree from the starting directory
 *
 * @param startDir - Directory to start searching from (defaults to cwd)
 * @returns Loaded configuration and file path, or null if not found
 */
export async function loadConfigFile(
  startDir: string = process.cwd()
): Promise<{ config: VocoderConfigFile; filePath: string } | null> {
  const configPath = findConfigFile(startDir);

  if (!configPath) {
    return null;
  }

  let config: VocoderConfigFile;

  if (configPath.endsWith('.ts')) {
    config = await loadTypeScriptConfig(configPath);
  } else if (configPath.endsWith('.json')) {
    config = loadJsonConfig(configPath);
  } else {
    // .js, .mjs, .cjs
    config = await loadJavaScriptConfig(configPath);
  }

  return { config, filePath: configPath };
}

/**
 * Validate and normalize config file values
 *
 * @param config - Raw config from file
 * @returns Validated config
 */
export function validateConfigFile(config: VocoderConfigFile): VocoderConfigFile {
  const validated: VocoderConfigFile = {};

  // Normalize include to array
  if (config.include) {
    if (typeof config.include === 'string') {
      validated.include = [config.include];
    } else if (Array.isArray(config.include)) {
      validated.include = config.include.filter((p) => typeof p === 'string');
    }
  }

  // Normalize exclude to array
  if (config.exclude) {
    if (typeof config.exclude === 'string') {
      validated.exclude = [config.exclude];
    } else if (Array.isArray(config.exclude)) {
      validated.exclude = config.exclude.filter((p) => typeof p === 'string');
    }
  }

  // Validate API configuration
  if (config.apiKey) {
    if (typeof config.apiKey !== 'string') {
      throw new Error('Config: apiKey must be a string');
    }
    validated.apiKey = config.apiKey;
  }

  if (config.apiUrl) {
    if (typeof config.apiUrl !== 'string') {
      throw new Error('Config: apiUrl must be a string');
    }
    if (!config.apiUrl.startsWith('http')) {
      throw new Error('Config: apiUrl must start with http:// or https://');
    }
    validated.apiUrl = config.apiUrl;
  }

  return validated;
}
