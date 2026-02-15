/**
 * AST analyzer that traverses source files to find
 * strings that should be wrapped for translation.
 */

import { readFileSync } from 'fs';
import { parse } from '@babel/parser';
import babelTraverse from '@babel/traverse';
import type { Node } from '@babel/types';
import { glob } from 'glob';
import { classifyString, isTranslatableVarName } from './heuristics.js';
import type { FrameworkAdapter, WrapCandidate, WrapOptions, StringContext } from './types.js';

// Handle default export difference between ESM and CommonJS
const traverse = (babelTraverse as any).default || babelTraverse;

export class StringAnalyzer {
  private adapter: FrameworkAdapter;

  constructor(adapter: FrameworkAdapter) {
    this.adapter = adapter;
  }

  /**
   * Analyze all files matching the given patterns and return wrap candidates.
   */
  async analyzeProject(
    options: WrapOptions,
    projectRoot: string = process.cwd(),
  ): Promise<WrapCandidate[]> {
    const includePatterns = options.include?.length
      ? options.include
      : ['src/**/*.{tsx,jsx,ts,js}'];

    const defaultIgnore = [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      '**/*.test.*',
      '**/*.spec.*',
      '**/*.stories.*',
      '**/__tests__/**',
    ];

    const ignorePatterns = options.exclude
      ? [...defaultIgnore, ...options.exclude]
      : defaultIgnore;

    const allFiles = new Set<string>();

    for (const pattern of includePatterns) {
      const files = await glob(pattern, {
        cwd: projectRoot,
        absolute: true,
        ignore: ignorePatterns,
      });
      files.forEach((file: string) => allFiles.add(file));
    }

    const allCandidates: WrapCandidate[] = [];

    for (const file of allFiles) {
      try {
        const candidates = this.analyzeFile(file);
        allCandidates.push(...candidates);
      } catch (error: unknown) {
        if (options.verbose) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          console.warn(`Warning: Failed to analyze ${file}: ${msg}`);
        }
      }
    }

