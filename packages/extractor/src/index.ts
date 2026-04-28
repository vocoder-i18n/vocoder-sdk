import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { parse } from '@babel/parser';
import babelTraverse from '@babel/traverse';
import { glob } from 'glob';
import { relative as pathRelative } from 'path';

// Handle default export difference between ESM and CommonJS
const traverse = (babelTraverse as any).default || babelTraverse;

export interface ExtractedString {
  key: string;
  text: string;
  file: string;
  line: number;
  context?: string;
  formality?: 'formal' | 'informal' | 'neutral' | 'auto';
}

export class StringExtractor {
  async extractFromProject(
    pattern: string | string[],
    projectRoot: string = process.cwd(),
    excludePattern?: string | string[],
  ): Promise<ExtractedString[]> {
    const includePatterns = Array.isArray(pattern) ? pattern : [pattern];

    const defaultIgnore = ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/build/**'];

    const ignorePatterns = excludePattern
      ? [...defaultIgnore, ...(Array.isArray(excludePattern) ? excludePattern : [excludePattern])]
      : defaultIgnore;

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

    const sortedFiles = Array.from(allFiles).sort();

    for (const file of sortedFiles) {
      try {
        const strings = await this.extractFromFile(file, projectRoot);
        allStrings.push(...strings);
      } catch (error) {
        console.warn(`Warning: Failed to extract from ${file}:`, error);
      }
    }

    return this.deduplicateStrings(allStrings);
  }

  private async extractFromFile(
    filePath: string,
    projectRoot: string,
  ): Promise<ExtractedString[]> {
    const code = readFileSync(filePath, 'utf-8');
    const strings: ExtractedString[] = [];
    const relativeFilePath = pathRelative(projectRoot, filePath).split('\\').join('/');

    try {
      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      const vocoderImports = new Map<string, string>();
      const tFunctionNames = new Set<string>();

      traverse(ast, {
        ImportDeclaration: (path: any) => {
          const source = path.node.source.value;

          if (source === '@vocoder/react') {
            path.node.specifiers.forEach((spec: any) => {
              if (spec.type === 'ImportSpecifier') {
                const imported =
                  spec.imported.type === 'Identifier'
                    ? spec.imported.name
                    : null;
                const local = spec.local.name;

                if (imported === 'T') {
                  vocoderImports.set(local, 'T');
                }
                if (imported === 't') {
                  tFunctionNames.add(local);
                }
              }
            });
          }
        },

        VariableDeclarator: (path: any) => {
          const init = path.node.init;

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

        CallExpression: (path: any) => {
          const callee = path.node.callee;

          const isTFunction =
            callee.type === 'Identifier' && tFunctionNames.has(callee.name);

          if (!isTFunction) return;

          const firstArg = path.node.arguments[0];
          if (!firstArg) return;

          let text: string | null = null;

          if (firstArg.type === 'StringLiteral') {
            text = firstArg.value;
          } else if (firstArg.type === 'TemplateLiteral') {
            text = this.extractTemplateText(firstArg);
          }

          if (!text || text.trim().length === 0) return;

          const secondArg = path.node.arguments[1];
          let context: string | undefined;
          let formality: 'formal' | 'informal' | 'neutral' | 'auto' | undefined;
          let explicitKey: string | undefined;

          if (secondArg && secondArg.type === 'ObjectExpression') {
            secondArg.properties.forEach((prop: any) => {
              if (prop.type === 'ObjectProperty' && prop.key.type === 'Identifier') {
                if (prop.key.name === 'context' && prop.value.type === 'StringLiteral') {
                  context = prop.value.value;
                }
                if (prop.key.name === 'formality' && prop.value.type === 'StringLiteral') {
                  formality = prop.value.value as 'formal' | 'informal' | 'neutral' | 'auto';
                }
                if (prop.key.name === 'id' && prop.value.type === 'StringLiteral') {
                  explicitKey = prop.value.value.trim();
                }
              }
            });
          }

          const line = path.node.loc?.start.line || 0;
          const column = path.node.loc?.start.column || 0;
          const key = explicitKey && explicitKey.length > 0
            ? explicitKey
            : this.generateStableKey({
                filePath: relativeFilePath,
                kind: 't-call',
                line,
                column,
              });

          strings.push({
            key,
            text: text.trim(),
            file: filePath,
            line,
            context,
            formality,
          });
        },

        JSXElement: (path: any) => {
          const opening = path.node.openingElement;
          const tagName =
            opening.name.type === 'JSXIdentifier'
              ? opening.name.name
              : null;

          if (!tagName) return;

          const isTranslationComponent = vocoderImports.has(tagName);

          if (!isTranslationComponent) return;

          const msgAttribute = this.getStringAttribute(opening.attributes, 'msg');

          const text = msgAttribute || this.extractTextContent(path.node.children);

          if (!text || text.trim().length === 0) return;

          const id = this.getStringAttribute(opening.attributes, 'id');
          const context = this.getStringAttribute(opening.attributes, 'context');
          const formality = this.getStringAttribute(
            opening.attributes,
            'formality',
          ) as 'formal' | 'informal' | 'neutral' | 'auto' | undefined;
          const line = path.node.loc?.start.line || 0;
          const column = path.node.loc?.start.column || 0;
          const key = id && id.trim().length > 0
            ? id.trim()
            : this.generateStableKey({
                filePath: relativeFilePath,
                kind: 'jsx',
                line,
                column,
              });

          strings.push({
            key,
            text: text.trim(),
            file: filePath,
            line,
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

  private extractTemplateText(node: any): string {
    let text = '';

    for (let i = 0; i < node.quasis.length; i++) {
      const quasi = node.quasis[i];
      text += quasi.value.raw;

      if (i < node.expressions.length) {
        const expr = node.expressions[i];
        if (expr.type === 'Identifier') {
          text += `{${expr.name}}`;
        } else {
          text += '{value}';
        }
      }
    }

    return text;
  }

  private extractTextContent(children: any[]): string {
    let text = '';

    for (const child of children) {
      if (child.type === 'JSXText') {
        text += child.value;
      } else if (child.type === 'JSXExpressionContainer') {
        const expr = child.expression;

        if (expr.type === 'Identifier') {
          text += `{${expr.name}}`;
        } else if (expr.type === 'StringLiteral') {
          text += expr.value;
        } else if (expr.type === 'TemplateLiteral') {
          text += this.extractTemplateText(expr);
        }
      }
    }

    return text;
  }

  private getStringAttribute(
    attributes: any[],
    name: string,
  ): string | undefined {
    const attr = attributes.find(
      (a) => a.type === 'JSXAttribute' && a.name.name === name,
    );

    if (!attr || !attr.value) return undefined;

    if (attr.value.type === 'StringLiteral') {
      return attr.value.value;
    }

    if (attr.value.type === 'JSXExpressionContainer') {
      const expr = attr.value.expression;

      if (expr.type === 'TemplateLiteral') {
        return this.extractTemplateText(expr);
      }

      if (expr.type === 'StringLiteral') {
        return expr.value;
      }
    }

    return undefined;
  }

  private deduplicateStrings(strings: ExtractedString[]): ExtractedString[] {
    const seen = new Map<string, number>();
    const unique: ExtractedString[] = [];

    for (const str of strings) {
      const dedupeKey = `${str.text}|${str.context || ''}|${str.formality || ''}`;

      const existingIndex = seen.get(dedupeKey);
      if (existingIndex === undefined) {
        seen.set(dedupeKey, unique.length);
        unique.push(str);
        continue;
      }

      const existing = unique[existingIndex];
      if (existing && str.key < existing.key) {
        existing.key = str.key;
      }
    }

    return unique;
  }

  private generateStableKey(params: {
    filePath: string;
    kind: 'jsx' | 't-call';
    line: number;
    column: number;
  }): string {
    const payload = `${params.filePath}|${params.kind}|${params.line}:${params.column}`;
    const digest = createHash('sha1').update(payload).digest('hex');
    return `SK_${digest.slice(0, 24).toUpperCase()}`;
  }
}
