/**
 * Optional UI component - separate entry point to avoid bundling Radix UI
 * unless explicitly imported.
 *
 * Usage:
 *   import { LocaleSelector } from '@vocoder/react/locale-selector';
 *
 * This keeps the base SDK lightweight (~80KB) for users who build their own
 * language switcher UI.
 */

export { LocaleSelector } from './LocaleSelector';
export type { LocaleSelectorProps } from './types';
