import type { LocalConfig } from '../types.js';
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
