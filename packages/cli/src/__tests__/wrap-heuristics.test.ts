import { describe, it, expect } from 'vitest';
import { classifyString, isTranslatableVarName } from '../utils/wrap/heuristics.js';

describe('classifyString', () => {
  describe('skip rules (never translate)', () => {
    it('skips empty strings', () => {
      const result = classifyString('', 'string-literal');
      expect(result.translatable).toBe(false);
    });

    it('skips whitespace-only strings', () => {
      const result = classifyString('   ', 'string-literal');
      expect(result.translatable).toBe(false);
    });

    it('skips single characters', () => {
      const result = classifyString('x', 'string-literal');
      expect(result.translatable).toBe(false);
    });

    it('skips punctuation-only strings', () => {
      const result = classifyString('...', 'string-literal');
      expect(result.translatable).toBe(false);
    });

    it('skips URLs', () => {
      expect(classifyString('https://example.com', 'string-literal').translatable).toBe(false);
      expect(classifyString('http://localhost:3000', 'string-literal').translatable).toBe(false);
      expect(classifyString('mailto:user@example.com', 'string-literal').translatable).toBe(false);
    });

    it('skips email addresses', () => {
      const result = classifyString('user@example.com', 'string-literal');
      expect(result.translatable).toBe(false);
    });

    it('skips file paths', () => {
      expect(classifyString('./components/Button', 'string-literal').translatable).toBe(false);
      expect(classifyString('../utils/helpers', 'string-literal').translatable).toBe(false);
      expect(classifyString('/api/users', 'string-literal').translatable).toBe(false);
    });

    it('skips color hex codes', () => {
      expect(classifyString('#fff', 'string-literal').translatable).toBe(false);
      expect(classifyString('#ff0000', 'string-literal').translatable).toBe(false);
      expect(classifyString('#rgba1234', 'string-literal').translatable).toBe(false);
    });

    it('skips color functions', () => {
      expect(classifyString('rgb(255, 0, 0)', 'string-literal').translatable).toBe(false);
      expect(classifyString('rgba(0, 0, 0, 0.5)', 'string-literal').translatable).toBe(false);
    });

    it('skips CSS unit values', () => {
      expect(classifyString('16px', 'string-literal').translatable).toBe(false);
      expect(classifyString('1.5rem', 'string-literal').translatable).toBe(false);
      expect(classifyString('100%', 'string-literal').translatable).toBe(false);
    });

    it('skips MIME types', () => {
      expect(classifyString('application/json', 'string-literal').translatable).toBe(false);
      expect(classifyString('text/html', 'string-literal').translatable).toBe(false);
    });

    it('skips camelCase identifiers', () => {
      expect(classifyString('myVariable', 'string-literal').translatable).toBe(false);
      expect(classifyString('getUserData', 'string-literal').translatable).toBe(false);
    });

    it('skips PascalCase identifiers', () => {
      expect(classifyString('MyComponent', 'string-literal').translatable).toBe(false);
      expect(classifyString('UserProfile', 'string-literal').translatable).toBe(false);
    });

    it('skips SCREAMING_SNAKE_CASE identifiers', () => {
      expect(classifyString('API_KEY', 'string-literal').translatable).toBe(false);
      expect(classifyString('MAX_RETRIES', 'string-literal').translatable).toBe(false);
    });

    it('skips kebab-case identifiers', () => {
      expect(classifyString('my-component', 'string-literal').translatable).toBe(false);
      expect(classifyString('user-profile', 'string-literal').translatable).toBe(false);
    });

    it('skips Tailwind CSS classes', () => {
      const result = classifyString('flex items-center p-4', 'jsx-attribute', {
        attributeName: 'className',
      });
      expect(result.translatable).toBe(false);
    });

    it('skips non-translatable attributes', () => {
      expect(classifyString('my-class', 'jsx-attribute', { attributeName: 'className' }).translatable).toBe(false);
      expect(classifyString('/about', 'jsx-attribute', { attributeName: 'href' }).translatable).toBe(false);
      expect(classifyString('logo.png', 'jsx-attribute', { attributeName: 'src' }).translatable).toBe(false);
      expect(classifyString('main-content', 'jsx-attribute', { attributeName: 'id' }).translatable).toBe(false);
    });

    it('skips data-* attributes', () => {
      const result = classifyString('test-value', 'jsx-attribute', {
        attributeName: 'data-testid',
      });
      expect(result.translatable).toBe(false);
    });

    it('skips strings inside console.log', () => {
      const result = classifyString('Debug message here', 'string-literal', {
        isInsideCallExpression: 'console.log',
      });
      expect(result.translatable).toBe(false);
    });

    it('skips error messages in throw', () => {
      const result = classifyString('Something went wrong', 'string-literal', {
        isInsideCallExpression: 'Error',
      });
      expect(result.translatable).toBe(false);
    });
  });

  describe('high confidence (auto-wrap)', () => {
    it('detects JSX text with words', () => {
      const result = classifyString('Welcome to our app', 'jsx-text');
      expect(result.translatable).toBe(true);
      expect(result.confidence).toBe('high');
    });

    it('detects translatable attributes - placeholder', () => {
      const result = classifyString('Enter your name', 'jsx-attribute', {
        attributeName: 'placeholder',
      });
      expect(result.translatable).toBe(true);
      expect(result.confidence).toBe('high');
    });

    it('detects translatable attributes - title', () => {
      const result = classifyString('Close dialog', 'jsx-attribute', {
        attributeName: 'title',
      });
      expect(result.translatable).toBe(true);
      expect(result.confidence).toBe('high');
    });

    it('detects translatable attributes - alt', () => {
      const result = classifyString('Company logo', 'jsx-attribute', {
        attributeName: 'alt',
      });
      expect(result.translatable).toBe(true);
      expect(result.confidence).toBe('high');
    });

    it('detects translatable attributes - aria-label', () => {
      const result = classifyString('Navigation menu', 'jsx-attribute', {
        attributeName: 'aria-label',
      });
      expect(result.translatable).toBe(true);
      expect(result.confidence).toBe('high');
    });
  });

  describe('medium confidence', () => {
    it('detects multi-word strings', () => {
      const result = classifyString('Click here to continue', 'string-literal');
      expect(result.translatable).toBe(true);
      expect(result.confidence).toBe('medium');
    });

    it('detects strings in variable declarations', () => {
      const result = classifyString('Something happened', 'string-literal', {
        parentType: 'VariableDeclarator',
      });
      expect(result.translatable).toBe(true);
    });
  });

  describe('low confidence', () => {
    it('detects two-word strings as low confidence', () => {
      const result = classifyString('Sign in', 'string-literal');
      expect(result.translatable).toBe(true);
      expect(result.confidence).toBe('low');
    });
  });
});

describe('isTranslatableVarName', () => {
  it('returns true for common translatable variable names', () => {
    expect(isTranslatableVarName('label')).toBe(true);
    expect(isTranslatableVarName('message')).toBe(true);
    expect(isTranslatableVarName('errorMessage')).toBe(true);
    expect(isTranslatableVarName('title')).toBe(true);
    expect(isTranslatableVarName('placeholder')).toBe(true);
    expect(isTranslatableVarName('buttonText')).toBe(true);
  });

  it('returns false for non-translatable variable names', () => {
    expect(isTranslatableVarName('url')).toBe(false);
    expect(isTranslatableVarName('count')).toBe(false);
    expect(isTranslatableVarName('id')).toBe(false);
    expect(isTranslatableVarName('data')).toBe(false);
  });
});
