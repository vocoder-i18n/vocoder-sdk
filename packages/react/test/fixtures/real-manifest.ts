// Derived from app/lib/translation/compile-locale-files.ts's real output,
// captured via app's compile-locale-files-shape.test.ts (integration tier)
// on 2026-08-05. Sourced from real, content-hash-keyed sourceKeys so this
// fixture matches production lookup behavior (VocoderProvider's default
// hash-based lookup, not just explicit `id` lookup).
//
// This is a separate, additive fixture — it does NOT replace manifest.ts,
// which stays hand-crafted for the existing 240-test suite (including its
// deliberate partial-locale-coverage cases). This one backs only
// VocoderProvider.real-compiler-output.test.tsx, which proves real compiler
// output actually renders through VocoderProvider.
//
// Regenerate: re-run that integration test in the app repo, then update
// these values (and real-locales/*.json) to match its real output.
import type { LocaleManifest } from "../../src/types";

const realManifest: LocaleManifest = {
	version: 1,
	sourceLocale: "en",
	targetLocales: ["es", "fr", "pl"],
	locales: {
		en: { nativeName: "English", currencyCode: "USD", isRTL: false },
		es: { nativeName: "Español", currencyCode: "EUR", isRTL: false },
		fr: { nativeName: "Français", currencyCode: "EUR", isRTL: false },
		pl: { nativeName: "Polski", currencyCode: "PLN", isRTL: false },
	},
	updatedAt: "2026-08-05T03:42:35.194Z",
};

export default realManifest;
