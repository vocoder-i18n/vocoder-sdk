import { unplugin } from './index';
import type { VocoderPluginOptions } from './types';

export type { VocoderPluginOptions };

/**
 * Wrap a Next.js config to inject the Vocoder webpack plugin.
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
  const vocoderPlugin = unplugin.webpack(pluginOptions);

  return {
    ...nextConfig,
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
              // Strip "virtual:" so it becomes "vocoder/manifest" etc.
              // The unplugin resolveId hook will match and resolve it.
              resource.request = resource.request.replace(/^virtual:/, '');
            },
          ),
        );
      } catch {
        // webpack not available
      }

      config.plugins = plugins;

      // Call the user's webpack config if they have one
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
