import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { StringExtractor } from '../utils/extract.js';

describe('StringExtractor', () => {
  let tempDir: string;
  let extractor: StringExtractor;

  function createTestFile(filename: string, content: string): string {
    tempDir = mkdtempSync(join(tmpdir(), 'vocoder-test-'));
    const filePath = join(tempDir, filename);
    writeFileSync(filePath, content, 'utf-8');
    return filePath;
  }

  function cleanup() {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }

  beforeEach(() => {
    extractor = new StringExtractor();
  });

  afterEach(() => {
    cleanup();
  });

  describe('JSX <T> component extraction', () => {
    it('should extract simple text from <T> component', async () => {
      const file = createTestFile(
        'test.tsx',
        `
        import { T } from '@vocoder/react';

        function Component() {
          return <T>Hello world</T>;
        }
      `,
      );

      const result = await extractor.extractFromProject(file);

      expect(result).toHaveLength(1);
      expect(result[0]!.text).toBe('Hello world');
      expect(result[0]!.file).toBe(file);
    });

    it('should extract text with variables from <T> component', async () => {
      const file = createTestFile(
        'test.tsx',
        `
        import { T } from '@vocoder/react';

        function Component({ name }: { name: string }) {
          return <T>Hello {name}!</T>;
        }
      `,
      );

      const result = await extractor.extractFromProject(file);

      expect(result).toHaveLength(1);
      expect(result[0]!.text).toBe('Hello {name}!');
    });

    it('should extract context and formality from <T> component', async () => {
      const file = createTestFile(
        'test.tsx',
        `
        import { T } from '@vocoder/react';

        function Component() {
          return <T context="greeting" formality="formal">Welcome</T>;
        }
      `,
      );

      const result = await extractor.extractFromProject(file);

      expect(result).toHaveLength(1);
      expect(result[0]!.text).toBe('Welcome');
      expect(result[0]!.context).toBe('greeting');
      expect(result[0]!.formality).toBe('formal');
    });

    it('should handle aliased imports', async () => {
      const file = createTestFile(
        'test.tsx',
        `
        import { T as Translate } from '@vocoder/react';

        function Component() {
          return <Translate>Hello</Translate>;
        }
      `,
      );

      const result = await extractor.extractFromProject(file);

      expect(result).toHaveLength(1);
      expect(result[0]!.text).toBe('Hello');
    });
  });

  describe('t() function extraction', () => {
    it('should extract from direct t() import', async () => {
      const file = createTestFile(
        'test.ts',
        `
        import { t } from '@vocoder/react';

        const message = t('Hello world');
      `,
      );

      const result = await extractor.extractFromProject(file);

      expect(result).toHaveLength(1);
      expect(result[0]!.text).toBe('Hello world');
    });

    it('should extract from useVocoder hook', async () => {
      const file = createTestFile(
        'test.tsx',
        `
        import { useVocoder } from '@vocoder/react';

        function useMessages() {
          const { t } = useVocoder();

          return {
            welcome: t('Welcome back'),
            goodbye: t('See you soon'),
          };
        }
      `,
      );

      const result = await extractor.extractFromProject(file);

      expect(result).toHaveLength(2);
      expect(result.map((r: any) => r.text)).toContain('Welcome back');
      expect(result.map((r: any) => r.text)).toContain('See you soon');
    });

    it('should extract with template literals', async () => {
      const file = createTestFile(
        'test.ts',
        `
        import { t } from '@vocoder/react';

        function greet(name: string) {
          return t(\`Hello \${name}!\`);
        }
      `,
      );

      const result = await extractor.extractFromProject(file);

      expect(result).toHaveLength(1);
      expect(result[0]!.text).toBe('Hello {name}!');
    });

    it('should extract context and formality from options', async () => {
      const file = createTestFile(
        'test.ts',
        `
        import { t } from '@vocoder/react';

        const message = t('Welcome', {
          context: 'greeting',
          formality: 'formal'
        });
      `,
      );

      const result = await extractor.extractFromProject(file);

      expect(result).toHaveLength(1);
      expect(result[0]!.text).toBe('Welcome');
      expect(result[0]!.context).toBe('greeting');
      expect(result[0]!.formality).toBe('formal');
    });

    it('should extract from custom hooks', async () => {
      const file = createTestFile(
        'test.ts',
        `
        import { t } from '@vocoder/react';

        function useValidationMessages() {
          return {
            required: t('This field is required'),
            email: t('Invalid email address'),
            minLength: t('Must be at least 8 characters'),
          };
        }
      `,
      );

      const result = await extractor.extractFromProject(file);

      expect(result).toHaveLength(3);
      expect(result.map((r: any) => r.text)).toContain('This field is required');
      expect(result.map((r: any) => r.text)).toContain('Invalid email address');
      expect(result.map((r: any) => r.text)).toContain('Must be at least 8 characters');
    });

    it('should extract from utility functions', async () => {
      const file = createTestFile(
        'test.ts',
        `
        import { t } from '@vocoder/react';

        export function formatUserRole(role: string): string {
          const roles = {
            admin: t('Administrator'),
            user: t('User'),
            guest: t('Guest'),
          };
          return roles[role] || role;
        }
      `,
      );

      const result = await extractor.extractFromProject(file);

      expect(result).toHaveLength(3);
      expect(result.map((r: any) => r.text)).toContain('Administrator');
      expect(result.map((r: any) => r.text)).toContain('User');
      expect(result.map((r: any) => r.text)).toContain('Guest');
    });

    it('should handle aliased t function', async () => {
      const file = createTestFile(
        'test.ts',
        `
        import { t as translate } from '@vocoder/react';

        const message = translate('Hello');
      `,
      );

      const result = await extractor.extractFromProject(file);

      expect(result).toHaveLength(1);
      expect(result[0]!.text).toBe('Hello');
    });

    it('should handle renamed destructured t', async () => {
      const file = createTestFile(
        'test.tsx',
        `
        import { useVocoder } from '@vocoder/react';

        function useMessages() {
          const { t: translate } = useVocoder();

          return translate('Hello');
        }
      `,
      );

      const result = await extractor.extractFromProject(file);

      expect(result).toHaveLength(1);
      expect(result[0]!.text).toBe('Hello');
    });
  });

  describe('Mixed usage', () => {
    it('should extract from both <T> and t() in same file', async () => {
      const file = createTestFile(
        'test.tsx',
        `
        import { T, useVocoder } from '@vocoder/react';

        function Component() {
          const { t } = useVocoder();
          const title = t('Page Title');

          return (
            <div>
              <h1>{title}</h1>
              <T>Welcome to our site</T>
              <p>{t('This is a description')}</p>
            </div>
          );
        }
      `,
      );

      const result = await extractor.extractFromProject(file);

      expect(result).toHaveLength(3);
      expect(result.map((r: any) => r.text)).toContain('Page Title');
      expect(result.map((r: any) => r.text)).toContain('Welcome to our site');
      expect(result.map((r: any) => r.text)).toContain('This is a description');
    });
  });

  describe('Deduplication', () => {
    it('should deduplicate identical strings', async () => {
      const file = createTestFile(
        'test.tsx',
        `
        import { T, t } from '@vocoder/react';

        function Component() {
          const msg1 = t('Hello');
          const msg2 = t('Hello');

          return (
            <div>
              <T>Hello</T>
              <T>Hello</T>
            </div>
          );
        }
      `,
      );

      const result = await extractor.extractFromProject(file);

      // Should only have one "Hello" despite 4 occurrences
      expect(result).toHaveLength(1);
      expect(result[0]!.text).toBe('Hello');
    });

    it('should keep strings with different contexts separate', async () => {
      const file = createTestFile(
        'test.tsx',
        `
        import { t } from '@vocoder/react';

        const greeting = t('Welcome', { context: 'greeting' });
        const title = t('Welcome', { context: 'title' });
      `,
      );

      const result = await extractor.extractFromProject(file);

      // Should have two entries because contexts differ
      expect(result).toHaveLength(2);
      expect(result[0]!.context).not.toBe(result[1]!.context);
    });
  });

  describe('Edge cases', () => {
    it('should skip empty strings', async () => {
      const file = createTestFile(
        'test.tsx',
        `
        import { T, t } from '@vocoder/react';

        function Component() {
          const empty1 = t('');
          return <T></T>;
        }
      `,
      );

      const result = await extractor.extractFromProject(file);

      expect(result).toHaveLength(0);
    });

    it('should skip whitespace-only strings', async () => {
      const file = createTestFile(
        'test.tsx',
        `
        import { T, t } from '@vocoder/react';

        function Component() {
          const empty = t('   ');
          return <T>   </T>;
        }
      `,
      );

      const result = await extractor.extractFromProject(file);

      expect(result).toHaveLength(0);
    });

    it('should not extract from non-vocoder t functions', async () => {
      const file = createTestFile(
        'test.ts',
        `
        // Not imported from @vocoder/react
        function t(text: string) {
          return text;
        }

        const message = t('This should not be extracted');
      `,
      );

      const result = await extractor.extractFromProject(file);

      expect(result).toHaveLength(0);
    });
  });
});
