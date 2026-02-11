/**
 * Environment variable utilities
 * Platform-agnostic environment variable access
 */

/**
 * Get environment variable value
 * Works in Node.js/server environments and client-side (with bundler support)
 */
export const getEnvVar = (key: string): string | undefined => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
};
