import { readFileSync } from 'fs';
import { parse } from '@babel/parser';
import babelTraverse from '@babel/traverse';
import { glob } from 'glob';
import type { ExtractedString } from '../types.js';

// Handle default export difference between ESM and CommonJS
const traverse = (babelTraverse as any).default || babelTraverse;

/**
 * Extract translatable strings from source files
 *
 * NOTE: This is a simplified version for the CLI MVP.
 * Eventually this logic should be moved to a shared @vocoder/extraction package
 * that can be used by both the CLI and the backend.
 */
export class StringExtractor {
  /**
   * Extract strings from all files matching the pattern(s)
   *
   * @param pattern - Glob pattern(s) to include
   * @param projectRoot - Project root directory
   * @param excludePattern - Glob pattern(s) to exclude (optional)
   */
  async extractFromProject(
    pattern: string | string[],
    projectRoot: string = process.cwd(),
    excludePattern?: string | string[],
  ): Promise<ExtractedString[]> {
    // Normalize patterns to arrays
    const includePatterns = Array.isArray(pattern) ? pattern : [pattern];

    // Default ignore patterns (always excluded)
    const defaultIgnore = ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/build/**'];

    // Merge user exclude patterns with defaults
    const ignorePatterns = excludePattern
      ? [...defaultIgnore, ...(Array.isArray(excludePattern) ? excludePattern : [excludePattern])]
      : defaultIgnore;

    // Find all files matching any of the include patterns (OR behavior)
    const allFiles = new Set<string>();

    for (const includePattern of includePatterns) {
      const files = await glob(includePattern, {
        cwd: projectRoot,
        absolute: true,
        ignore: ignorePatterns,
      });

      files.forEach((file: string) => allFiles.add(file));
    }

    const allStrings: ExtractedString[] = [];

    // Extract from each file
    for (const file of allFiles) {
      try {
        const strings = await this.extractFromFile(file);
        allStrings.push(...strings);
      } catch (error) {
        console.warn(`Warning: Failed to extract from ${file}:`, error);
      }
    }

    // Deduplicate strings (same text = one entry)
    const unique = this.deduplicateStrings(allStrings);

    return unique;
  }

  /**
   * Extract strings from a single file
   */
  private async extractFromFile(filePath: string): Promise<ExtractedString[]> {
    const code = readFileSync(filePath, 'utf-8');
    const strings: ExtractedString[] = [];

    try {
      // Parse the code
      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      // Track imports from @vocoder/react
      const vocoderImports = new Map<string, string>();
      const tFunctionNames = new Set<string>(); // Track 't' function names

      // Traverse the AST
      traverse(ast, {
        // Track imports of <T> component and t function
        ImportDeclaration: (path) => {
          const source = path.node.source.value;

          if (source === '@vocoder/react') {
            path.node.specifiers.forEach((spec) => {
              if (spec.type === 'ImportSpecifier') {
                const imported =
                  spec.imported.type === 'Identifier'
                    ? spec.imported.name
                    : null;
                const local = spec.local.name;

                if (imported === 'T') {
                  vocoderImports.set(local, 'T');
                }
                // Track direct import of 't' function
                if (imported === 't') {
                  tFunctionNames.add(local);
                }
                // Track useVocoder hook (which provides 't')
                if (imported === 'useVocoder') {
                  // We'll track destructured 't' in VariableDeclarator
                }
              }
            });
          }
        },

        // Track destructured 't' from useVocoder hook
        VariableDeclarator: (path) => {
          const init = path.node.init;

          // Check if this is: const { t } = useVocoder()
          if (
            init &&
            init.type === 'CallExpression' &&
            init.callee.type === 'Identifier' &&
            init.callee.name === 'useVocoder' &&
            path.node.id.type === 'ObjectPattern'
          ) {
            path.node.id.properties.forEach((prop: any) => {
              if (
                prop.type === 'ObjectProperty' &&
                prop.key.type === 'Identifier' &&
                prop.key.name === 't'
              ) {
                const localName =
                  prop.value.type === 'Identifier' ? prop.value.name : 't';
                tFunctionNames.add(localName);
              }
            });
          }
        },

        // Extract from t() function calls
        CallExpression: (path) => {
          const callee = path.node.callee;

          // Check if this is a call to 't' function
          const isTFunction =
            callee.type === 'Identifier' && tFunctionNames.has(callee.name);

          if (!isTFunction) return;

          // Get the first argument (the string to translate)
          const firstArg = path.node.arguments[0];
          if (!firstArg) return;

          let text: string | null = null;

          // Handle string literal: t('Hello')
          if (firstArg.type === 'StringLiteral') {
            text = firstArg.value;
          }
          // Handle template literal: t(`Hello ${name}`)
          else if (firstArg.type === 'TemplateLiteral') {
            text = this.extractTemplateText(firstArg);
          }

          if (!text || text.trim().length === 0) return;

          // Get options from second argument
          const secondArg = path.node.arguments[1];
          let context: string | undefined;
          let formality: 'formal' | 'informal' | 'auto' | undefined;

          if (secondArg && secondArg.type === 'ObjectExpression') {
            secondArg.properties.forEach((prop: any) => {
              if (prop.type === 'ObjectProperty' && prop.key.type === 'Identifier') {
                if (prop.key.name === 'context' && prop.value.type === 'StringLiteral') {
                  context = prop.value.value;
                }
                if (prop.key.name === 'formality' && prop.value.type === 'StringLiteral') {
                  formality = prop.value.value as 'formal' | 'informal' | 'auto';
                }
              }
            });
          }

          strings.push({
            text: text.trim(),
            file: filePath,
            line: path.node.loc?.start.line || 0,
            context,
            formality,
          });
        },

        // Extract from JSX elements
        JSXElement: (path) => {
          const opening = path.node.openingElement;
          const tagName =
            opening.name.type === 'JSXIdentifier'
              ? opening.name.name
              : null;

          if (!tagName) return;

          // Check if this is a <T> component (or aliased import)
          const isTranslationComponent = vocoderImports.has(tagName);

          if (!isTranslationComponent) return;

          // Check for msg attribute first (preferred for ICU messages)
          const msgAttribute = this.getStringAttribute(opening.attributes, 'msg');

          // Extract text - prefer msg attribute over children
          const text = msgAttribute || this.extractTextContent(path.node.children);

          if (!text || text.trim().length === 0) return;

          // Extract context and formality from props
          const context = this.getStringAttribute(opening.attributes, 'context');
          const formality = this.getStringAttribute(
            opening.attributes,
            'formality',
          ) as 'formal' | 'informal' | 'auto' | undefined;

          strings.push({
            text: text.trim(),
            file: filePath,
            line: path.node.loc?.start.line || 0,
            context,
            formality,
          });
        },
      });
    } catch (error) {
      throw new Error(
        `Failed to parse ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    return strings;
  }

  /**
   * Extract text from template literal
   * Converts template literals like `Hello ${name}` to `Hello {name}`
   */
  private extractTemplateText(node: any): string {
    let text = '';

    for (let i = 0; i < node.quasis.length; i++) {
      const quasi = node.quasis[i];
      text += quasi.value.raw;

      // Add placeholder for expressions
      if (i < node.expressions.length) {
        const expr = node.expressions[i];
        if (expr.type === 'Identifier') {
          text += `{${expr.name}}`;
        } else {
          // For complex expressions, use generic placeholder
          text += '{value}';
        }
      }
    }

    return text;
  }

  /**
   * Extract text content from JSX children
   */
  private extractTextContent(children: any[]): string {
    let text = '';

    for (const child of children) {
      if (child.type === 'JSXText') {
        text += child.value;
      } else if (child.type === 'JSXExpressionContainer') {
        const expr = child.expression;

        // Handle {variableName} - actual identifier
        if (expr.type === 'Identifier') {
          text += `{${expr.name}}`;
        }
        // Handle {"{variableName}"} - string literal placeholder
        else if (expr.type === 'StringLiteral') {
          text += expr.value;
        }
        // Handle {`${variableName}`} - template literal
        // Convert template literal syntax to ICU MessageFormat: `$${price}` → ${price}
        else if (expr.type === 'TemplateLiteral') {
          text += this.extractTemplateText(expr);
        }
      }
    }

    return text;
  }

  /**
   * Get string value from JSX attribute
   * Handles both string literals and template literals
   */
  private getStringAttribute(
    attributes: any[],
    name: string,
  ): string | undefined {
    const attr = attributes.find(
      (a) => a.type === 'JSXAttribute' && a.name.name === name,
    );

    if (!attr || !attr.value) return undefined;

    // Handle string literal: msg="Hello"
    if (attr.value.type === 'StringLiteral') {
      return attr.value.value;
    }

    // Handle JSX expression container: msg={...}
    if (attr.value.type === 'JSXExpressionContainer') {
      const expr = attr.value.expression;

      // Handle template literal: msg={`Hello ${name}`}
      if (expr.type === 'TemplateLiteral') {
        return this.extractTemplateText(expr);
      }

      // Handle string literal in expression: msg={'Hello'}
      if (expr.type === 'StringLiteral') {
        return expr.value;
      }
    }

    return undefined;
  }

  /**
   * Deduplicate strings (keep first occurrence)
   */
  private deduplicateStrings(strings: ExtractedString[]): ExtractedString[] {
    const seen = new Set<string>();
    const unique: ExtractedString[] = [];

    for (const str of strings) {
      // Create a key based on text + context + formality
      const key = `${str.text}|${str.context || ''}|${str.formality || ''}`;

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(str);
      }
    }

    return unique;
  }
}
