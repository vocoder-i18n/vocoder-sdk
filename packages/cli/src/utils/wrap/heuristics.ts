/**
 * Heuristic classification engine for determining
 * whether a string is user-facing and translatable.
 */

import type {
  ClassificationResult,
  ClassificationMetadata,
  StringContext,
} from './types.js';

// Patterns that indicate a string should NEVER be translated
const URL_REGEX = /^(https?:\/\/|\/\/|mailto:|tel:|ftp:\/\/)/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FILE_PATH_REGEX = /^(\.{0,2}\/|[a-zA-Z]:\\)/;
const COLOR_HEX_REGEX = /^#([0-9a-fA-F]{3,8})$/;
const COLOR_FUNC_REGEX = /^(rgb|rgba|hsl|hsla)\s*\(/i;
const CAMEL_CASE_REGEX = /^[a-z][a-zA-Z0-9]*$/;
const PASCAL_CASE_REGEX = /^[A-Z][a-zA-Z0-9]*$/;
const SCREAMING_SNAKE_REGEX = /^[A-Z][A-Z0-9_]+$/;
const KEBAB_CASE_REGEX = /^[a-z][a-z0-9-]+$/;
const MIME_TYPE_REGEX = /^(application|text|image|audio|video|font|multipart)\//;
const DATE_FORMAT_REGEX = /^[YMDHhmsaAZz\-\/\.\s:,]+$/;
const CSS_UNIT_REGEX = /^\d+(\.\d+)?(px|em|rem|vh|vw|%|ch|ex|pt|pc|in|cm|mm)$/;

// Tailwind-like CSS class patterns
const TAILWIND_REGEX =
  /^[a-z][\w-]*(\s+[a-z][\w-]*)*$/;
const TAILWIND_PREFIXES = [
  'flex', 'grid', 'block', 'inline', 'hidden', 'absolute', 'relative', 'fixed', 'sticky',
  'top', 'bottom', 'left', 'right', 'inset',
  'w-', 'h-', 'min-', 'max-', 'p-', 'px-', 'py-', 'pt-', 'pb-', 'pl-', 'pr-',
  'm-', 'mx-', 'my-', 'mt-', 'mb-', 'ml-', 'mr-',
  'text-', 'font-', 'leading-', 'tracking-', 'bg-', 'border-', 'rounded-',
  'shadow-', 'opacity-', 'z-', 'gap-', 'space-',
  'items-', 'justify-', 'self-', 'place-',
  'overflow-', 'cursor-', 'transition-', 'duration-', 'ease-',
  'sm:', 'md:', 'lg:', 'xl:', '2xl:', 'dark:', 'hover:', 'focus:', 'active:',
  'group-', 'peer-',
];

// Non-translatable JSX attributes
const NON_TRANSLATABLE_ATTRIBUTES = new Set([
  'className', 'class', 'href', 'src', 'id', 'key', 'ref', 'style',
  'data-testid', 'data-cy', 'data-test',
  'type', 'name', 'value', 'action', 'method', 'encType', 'target',
  'rel', 'role', 'tabIndex', 'htmlFor', 'for',
  'width', 'height', 'viewBox', 'xmlns', 'fill', 'stroke',
  'onClick', 'onChange', 'onSubmit', 'onBlur', 'onFocus', 'onKeyDown',
  'onKeyUp', 'onKeyPress', 'onMouseEnter', 'onMouseLeave',
]);

// Translatable JSX attributes
const TRANSLATABLE_ATTRIBUTES = new Set([
  'title', 'placeholder', 'alt', 'aria-label', 'aria-description',
  'aria-placeholder', 'aria-roledescription', 'aria-valuetext',
  'label', 'description', 'message', 'heading', 'caption',
  'helperText', 'errorMessage', 'successMessage', 'tooltip',
]);

// Non-translatable call expression contexts
const NON_TRANSLATABLE_CALLS = new Set([
  'console.log', 'console.warn', 'console.error', 'console.info', 'console.debug',
  'require', 'import',
  'addEventListener', 'removeEventListener',
  'querySelector', 'querySelectorAll', 'getElementById',
  'getAttribute', 'setAttribute', 'createElement',
  'JSON.parse', 'JSON.stringify',
  'parseInt', 'parseFloat',
  'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI',
  'RegExp',
]);

// Variable names that suggest translatable content
const TRANSLATABLE_VAR_NAMES = new Set([
  'label', 'message', 'title', 'description', 'heading',
  'text', 'caption', 'subtitle', 'tooltip',
  'errorMessage', 'successMessage', 'warningMessage', 'infoMessage',
  'placeholder', 'helperText', 'hint',
  'buttonText', 'linkText', 'headerText', 'footerText',
  'confirmText', 'cancelText', 'submitText',
  'greeting', 'welcome', 'instructions',
]);

/**
 * Determine if a string is translatable and with what confidence.
 */
export function classifyString(
  text: string,
  context: StringContext,
  metadata: ClassificationMetadata = {},
): ClassificationResult {
  const trimmed = text.trim();

  // --- SKIP RULES (never translate) ---

  // Empty or whitespace-only
  if (trimmed.length === 0) {
    return { translatable: false, confidence: 'high', reason: 'Empty or whitespace-only' };
  }

  // Single character
  if (trimmed.length === 1) {
    return { translatable: false, confidence: 'high', reason: 'Single character' };
  }

  // Punctuation-only (no letters)
  if (!/[a-zA-Z]/.test(trimmed)) {
    return { translatable: false, confidence: 'high', reason: 'No alphabetic characters' };
  }

  // URLs
  if (URL_REGEX.test(trimmed)) {
    return { translatable: false, confidence: 'high', reason: 'URL' };
  }

  // Email addresses
  if (EMAIL_REGEX.test(trimmed)) {
    return { translatable: false, confidence: 'high', reason: 'Email address' };
  }

  // File paths
  if (FILE_PATH_REGEX.test(trimmed) && !trimmed.includes(' ')) {
    return { translatable: false, confidence: 'high', reason: 'File path' };
  }

  // Color codes
  if (COLOR_HEX_REGEX.test(trimmed) || COLOR_FUNC_REGEX.test(trimmed)) {
    return { translatable: false, confidence: 'high', reason: 'Color code' };
  }

  // CSS units
  if (CSS_UNIT_REGEX.test(trimmed)) {
    return { translatable: false, confidence: 'high', reason: 'CSS unit value' };
  }

  // MIME types
  if (MIME_TYPE_REGEX.test(trimmed)) {
    return { translatable: false, confidence: 'high', reason: 'MIME type' };
  }

  // Date format strings (only non-word chars + format tokens)
  if (DATE_FORMAT_REGEX.test(trimmed) && trimmed.length > 1) {
    return { translatable: false, confidence: 'high', reason: 'Date format string' };
  }

  // --- ATTRIBUTE CHECKS (run before identifier checks) ---

  // Non-translatable attributes
  if (context === 'jsx-attribute' && metadata.attributeName) {
    if (NON_TRANSLATABLE_ATTRIBUTES.has(metadata.attributeName)) {
      return { translatable: false, confidence: 'high', reason: `Non-translatable attribute: ${metadata.attributeName}` };
    }

    // data-* attributes (except data-label, data-title, etc.)
    if (
      metadata.attributeName.startsWith('data-') &&
      !TRANSLATABLE_ATTRIBUTES.has(metadata.attributeName)
    ) {
      return { translatable: false, confidence: 'high', reason: 'data-* attribute' };
    }

    // Event handler attributes
    if (metadata.attributeName.startsWith('on') && metadata.attributeName.length > 2) {
      const thirdChar = metadata.attributeName[2];
      if (thirdChar && thirdChar === thirdChar.toUpperCase()) {
        return { translatable: false, confidence: 'high', reason: 'Event handler attribute' };
      }
    }

    // Translatable attributes — return early as high confidence
    if (TRANSLATABLE_ATTRIBUTES.has(metadata.attributeName)) {
      return { translatable: true, confidence: 'high', reason: `Translatable attribute: ${metadata.attributeName}` };
    }
  }

  // JSX text with words — return early as high confidence
  if (context === 'jsx-text') {
    const hasWords = /[a-zA-Z]{2,}/.test(trimmed);
    if (hasWords) {
      return { translatable: true, confidence: 'high', reason: 'JSX text with words' };
    }
  }

  // Identifiers: camelCase, PascalCase, SCREAMING_SNAKE (no spaces = code identifier)
  if (
    !trimmed.includes(' ') &&
    (CAMEL_CASE_REGEX.test(trimmed) ||
      PASCAL_CASE_REGEX.test(trimmed) ||
      SCREAMING_SNAKE_REGEX.test(trimmed) ||
      KEBAB_CASE_REGEX.test(trimmed))
  ) {
    return { translatable: false, confidence: 'high', reason: 'Code identifier' };
  }

  // Tailwind / CSS class strings
  if (isTailwindClasses(trimmed)) {
    return { translatable: false, confidence: 'high', reason: 'CSS/Tailwind classes' };
  }

  // Inside non-translatable call expressions
  if (metadata.isInsideCallExpression) {
    if (NON_TRANSLATABLE_CALLS.has(metadata.isInsideCallExpression)) {
      return { translatable: false, confidence: 'high', reason: `Inside ${metadata.isInsideCallExpression}()` };
    }
  }

  // throw new Error(...)
  if (metadata.parentType === 'ThrowStatement' || metadata.isInsideCallExpression === 'Error') {
    return { translatable: false, confidence: 'high', reason: 'Error message' };
  }

  // --- MEDIUM CONFIDENCE ---

  // Variables with translatable names
  if (
    (context === 'string-literal' || context === 'template-literal') &&
    metadata.parentType === 'VariableDeclarator'
  ) {
    // Check if there's a naming hint (not directly available, but we can check)
    return { translatable: true, confidence: 'medium', reason: 'String in variable declaration' };
  }

  // Multi-word strings (phrases)
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount >= 3) {
    return { translatable: true, confidence: 'medium', reason: `Multi-word string (${wordCount} words)` };
  }

  // Two-word strings
  if (wordCount === 2 && /[a-zA-Z]{2,}/.test(trimmed)) {
    return { translatable: true, confidence: 'low', reason: 'Short phrase (2 words)' };
  }

  // Single word with spaces or that looks like UI text
  if (/^[A-Z][a-z]/.test(trimmed) && context !== 'string-literal') {
    return { translatable: true, confidence: 'low', reason: 'Capitalized word, possibly UI text' };
  }

  // Default: not translatable for single words in ambiguous contexts
  return { translatable: false, confidence: 'low', reason: 'Ambiguous single-word string' };
}

/**
 * Check if a variable name suggests translatable content.
 */
export function isTranslatableVarName(name: string): boolean {
  const lower = name.toLowerCase();
  for (const varName of TRANSLATABLE_VAR_NAMES) {
    if (lower === varName.toLowerCase() || lower.endsWith(varName.toLowerCase())) {
      return true;
    }
  }
  return false;
}

/**
 * Detect if a string looks like Tailwind / CSS utility classes.
 */
function isTailwindClasses(text: string): boolean {
  // Must match the general pattern (lowercase words separated by spaces)
  if (!TAILWIND_REGEX.test(text)) return false;

  const parts = text.split(/\s+/);

  // If most parts look like Tailwind classes, it's CSS
  let tailwindCount = 0;
  for (const part of parts) {
    if (TAILWIND_PREFIXES.some((prefix: string) => part.startsWith(prefix))) {
      tailwindCount++;
    }
  }

  // If more than half the parts look like Tailwind, classify as CSS
  return tailwindCount > parts.length / 2;
}

export { TRANSLATABLE_ATTRIBUTES, NON_TRANSLATABLE_ATTRIBUTES };
