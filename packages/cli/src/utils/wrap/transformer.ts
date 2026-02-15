/**
 * AST transformer that applies wrapping transformations
 * to source files using recast for format-preserving output.
 */

import * as recast from 'recast';
import { parse as babelParse } from '@babel/parser';
import type { WrapCandidate, TransformResult, FrameworkAdapter, WrapStrategy } from './types.js';

// Recast-compatible Babel parser
const babelParser = {
  parse(source: string) {
    return babelParse(source, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
      tokens: true,
    });
  },
};

export class StringTransformer {
  private adapter: FrameworkAdapter;

  constructor(adapter: FrameworkAdapter) {
    this.adapter = adapter;
  }

  /**
   * Transform a file by wrapping the given candidates.
   * Returns the transformed source code.
   */
  transform(
    code: string,
    candidates: WrapCandidate[],
    filePath: string = '<input>',
  ): TransformResult {
    const ast = recast.parse(code, { parser: babelParser });
    const b = recast.types.builders;

    const wrapped: WrapCandidate[] = [];
    const skipped: WrapCandidate[] = [];
    const usedStrategies = new Set<WrapStrategy>();

    // Track which components need useVocoder hook injection
    const componentsNeedingHook = new Set<any>();

    // Build a lookup of candidates by line+column for matching
    const candidatesByLocation = new Map<string, WrapCandidate>();
    for (const c of candidates) {
      candidatesByLocation.set(`${c.line}:${c.column}`, c);
    }

    // Track existing vocoder imports
    let existingImportDecl: any = null;
    const existingSpecifiers = new Set<string>();

    // Capture adapter for use in visitors (recast's `this` is visitor context)
    const adapter = this.adapter;

    recast.visit(ast, {
      visitImportDeclaration(path) {
        const source = path.node.source.value;
        if (source === adapter.importSource) {
          existingImportDecl = path;
          for (const spec of path.node.specifiers || []) {
            if (spec.type === 'ImportSpecifier' && spec.imported.type === 'Identifier') {
              existingSpecifiers.add(spec.imported.name);
            }
          }
        }
        this.traverse(path);
      },

      visitJSXText(path) {
        const loc = path.node.loc;
        if (!loc) { this.traverse(path); return; }

        const key = `${loc.start.line}:${loc.start.column}`;
        const candidate = candidatesByLocation.get(key);
        if (!candidate || candidate.strategy !== 'T-component') {
          this.traverse(path);
          return;
        }

        const tOpen = b.jsxOpeningElement(
          b.jsxIdentifier(adapter.componentName),
          [],
        );
        const tClose = b.jsxClosingElement(
          b.jsxIdentifier(adapter.componentName),
        );
        const tElement = b.jsxElement(
          tOpen,
          tClose,
          [b.jsxText(candidate.text)],
        );

        path.replace(tElement);

        wrapped.push(candidate);
        usedStrategies.add('T-component');
        candidatesByLocation.delete(key);

        return false;
      },

      visitJSXAttribute(path) {
        const loc = path.node.loc;
        if (!loc) { this.traverse(path); return; }

        const key = `${loc.start.line}:${loc.start.column}`;
        const candidate = candidatesByLocation.get(key);
        if (!candidate || candidate.strategy !== 't-function') {
          this.traverse(path);
          return;
        }

        const value = path.node.value;
        if (!value) { this.traverse(path); return; }

        const tCall = b.callExpression(
          b.identifier(adapter.functionName),
          [b.stringLiteral(candidate.text)],
        );
        const exprContainer = b.jsxExpressionContainer(tCall);

        path.node.value = exprContainer;

        const componentFunc = findEnclosingComponent(path);
        if (componentFunc) {
          componentsNeedingHook.add(componentFunc);
        }

        wrapped.push(candidate);
        usedStrategies.add('t-function');
        candidatesByLocation.delete(key);

        this.traverse(path);
      },

      visitStringLiteral(path) {
        const loc = path.node.loc;
        if (!loc) { this.traverse(path); return; }

        const key = `${loc.start.line}:${loc.start.column}`;
        const candidate = candidatesByLocation.get(key);
        if (!candidate || candidate.strategy !== 't-function') {
          this.traverse(path);
          return;
        }

        if (path.parent.node.type === 'JSXAttribute') {
          this.traverse(path);
          return;
        }

        const tCall = b.callExpression(
          b.identifier(adapter.functionName),
          [b.stringLiteral(candidate.text)],
        );

        path.replace(tCall);

        const componentFunc = findEnclosingComponent(path);
        if (componentFunc) {
          componentsNeedingHook.add(componentFunc);
        }

        wrapped.push(candidate);
        usedStrategies.add('t-function');
        candidatesByLocation.delete(key);

        return false;
      },
    });

    // Any remaining candidates were not found in AST traversal
    for (const candidate of candidatesByLocation.values()) {
      skipped.push(candidate);
    }

    // Inject useVocoder hook into components that need it
    if (componentsNeedingHook.size > 0) {
      this.injectUseVocoderHooks(ast, componentsNeedingHook, b);
    }

    // Manage imports
    this.manageImports(ast, usedStrategies, existingImportDecl, existingSpecifiers, componentsNeedingHook.size > 0, b);

    const output = recast.print(ast).code;

    return {
      file: filePath,
      output,
      wrappedCount: wrapped.length,
      wrapped,
      skipped,
    };
  }

