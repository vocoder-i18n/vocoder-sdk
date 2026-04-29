/**
 * FNV-1a 32-bit hash for generating stable message IDs from source text.
 *
 * Works identically in Node.js and browsers (no platform APIs).
 * Used by the extractor (build time) and React runtime (browser) so both
 * always produce the same key for the same source text.
 *
 * Output: 7 base-36 chars (~2.2 billion values).
 * Collision probability ≈ 0.002% for 10K strings (birthday problem).
 * Add `context` to disambiguate identical strings with different meanings.
 *
 * Separator \x04 (ASCII EOT) matches Lingui's convention.
 */
export function generateMessageHash(text: string, context?: string): string {
	const input = context ? `${text}\x04${context}` : text;
	let h = 2166136261 >>> 0;
	for (let i = 0; i < input.length; i++) {
		h = Math.imul(h ^ input.charCodeAt(i), 16777619) >>> 0;
	}
	return h.toString(36).padStart(7, "0");
}
