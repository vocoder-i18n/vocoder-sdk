import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getMergedConfig } from '../utils/config.js';
import type { TranslateOptions } from '../types.js';

describe('Config Merging', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.VOCODER_API_KEY = 'vc_test_key';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should use defaults when no config provided', async () => {
    const cliOptions: TranslateOptions = {};
    const merged = await getMergedConfig(cliOptions, false);

    expect(merged.extractionPattern).toEqual(['src/**/*.{tsx,jsx,ts,js}']);
    expect(merged.excludePattern).toEqual([]);
  });

  it('should use environment variable when provided', async () => {
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
    const cliOptions: TranslateOptions = {};
    const merged = await getMergedConfig(cliOptions, true);

    expect(merged.configSources.extractionPattern).toBe('default');
    expect(merged.configSources.apiUrl).toBe('default');
  });
});