  /**
   * Inject `const { t } = useVocoder();` at the top of component functions.
   */
  private injectUseVocoderHooks(
    ast: any,
    componentFuncs: Set<any>,
    b: typeof recast.types.builders,
  ): void {
    const adapterFunctionName = this.adapter.functionName;
    const adapterHookName = this.adapter.hookName;

    const buildHookDecl = () => b.variableDeclaration('const', [
      b.variableDeclarator(
        b.objectPattern([
          b.property.from({
            kind: 'init',
            key: b.identifier(adapterFunctionName),
            value: b.identifier(adapterFunctionName),
            shorthand: true,
          }),
        ]),
        b.callExpression(b.identifier(adapterHookName), []),
      ),
    ]);

    recast.visit(ast, {
      visitFunction(path) {
        if (componentFuncs.has(path.node)) {
          const body = path.node.body;
          if (body.type === 'BlockStatement') {
            const alreadyHasHook = body.body.some((stmt: any) => {
              if (stmt.type !== 'VariableDeclaration') return false;
              return stmt.declarations.some((decl: any) =>
                decl.init?.type === 'CallExpression' &&
                decl.init.callee?.type === 'Identifier' &&
                decl.init.callee.name === 'useVocoder',
              );
            });

            if (!alreadyHasHook) {
              body.body.unshift(buildHookDecl());
            }
          }
        }
        this.traverse(path);
      },

      visitArrowFunctionExpression(path) {
        if (componentFuncs.has(path.node)) {
          const body = path.node.body;
          if (body.type === 'BlockStatement') {
            const alreadyHasHook = body.body.some((stmt: any) => {
              if (stmt.type !== 'VariableDeclaration') return false;
              return stmt.declarations.some((decl: any) =>
                decl.init?.type === 'CallExpression' &&
                decl.init.callee?.type === 'Identifier' &&
                decl.init.callee.name === 'useVocoder',
              );
            });

            if (!alreadyHasHook) {
              body.body.unshift(buildHookDecl());
            }
          }
        }
        this.traverse(path);
      },
    });
  }

  /**
   * Add or update @vocoder/react imports.
   */
  private manageImports(
    ast: any,
    usedStrategies: Set<WrapStrategy>,
    existingImportPath: any,
    existingSpecifiers: Set<string>,
    needsHook: boolean,
    b: typeof recast.types.builders,
  ): void {
    if (usedStrategies.size === 0) return;

    const neededSpecifiers = new Set<string>();

    if (usedStrategies.has('T-component')) {
      neededSpecifiers.add(this.adapter.componentName);
    }

    if (usedStrategies.has('t-function') && needsHook) {
      neededSpecifiers.add(this.adapter.hookName);
    }

    const missingSpecifiers: string[] = [];
    for (const spec of neededSpecifiers) {
      if (!existingSpecifiers.has(spec)) {
        missingSpecifiers.push(spec);
      }
    }

    if (missingSpecifiers.length === 0) return;

    if (existingImportPath) {
      for (const name of missingSpecifiers) {
        const specifier = b.importSpecifier(b.identifier(name), b.identifier(name));
        existingImportPath.node.specifiers.push(specifier);
      }
    } else {
      const specifiers = missingSpecifiers.map((name: string) =>
        b.importSpecifier(b.identifier(name), b.identifier(name)),
      );
      const importDecl = b.importDeclaration(
        specifiers,
        b.stringLiteral(this.adapter.importSource),
      );

      const body = ast.program.body;
      let lastImportIndex = -1;
      for (let i = 0; i < body.length; i++) {
        if (body[i].type === 'ImportDeclaration') {
          lastImportIndex = i;
        }
      }

      if (lastImportIndex >= 0) {
        body.splice(lastImportIndex + 1, 0, importDecl);
      } else {
        body.unshift(importDecl);
      }
    }
  }
}

/**
 * Walk up the AST to find the enclosing function component.
 * Returns the function node if found (used to inject useVocoder hook).
 */
function findEnclosingComponent(path: any): any | null {
  let current = path.parent;
  while (current) {
    const node = current.node;

    if (node.type === 'FunctionDeclaration' && node.id?.name) {
      const name = node.id.name as string;
      if (/^[A-Z]/.test(name)) return node;
    }

    if (node.type === 'ArrowFunctionExpression') {
      const parent = current.parent?.node;
      if (
        parent?.type === 'VariableDeclarator' &&
        parent.id?.type === 'Identifier'
      ) {
        const name = parent.id.name as string;
        if (/^[A-Z]/.test(name)) return node;
      }
    }

    if (node.type === 'FunctionExpression') {
      const parent = current.parent?.node;
      if (
        parent?.type === 'VariableDeclarator' &&
        parent.id?.type === 'Identifier'
      ) {
        const name = parent.id.name as string;
        if (/^[A-Z]/.test(name)) return node;
      }
    }

    current = current.parent;
  }
  return null;
}
