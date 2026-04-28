import type { DetectedEcosystem, DetectedFramework } from './detect-local.js';

export interface SetupSnippets {
  pluginStep: { file: string; code: string } | null;
  providerStep: { file: string; code: string } | null;
  wrapStep: { code: string };
  whatsNext: string;
}

/**
 * Generate framework-specific setup snippets.
 */
export function getSetupSnippets(params: {
  framework: DetectedFramework;
  ecosystem: DetectedEcosystem;
  sourceLocale: string;
  targetBranches: string[];
}): SetupSnippets {
  const { framework, ecosystem, sourceLocale } = params;

  return {
    pluginStep: getPluginSnippet(framework, ecosystem),
    providerStep: getProviderSnippet(ecosystem, sourceLocale),
    wrapStep: getWrapSnippet(ecosystem),
    whatsNext: 'Push to a target branch to trigger translations.',
  };
}

function getPluginSnippet(
  framework: DetectedFramework,
  ecosystem: DetectedEcosystem,
): { file: string; code: string } | null {
  switch (framework) {
    case 'nextjs':
      return {
        file: 'next.config.ts',
        code: `import { withVocoder } from '@vocoder/unplugin/next';

export default withVocoder({
  // your existing Next.js config
});`,
      };

    case 'vite':
    case 'remix':
      return {
        file: 'vite.config.ts',
        code: `import vocoder from '@vocoder/unplugin/vite';

export default defineConfig({
  plugins: [
    vocoder(),
    // your other plugins
  ],
});`,
      };

    case 'nuxt':
      return {
        file: 'nuxt.config.ts',
        code: `import vocoder from '@vocoder/unplugin/vite';

export default defineNuxtConfig({
  vite: {
    plugins: [vocoder()],
  },
});`,
      };

    case 'sveltekit':
      return {
        file: 'vite.config.ts',
        code: `import vocoder from '@vocoder/unplugin/vite';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [
    sveltekit(),
    vocoder(),
  ],
});`,
      };

    case 'gatsby':
      return {
        file: 'gatsby-node.js',
        code: `const vocoder = require('@vocoder/unplugin/webpack');

exports.onCreateWebpackConfig = ({ actions }) => {
  actions.setWebpackConfig({
    plugins: [vocoder()],
  });
};`,
      };

    case 'angular':
      return null; // Angular CLI doesn't expose plugin config easily

    default:
      // No known framework — if they have React/Vue/Svelte, they likely have a bundler
      // but we can't guess which config file. Give generic advice.
      if (ecosystem) {
        return {
          file: 'your bundler config',
          code: `// Vite
import vocoder from '@vocoder/unplugin/vite';
// Webpack
const vocoder = require('@vocoder/unplugin/webpack');

// Add vocoder() to your plugins array`,
        };
      }
      return null;
  }
}

function getProviderSnippet(
  ecosystem: DetectedEcosystem,
  sourceLocale: string,
): { file: string; code: string } | null {
  switch (ecosystem) {
    case 'react':
      return {
        file: 'your root layout or App component',
        code: `import { VocoderProvider } from '@vocoder/react';

<VocoderProvider defaultLocale="${sourceLocale}">
  {children}
</VocoderProvider>`,
      };

    case 'vue':
      return {
        file: 'your app entry',
        code: `import { createVocoder } from '@vocoder/vue';

const vocoder = createVocoder({
  defaultLocale: '${sourceLocale}',
});

app.use(vocoder);`,
      };

    case 'svelte':
      return {
        file: 'your root layout',
        code: `<script>
  import { VocoderProvider } from '@vocoder/svelte';
</script>

<VocoderProvider defaultLocale="${sourceLocale}">
  <slot />
</VocoderProvider>`,
      };

    default:
      return null;
  }
}

function getWrapSnippet(ecosystem: DetectedEcosystem): { code: string } {
  switch (ecosystem) {
    case 'react':
      return {
        code: `import { T } from '@vocoder/react';

<T>Hello, world!</T>`,
      };

    case 'vue':
      return {
        code: `<template>
  <T>Hello, world!</T>
</template>

<script setup>
import { T } from '@vocoder/vue';
</script>`,
      };

    case 'svelte':
      return {
        code: `<script>
  import { T } from '@vocoder/svelte';
</script>

<T>Hello, world!</T>`,
      };

    default:
      return {
        code: `// Wrap translatable strings with <T>
<T>Hello, world!</T>`,
      };
  }
}

