/**
 * Types for the vocoder wrap command
 */

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type StringContext =
  | 'jsx-text'
  | 'jsx-attribute'
  | 'string-literal'
  | 'template-literal';

export type WrapStrategy = 'T-component' | 't-function';

export interface WrapCandidate {
  file: string;
  line: number;
  column: number;
  text: string;
  confidence: ConfidenceLevel;
  strategy: WrapStrategy;
  context: StringContext;
  reason: string;
}

export interface TransformResult {
  file: string;
  output: string;
  wrappedCount: number;
  wrapped: WrapCandidate[];
  skipped: WrapCandidate[];
}

export interface WrapOptions {
  dryRun?: boolean;
  interactive?: boolean;
  confidence?: ConfidenceLevel;
  verbose?: boolean;
  include?: string[];
  exclude?: string[];
}

export interface ClassificationResult {
  translatable: boolean;
  confidence: ConfidenceLevel;
  reason: string;
}

export interface ClassificationMetadata {
  attributeName?: string;
  parentType?: string;
  isInsideComponent?: boolean;
  isInsideCallExpression?: string;
}

/**
 * Framework adapter interface for extensibility.
 * Implement this to add support for Vue, Svelte, etc.
 */
export interface FrameworkAdapter {
  /** Adapter name (e.g. 'react', 'vue') */
  name: string;

  /** File extensions this adapter handles */
  extensions: string[];

  /** Import source for translation utilities */
  importSource: string;

  /** Component name for wrapping JSX text (e.g. 'T') */
  componentName: string;

  /** Function name for wrapping string literals (e.g. 't') */
  functionName: string;

  /** Hook name for reactive t() inside components */
  hookName: string;

  /** Attributes that commonly contain translatable text */
  translatableAttributes: string[];

  /** Non-translatable attributes (skip these) */
  nonTranslatableAttributes: string[];

  /** Check if a JSX node is already wrapped in the translation component */
  isAlreadyWrapped(ancestors: any[], imports: Map<string, string>): boolean;

  /** Check if a call expression is already a t() call */
  isAlreadyWrappedCall(node: any, tNames: Set<string>): boolean;

  /** Get the required imports based on which strategies were used */
  getRequiredImports(strategies: Set<WrapStrategy>): {
    specifiers: string[];
    source: string;
  };
}