    return allCandidates;
  }

  /**
   * Analyze a single file and return wrap candidates.
   */
  analyzeFile(filePath: string): WrapCandidate[] {
    const code = readFileSync(filePath, 'utf-8');
    return this.analyzeCode(code, filePath);
  }

  /**
   * Analyze source code and return wrap candidates.
   */
  analyzeCode(code: string, filePath: string = '<input>'): WrapCandidate[] {
    const candidates: WrapCandidate[] = [];

    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    // Track existing vocoder imports
    const vocoderImports = new Map<string, string>();
    const tFunctionNames = new Set<string>();

    traverse(ast, {
      // Track imports from @vocoder/react
      ImportDeclaration: (path: any) => {
        const source = path.node.source.value as string;
        if (source === this.adapter.importSource) {
          path.node.specifiers.forEach((spec: any) => {
            if (spec.type === 'ImportSpecifier') {
              const imported =
                spec.imported.type === 'Identifier' ? spec.imported.name : null;
              const local = spec.local.name as string;

              if (imported === this.adapter.componentName) {
                vocoderImports.set(local, this.adapter.componentName);
              }
              if (imported === this.adapter.functionName) {
                tFunctionNames.add(local);
              }
              if (imported === this.adapter.hookName) {
                vocoderImports.set(local, this.adapter.hookName);
              }
            }
          });
        }
      },

      // Track destructured t from useVocoder()
      VariableDeclarator: (path: any) => {
        const init = path.node.init;
        if (
          init &&
          init.type === 'CallExpression' &&
          init.callee.type === 'Identifier' &&
          init.callee.name === this.adapter.hookName &&
          path.node.id.type === 'ObjectPattern'
        ) {
          path.node.id.properties.forEach((prop: any) => {
            if (
              prop.type === 'ObjectProperty' &&
              prop.key.type === 'Identifier' &&
              prop.key.name === this.adapter.functionName
            ) {
              const localName =
                prop.value.type === 'Identifier' ? prop.value.name : this.adapter.functionName;
              tFunctionNames.add(localName as string);
            }
          });
        }
      },

      // Find bare JSX text
      JSXText: (path: any) => {
        const text = path.node.value as string;
        const trimmed = text.trim();
        if (!trimmed) return;

        // Check if already inside <T>
        const ancestors = path.getAncestry().map((a: any) => a.node);
        if (this.adapter.isAlreadyWrapped(ancestors, vocoderImports)) return;

        const classification = classifyString(trimmed, 'jsx-text', {
          isInsideComponent: true,
        });

        if (classification.translatable) {
          candidates.push({
            file: filePath,
            line: path.node.loc?.start.line || 0,
            column: path.node.loc?.start.column || 0,
            text: trimmed,
            confidence: classification.confidence,
            strategy: 'T-component',
            context: 'jsx-text',
            reason: classification.reason,
          });
        }
      },

      // Find translatable JSX attributes
      JSXAttribute: (path: any) => {
        const attrName = path.node.name?.name as string | undefined;
        if (!attrName) return;

        const value = path.node.value;
        if (!value) return;

        let text: string | null = null;
        let context: StringContext = 'jsx-attribute';

        if (value.type === 'StringLiteral') {
          text = value.value as string;
        } else if (
          value.type === 'JSXExpressionContainer' &&
          value.expression.type === 'StringLiteral'
        ) {
          text = value.expression.value as string;
        }

        if (!text || !text.trim()) return;

        // Check if already wrapped in t()
        if (
          value.type === 'JSXExpressionContainer' &&
          value.expression.type === 'CallExpression'
        ) {
          if (this.adapter.isAlreadyWrappedCall(value.expression, tFunctionNames)) return;
        }

        const classification = classifyString(text.trim(), context, {
          attributeName: attrName,
          isInsideComponent: true,
        });

        if (classification.translatable) {
          candidates.push({
            file: filePath,
            line: path.node.loc?.start.line || 0,
            column: path.node.loc?.start.column || 0,
            text: text.trim(),
            confidence: classification.confidence,
            strategy: 't-function',
            context,
            reason: classification.reason,
          });
        }
      },

      // Find string literals in non-JSX contexts
      StringLiteral: (path: any) => {
        // Skip if this is part of an import/require
        if (path.parent.type === 'ImportDeclaration') return;
        if (path.parent.type === 'ExportDeclaration') return;

        // Skip if inside JSX attribute (handled by JSXAttribute visitor)
        if (path.parent.type === 'JSXAttribute') return;
        if (
          path.parent.type === 'JSXExpressionContainer' &&
          path.parentPath?.parent?.type === 'JSXAttribute'
        ) return;

        // Skip if inside JSX element (handled by JSXText visitor)
        if (path.parent.type === 'JSXExpressionContainer') return;

        // Skip if this is a key in an object
        if (path.parent.type === 'ObjectProperty' && path.parent.key === path.node) return;

        // Skip TypeScript type annotations
        if (path.parent.type === 'TSLiteralType') return;

        // Skip if already inside t()
        if (isInsideTCall(path, tFunctionNames)) return;

        const text = path.node.value as string;
        if (!text.trim()) return;

        // Determine parent context
        const callExpr = getEnclosingCallExpression(path);
        const parentType = path.parent.type as string;

        const classification = classifyString(text.trim(), 'string-literal', {
          parentType,
          isInsideCallExpression: callExpr,
          isInsideComponent: false,
        });

        // Boost confidence if variable name suggests translatable content
        let { confidence } = classification;
        if (
          parentType === 'VariableDeclarator' &&
          path.parent.id?.type === 'Identifier'
        ) {
          const varName = path.parent.id.name as string;
          if (isTranslatableVarName(varName) && classification.translatable) {
            confidence = 'high';
          }
        }

        if (classification.translatable) {
          candidates.push({
            file: filePath,
            line: path.node.loc?.start.line || 0,
            column: path.node.loc?.start.column || 0,
            text: text.trim(),
            confidence,
            strategy: 't-function',
            context: 'string-literal',
            reason: classification.reason,
          });
        }
      },

      // Find template literals
      TemplateLiteral: (path: any) => {
        // Skip if inside import/require
        if (path.parent.type === 'ImportDeclaration') return;

        // Skip tagged templates (e.g. css`...`, html`...`)
        if (path.parent.type === 'TaggedTemplateExpression') return;

        // Skip if already inside t()
        if (isInsideTCall(path, tFunctionNames)) return;

        // Skip templates with no static parts (pure expressions)
        const quasis = path.node.quasis as any[];
        if (quasis.length === 0) return;

        // Build the text representation
        const parts: string[] = [];
        for (let i = 0; i < quasis.length; i++) {
          const quasi = quasis[i];
          parts.push(quasi.value.raw as string);
          if (i < path.node.expressions.length) {
            const expr = path.node.expressions[i];
            if (expr.type === 'Identifier') {
              parts.push(`{${expr.name}}`);
            } else {
              parts.push('{value}');
            }
          }
        }
        const text = parts.join('').trim();
        if (!text) return;

        const callExpr = getEnclosingCallExpression(path);
        const parentType = path.parent.type as string;

        const classification = classifyString(text, 'template-literal', {
          parentType,
          isInsideCallExpression: callExpr,
          isInsideComponent: false,
        });

        if (classification.translatable) {
          candidates.push({
            file: filePath,
            line: path.node.loc?.start.line || 0,
            column: path.node.loc?.start.column || 0,
            text,
            confidence: classification.confidence,
            strategy: 't-function',
            context: 'template-literal',
            reason: classification.reason,
          });
        }
      },
    });

    return candidates;
  }
}

/**
 * Check if the current path is inside a t() call.
 */
function isInsideTCall(path: any, tNames: Set<string>): boolean {
  let current = path.parentPath;
  while (current) {
    if (current.node.type === 'CallExpression') {
      const callee = current.node.callee;
      if (callee.type === 'Identifier' && tNames.has(callee.name as string)) {
        return true;
      }
    }
    current = current.parentPath;
  }
  return false;
}

/**
 * Get the name of the enclosing call expression, if any.
 * Returns names like "console.log", "Error", "require", etc.
 */
function getEnclosingCallExpression(path: any): string | undefined {
  let current = path.parentPath;
  while (current) {
    if (current.node.type === 'CallExpression') {
      const callee = current.node.callee;
      if (callee.type === 'Identifier') {
        return callee.name as string;
      }
      if (
        callee.type === 'MemberExpression' &&
        callee.object.type === 'Identifier' &&
        callee.property.type === 'Identifier'
      ) {
        return `${callee.object.name}.${callee.property.name}`;
      }
    }
    // Also detect: throw new Error(...)
    if (current.node.type === 'NewExpression') {
      const callee = current.node.callee;
      if (callee.type === 'Identifier') {
        return callee.name as string;
      }
    }
    current = current.parentPath;
  }
  return undefined;
}
