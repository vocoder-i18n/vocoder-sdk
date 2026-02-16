import React from 'react';
import { useVocoder } from './VocoderProvider';
import type { VocoderContextValue } from './types';

/**
 * Props injected by withVocoder HOC
 */
export interface WithVocoderProps {
  /** Translation function - automatically reactive to locale changes */
  t: VocoderContextValue['t'];
  /** Current locale code */
  locale: string;
  /** Function to change locale */
  setLocale: (locale: string) => void;
  /** Available locale codes */
  availableLocales: string[];
  /** Returns true if a translation exists for the given source text */
  hasTranslation: VocoderContextValue['hasTranslation'];
}

/**
 * Higher-Order Component that injects Vocoder translation context.
 * Automatically handles locale change subscriptions and re-renders.
 *
 * Use this when you need the `t()` function in a component without
 * manually calling `useVocoder()` hook.
 *
 * @example Basic usage
 * ```tsx
 * import { withVocoder } from '@vocoder/react';
 *
 * const MyComponent = withVocoder(({ t, locale }) => {
 *   return (
 *     <div>
 *       <Input placeholder={t('Enter your email')} />
 *       <p>{t('Current language: {locale}', { locale })}</p>
 *     </div>
 *   );
 * });
 * ```
 *
 * @example With own props
 * ```tsx
 * interface MyComponentProps {
 *   userId: string;
 *   onSubmit: () => void;
 * }
 *
 * const MyComponent = withVocoder<MyComponentProps>(({ t, userId, onSubmit }) => {
 *   return (
 *     <form onSubmit={onSubmit}>
 *       <Input placeholder={t('Enter name')} />
 *       <Button>{t('Submit')}</Button>
 *     </form>
 *   );
 * });
 *
 * // Usage
 * <MyComponent userId="123" onSubmit={handleSubmit} />
 * ```
 *
 * @param Component - Component to wrap
 * @param options - Optional configuration
 * @returns Wrapped component with Vocoder context injected
 */
export function withVocoder<P extends object = {}>(
  Component: React.ComponentType<P & WithVocoderProps>,
  options?: {
    /** Display name for debugging */
    displayName?: string;
  },
): React.ComponentType<P> {
  const { displayName } = options || {};

  const WrappedComponent: React.FC<P> = (props: P) => {
    const vocoderContext = useVocoder();
    return <Component {...props} {...vocoderContext} />;
  };

  // Set display name for debugging
  const componentName = displayName || Component.displayName || Component.name || 'Component';
  WrappedComponent.displayName = `withVocoder(${componentName})`;

  return WrappedComponent;
}

/**
 * Alias for withVocoder with a more descriptive name
 * Use this if you prefer clarity over brevity
 */
export const withTranslation = withVocoder;
