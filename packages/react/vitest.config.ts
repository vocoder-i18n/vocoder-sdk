import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@vocoder/generated/manifest': path.resolve(__dirname, 'test/fixtures/generated-manifest.ts'),
      '@vocoder/generated/manifest.cjs': path.resolve(__dirname, 'test/fixtures/generated-manifest.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
