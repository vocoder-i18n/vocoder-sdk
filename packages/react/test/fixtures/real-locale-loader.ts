// Derived from app/lib/translation/compile-locale-files.ts's real output,
// captured via app's compile-locale-files-shape.test.ts (integration tier)
// on 2026-08-05. Sourced from real, content-hash-keyed sourceKeys so this
// fixture matches production lookup behavior (VocoderProvider's default
// hash-based lookup, not just explicit `id` lookup).
//
// This is a separate, additive fixture — it does NOT replace locale-loader.ts,
// which stays hand-crafted for the existing 240-test suite. This one backs
// only VocoderProvider.real-compiler-output.test.tsx.
//
// Regenerate: re-run that integration test in the app repo, then update
// real-manifest.ts and real-locales/*.json to match its real output.
import en from "./real-locales/en.json";
import es from "./real-locales/es.json";
import fr from "./real-locales/fr.json";
import pl from "./real-locales/pl.json";

const realLocaleData: Record<string, Record<string, string>> = { en, es, fr, pl };

export async function loadRealLocale(locale: string): Promise<Record<string, string>> {
	return realLocaleData[locale] ?? {};
}
