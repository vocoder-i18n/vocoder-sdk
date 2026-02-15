import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { getMergedConfig } from '../utils/config.js';
import { loadConfigFile, validateConfigFile } from '../utils/config-file.js';
import type { TranslateOptions } from '../types.js';

describe('Config File Loader', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `vocoder-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should load JavaScript config file', async () => {
    const configPath = join(testDir, 'vocoder.config.js');
    writeFileSync(
      configPath,
      `module.exports = { include: 'src/**/*.tsx' };`
    );

    const result = await loadConfigFile(testDir);

    expect(result).not.toBeNull();
    expect(result?.config.include).toBe('src/**/*.tsx');
    expect(result?.filePath).toBe(configPath);
  });

  it('should load JSON config file', async () => {
    const configPath = join(testDir, 'vocoder.config.json');
    writeFileSync(
      configPath,
      JSON.stringify({ include: ['src/**/*.tsx'], exclude: ['**/*.test.tsx'] })
    );

    const result = await loadConfigFile(testDir);

    expect(result).not.toBeNull();
    expect(result?.config.include).toEqual(['src/**/*.tsx']);
    expect(result?.config.exclude).toEqual(['**/*.test.tsx']);
  });

  it('should load TypeScript config file', async () => {
    const configPath = join(testDir, 'vocoder.config.ts');
    writeFileSync(
      configPath,
      `export default { include: 'src/**/*.tsx' };`
    );

    const result = await loadConfigFile(testDir);

    expect(result).not.toBeNull();
    expect(result?.config.include).toBe('src/**/*.tsx');
  });

  it('should return null if no config file found', async () => {
    const result = await loadConfigFile(testDir);
    expect(result).toBeNull();
  });

  it('should search up the directory tree', async () => {
    const parentDir = testDir;
    const childDir = join(parentDir, 'src', 'components');
    mkdirSync(childDir, { recursive: true });

    const configPath = join(parentDir, 'vocoder.config.json');
    writeFileSync(configPath, JSON.stringify({ include: 'src/**/*.tsx' }));

    const result = await loadConfigFile(childDir);

    expect(result).not.toBeNull();
    expect(result?.config.include).toBe('src/**/*.tsx');
    expect(result?.filePath).toBe(configPath);
  });

  it('should prefer .ts over .js when both exist', async () => {
    writeFileSync(
      join(testDir, 'vocoder.config.ts'),
      `export default { include: 'from-ts' };`
    );
    writeFileSync(
      join(testDir, 'vocoder.config.js'),
      `module.exports = { include: 'from-js' };`
    );

    const result = await loadConfigFile(testDir);

    expect(result).not.toBeNull();
    expect(result?.config.include).toBe('from-ts');
    expect(result?.filePath).toContain('.ts');
  });
});

describe('Config Validation', () => {
  it('should normalize string include to array', () => {
    const config = validateConfigFile({ include: 'src/**/*.tsx' });
    expect(config.include).toEqual(['src/**/*.tsx']);
  });

  it('should keep array include as array', () => {
    const config = validateConfigFile({ include: ['src/**/*.tsx', 'components/**/*.tsx'] });
    expect(config.include).toEqual(['src/**/*.tsx', 'components/**/*.tsx']);
  });

  it('should normalize string exclude to array', () => {
    const config = validateConfigFile({ exclude: '**/*.test.tsx' });
    expect(config.exclude).toEqual(['**/*.test.tsx']);
  });

  it('should validate apiUrl starts with http', () => {
    expect(() => {
      validateConfigFile({ apiUrl: 'invalid-url' });
    }).toThrow('Config: apiUrl must start with http://');
  });

  it('should filter out non-string patterns', () => {
    const config = validateConfigFile({
      include: ['valid', 123, 'also-valid'] as any,
    });
    expect(config.include).toEqual(['valid', 'also-valid']);
  });
});

describe('Config Merging', () => {
  let testDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    testDir = join(tmpdir(), `vocoder-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });

    originalEnv = { ...process.env };
    process.env.VOCODER_API_KEY = 'vc_test_key';
  });

  afterEach(() => {
    process.env = originalEnv;

    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should use defaults when no config provided', async () => {
    const cliOptions: TranslateOptions = {};
    const merged = await getMergedConfig(cliOptions, false);

    expect(merged.extractionPattern).toEqual(['src/**/*.{tsx,jsx,ts,js}']);
    expect(merged.excludePattern).toEqual([]);
  });

  it('should prefer CLI flags over config file', async () => {
    const configPath = join(testDir, 'vocoder.config.json');
    writeFileSync(
      configPath,
      JSON.stringify({ include: 'from-file' })
    );

    const cliOptions: TranslateOptions = {
      include: ['from-cli'],
    };

    const merged = await getMergedConfig(cliOptions, false, testDir);

    expect(merged.extractionPattern).toEqual(['from-cli']);
    expect(merged.configSources.extractionPattern).toBe('CLI flag');
  });

  it('should use config file when no CLI flags provided', async () => {
    const configPath = join(testDir, 'vocoder.config.json');
    writeFileSync(
      configPath,
      JSON.stringify({
        include: ['src/**/*.tsx', 'components/**/*.tsx'],
        exclude: ['**/*.test.tsx'],
      })
    );

    const cliOptions: TranslateOptions = {};
    const merged = await getMergedConfig(cliOptions, false, testDir);

    expect(merged.extractionPattern).toEqual(['src/**/*.tsx', 'components/**/*.tsx']);
    expect(merged.excludePattern).toEqual(['**/*.test.tsx']);
    expect(merged.configSources.extractionPattern).toBe('config file');
  });

  it('should prefer config file over environment variables', async () => {
    process.env.VOCODER_EXTRACTION_PATTERN = 'from-env';

    const configPath = join(testDir, 'vocoder.config.json');
    writeFileSync(
      configPath,
      JSON.stringify({ include: 'from-file' })
    );

    const cliOptions: TranslateOptions = {};
    const merged = await getMergedConfig(cliOptions, false, testDir);

    expect(merged.extractionPattern).toEqual(['from-file']);
    expect(merged.configSources.extractionPattern).toBe('config file');
  });

  it('should use environment variable when no config file exists', async () => {
    process.env.VOCODER_EXTRACTION_PATTERN = 'from-env/**/*.tsx';

    const cliOptions: TranslateOptions = {};
    const merged = await getMergedConfig(cliOptions, false);

    expect(merged.extractionPattern).toEqual(['from-env/**/*.tsx']);
    expect(merged.configSources.extractionPattern).toBe('environment');
  });

  it('should support multiple CLI include flags', async () => {
    const cliOptions: TranslateOptions = {
      include: ['src/**/*.tsx', 'components/**/*.tsx', 'pages/**/*.tsx'],
    };

    const merged = await getMergedConfig(cliOptions, false);

    expect(merged.extractionPattern).toEqual([
      'src/**/*.tsx',
      'components/**/*.tsx',
      'pages/**/*.tsx',
    ]);
  });

  it('should support multiple exclude patterns', async () => {
    const cliOptions: TranslateOptions = {
      exclude: ['**/*.test.tsx', '**/__tests__/**', '**/*.stories.tsx'],
    };

    const merged = await getMergedConfig(cliOptions, false);

    expect(merged.excludePattern).toEqual([
      '**/*.test.tsx',
      '**/__tests__/**',
      '**/*.stories.tsx',
    ]);
  });

  it('should handle empty CLI arrays', async () => {
    const cliOptions: TranslateOptions = {
      include: [],
      exclude: [],
    };

    const merged = await getMergedConfig(cliOptions, false);

    expect(merged.extractionPattern).toEqual(['src/**/*.{tsx,jsx,ts,js}']);
    expect(merged.excludePattern).toEqual([]);
  });

  it('should handle mixed string and array patterns in config file', async () => {
    const configPath = join(testDir, 'vocoder.config.json');
    writeFileSync(
      configPath,
      JSON.stringify({
        include: 'single-pattern',
        exclude: ['exclude1', 'exclude2'],
      })
    );

    const cliOptions: TranslateOptions = {};
    const merged = await getMergedConfig(cliOptions, false, testDir);

    expect(merged.extractionPattern).toEqual(['single-pattern']);
    expect(merged.excludePattern).toEqual(['exclude1', 'exclude2']);
  });

  it('should merge API configuration from config file', async () => {
    const configPath = join(testDir, 'vocoder.config.json');
    writeFileSync(
      configPath,
      JSON.stringify({
        apiKey: 'vc_from_config',
        apiUrl: 'https://custom-api.vocoder.app',
      })
    );

    const cliOptions: TranslateOptions = {};
    const merged = await getMergedConfig(cliOptions, false, testDir);

    expect(merged.apiKey).toBe('vc_from_config');
    expect(merged.apiUrl).toBe('https://custom-api.vocoder.app');
  });

  it('should handle monorepo structure (config in root, run from subdirectory)', async () => {
    const rootDir = testDir;
    const appDir = join(rootDir, 'packages', 'app');
    mkdirSync(appDir, { recursive: true });

    const configPath = join(rootDir, 'vocoder.config.json');
    writeFileSync(
      configPath,
      JSON.stringify({ include: 'from-monorepo-root' })
    );

    const cliOptions: TranslateOptions = {};
    const merged = await getMergedConfig(cliOptions, false, appDir);

    expect(merged.extractionPattern).toEqual(['from-monorepo-root']);
    expect(merged.configSources.extractionPattern).toBe('config file');
  });

  it('should handle special characters in patterns', async () => {
    const configPath = join(testDir, 'vocoder.config.json');
    writeFileSync(
      configPath,
      JSON.stringify({
        include: ['src/**/*.{tsx,jsx}', '!(node_modules)/**/*.ts'],
        exclude: ['**/test?(s)/**'],
      })
    );

    const cliOptions: TranslateOptions = {};
    const merged = await getMergedConfig(cliOptions, false, testDir);

    expect(merged.extractionPattern).toEqual(['src/**/*.{tsx,jsx}', '!(node_modules)/**/*.ts']);
    expect(merged.excludePattern).toEqual(['**/test?(s)/**']);
  });

  it('should handle very long pattern arrays', async () => {
    const manyPatterns = Array.from({ length: 50 }, (_, i) => `pattern${i}/**/*.tsx`);

    const cliOptions: TranslateOptions = {
      include: manyPatterns,
    };

    const merged = await getMergedConfig(cliOptions, false);

    expect(merged.extractionPattern).toEqual(manyPatterns);
    expect(merged.extractionPattern.length).toBe(50);
  });

  it('should show config sources in verbose mode', async () => {
    const configPath = join(testDir, 'vocoder.config.json');
    writeFileSync(
      configPath,
      JSON.stringify({ include: 'from-file' })
    );

    const cliOptions: TranslateOptions = {};
    const merged = await getMergedConfig(cliOptions, true, testDir);

    expect(merged.configSources.extractionPattern).toBe('config file');
    expect(merged.configSources.apiUrl).toBe('default');
  });
});
