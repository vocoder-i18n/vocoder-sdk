import { detectRepoIdentity } from '@vocoder/unplugin';
import type { VocoderClient } from '../client.js';

export async function runAddLocale(locale: string, client: VocoderClient): Promise<string> {
  const identity = detectRepoIdentity();
  const result = await client.addLocale(locale, identity?.repoCanonical);
  return `Locale "${locale}" added. Target locales are now: ${result.targetLocales.join(', ')}.`;
}
