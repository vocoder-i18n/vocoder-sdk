import { afterEach, describe, expect, it, vi } from 'vitest';
import { VocoderAPI, VocoderAPIError } from '../utils/api.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  vi.restoreAllMocks();
  globalThis.fetch = originalFetch;
});

describe('VocoderAPI limit errors', () => {
  it.each([
    'providers',
    'translation_chars',
    'source_strings',
  ] as const)('parses %s limit responses', async (limitType) => {
    const payload = {
      errorCode: 'LIMIT_EXCEEDED',
      limitType,
      planId: 'free',
      current: 1,
      required: 2,
      upgradeUrl: 'https://vocoder.app/dashboard/organization/settings?tab=providers',
      message: 'Limit reached',
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => JSON.stringify(payload),
    } as Response);

    const api = new VocoderAPI({ apiKey: 'test-key', apiUrl: 'https://vocoder.app' });

    try {
      await api.getProjectConfig();
      throw new Error('Expected VocoderAPIError');
    } catch (error) {
      expect(error).toBeInstanceOf(VocoderAPIError);
      expect((error as VocoderAPIError).limitError?.limitType).toBe(limitType);
    }
  });
});
