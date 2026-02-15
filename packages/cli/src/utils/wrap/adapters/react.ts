/**
 * React framework adapter for the wrap command.
 * Implements FrameworkAdapter for React/JSX/TSX files.
 */

import type { FrameworkAdapter, WrapStrategy } from '../types.js';

export const reactAdapter: FrameworkAdapter = {
  name: 'react',
  extensions: ['.tsx', '.jsx', '.ts', '.js'],
  importSource: '@vocoder/react',
  componentName: 'T',
  functionName: 't',
  hookName: 'useVocoder',

  translatableAttributes: [
    'title', 'placeholder', 'alt',
    'aria-label', 'aria-description', 'aria-placeholder',
    'aria-roledescription', 'aria-valuetext',
    'label', 'description', 'message', 'heading', 'caption',
    'helperText', 'errorMessage', 'successMessage', 'tooltip',
  ],

  nonTranslatableAttributes: [
    'className', 'class', 'href', 'src', 'id', 'key', 'ref', 'style',
    'data-testid', 'data-cy', 'data-test',
    'type', 'name', 'value', 'action', 'method', 'encType', 'target',
    'rel', 'role', 'tabIndex', 'htmlFor', 'for',
    'width', 'height', 'viewBox', 'xmlns', 'fill', 'stroke',
  ],

  isAlreadyWrapped(ancestors: any[], imports: Map<string, string>): boolean {
    // Walk ancestor nodes to check if we're inside a <T> element
    for (const ancestor of ancestors) {
      if (ancestor.type === 'JSXElement') {
        const opening = ancestor.openingElement;
        if (opening && opening.name && opening.name.type === 'JSXIdentifier') {
          const tagName = opening.name.name as string;
          if (imports.has(tagName) && imports.get(tagName) === 'T') {
            return true;
          }
        }
      }
    }
    return false;
  },

  isAlreadyWrappedCall(node: any, tNames: Set<string>): boolean {
    // Check if this node is already inside a t() call expression
    if (node.type === 'CallExpression') {
      const callee = node.callee;
      if (callee.type === 'Identifier' && tNames.has(callee.name as string)) {
        return true;
      }
    }
    return false;
  },

  getRequiredImports(strategies: Set<WrapStrategy>): {
    specifiers: string[];
    source: string;
  } {
    const specifiers: string[] = [];

    if (strategies.has('T-component')) {
      specifiers.push('T');
    }

    if (strategies.has('t-function')) {
      // Inside components we use useVocoder hook; at module level we use t directly
      // The transformer decides which one to add based on context
      specifiers.push('useVocoder');
    }

    return { specifiers, source: '@vocoder/react' };
  },
};
