import { VocoderContextValue, VocoderProviderServerProps } from "./types";

import { createContext } from "react";

const VocoderContext = createContext<VocoderContextValue | null>(null);

/**
 * Server-compatible VocoderProvider for Next.js App Router async components.
 *
 * This version is designed for server-side rendering with no hooks or state.
 * Translations should be pre-loaded and passed as props.
 *
 * @example
 * ```tsx
 * import en from './locales/en.json'
 *
 * export default async function Page() {
 *   return (
 *     <VocoderProviderServer locale="en" translations={en}>
 *       <V>Server-rendered content</V>
 *     </VocoderProviderServer>
 *   )
 * }
 * ```
 */
export async function VocoderProviderServer({
  children,
  locale = "en",
  translations,
}: VocoderProviderServerProps) {
  /**
   * Translation lookup function for server context.
   */
  const t = (text: string): string => {
    return translations[text] || text;
  };

  /**
   * Get display name for a locale using Intl.DisplayNames
   */
  const getDisplayName = (targetLocale: string, viewingLocale?: string): string => {
    const vl = viewingLocale ?? locale;
    try {
      const dn = new Intl.DisplayNames([vl], { type: 'language' });
      return dn.of(targetLocale) ?? targetLocale;
    } catch {
      return targetLocale;
    }
  };

  const value: VocoderContextValue = {
    availableLocales: [locale], // Only current locale available on server
    getDisplayName,
    locale,
    setLocale: () => {}, // No-op on server (no interactivity)
    t,
  };

  return (
    <VocoderContext.Provider value={value}>
      {children}
    </VocoderContext.Provider>
  );
}
