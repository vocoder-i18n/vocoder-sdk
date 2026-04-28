import { unplugin } from './index';
import type { VocoderPluginOptions } from './types';
import { loadEnvFile } from './core';

export type { VocoderPluginOptions };

/**
 * Wrap a Next.js config to inject the Vocoder webpack plugin.
 * Also injects API URL via Next.js `env` config so the value is available
 * in both webpack and Turbopack builds on server and client.
 *
 * Usage:
 * ```js
 * const { withVocoder } = require('@vocoder/unplugin/next');
 * module.exports = withVocoder(nextConfig);
 * ```
 */
export function withVocoder(
  nextConfig: Record<string, unknown> = {},
  pluginOptions: VocoderPluginOptions = {},
): Record<string, unknown> {
  loadEnvFile();

  const apiUrl = process.env.VOCODER_API_URL ?? 'https://vocoder.app';

  // Fingerprint is computed asynchronously in the webpack plugin's buildStart hook.
  // If VOCODER_FINGERPRINT is set (manual override), pass it through to env for Turbopack.
  const fingerprintOverride = process.env.VOCODER_FINGERPRINT;

  const vocoderPlugin = unplugin.webpack(pluginOptions);

  return {
    ...nextConfig,
    env: {
      ...(nextConfig.env as Record<string, string> | undefined),
      VOCODER_API_URL: apiUrl,
      VOCODER_BUILD_TS: String(Date.now()),
      ...(fingerprintOverride ? { VOCODER_FINGERPRINT: fingerprintOverride } : {}),
    },
    webpack(config: Record<string, unknown>, webpackOptions: Record<string, unknown>) {
      const plugins = (config.plugins ?? []) as unknown[];
      plugins.push(vocoderPlugin);

      // Webpack doesn't support the virtual: URI scheme natively.
      // Use NormalModuleReplacementPlugin to strip the "virtual:" prefix
      // so unplugin's resolveId/load hooks can intercept the requests.
      try {
        const webpack = require('webpack');
        plugins.push(
          new webpack.NormalModuleReplacementPlugin(
            /^virtual:vocoder\//,
            (resource: { request: string }) => {
              resource.request = resource.request.replace(/^virtual:/, '');
            },
          ),
        );
      } catch {
        // webpack not available
      }

      config.plugins = plugins;

      const userWebpack = nextConfig.webpack as
        | ((c: Record<string, unknown>, o: Record<string, unknown>) => Record<string, unknown>)
        | undefined;
      if (typeof userWebpack === 'function') {
        return userWebpack(config, webpackOptions);
      }

      return config;
    },
  };
}
