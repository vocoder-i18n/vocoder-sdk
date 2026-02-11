import type {
  TranslationBatchResponse,
  TranslationStatusResponse,
  LocalConfig,
  APIProjectConfig,
} from '../types.js';

export class VocoderAPI {
  private apiUrl: string;
  private apiKey: string;

  constructor(config: LocalConfig) {
    this.apiUrl = config.apiUrl;
    this.apiKey = config.apiKey;
  }

  /**
   * Fetch project configuration from API
   * Project is determined from the API key
   */
  async getProjectConfig(): Promise<APIProjectConfig> {
    const response = await fetch(
      `${this.apiUrl}/api/cli/config`,
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch project config: ${error}`);
    }

    const data = await response.json();

    return {
      sourceLocale: data.sourceLocale,
      targetLocales: data.targetLocales,
      targetBranches: data.targetBranches,
    };
  }

  /**
   * Submit strings for translation
   * Project is determined from the API key
   */
  async submitTranslation(
    branch: string,
    strings: string[],
    targetLocales: string[],
  ): Promise<TranslationBatchResponse> {
    // Compute hash of sorted strings for fast comparison
    const crypto = await import('crypto');
    const sortedStrings = [...strings].sort();
    const stringsHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(sortedStrings))
      .digest('hex');

    const response = await fetch(`${this.apiUrl}/api/cli/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        branch,
        strings,
        targetLocales,
        stringsHash,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Translation submission failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Check translation status
   */
  async getTranslationStatus(
    batchId: string,
  ): Promise<TranslationStatusResponse> {
    const response = await fetch(
      `${this.apiUrl}/api/cli/sync/status/${batchId}`,
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to check translation status: ${error}`);
    }

    return response.json();
  }

  /**
   * Wait for translation to complete with polling
   */
  async waitForCompletion(
    batchId: string,
    timeout: number = 60000,
    onProgress?: (progress: number) => void,
  ): Promise<{
    translations: Record<string, Record<string, string>>;
    localeMetadata?: Record<string, { nativeName: string; dir?: 'rtl' }>;
  }> {
    const startTime = Date.now();
    const pollInterval = 1000; // Poll every second

    while (Date.now() - startTime < timeout) {
      const status = await this.getTranslationStatus(batchId);

      // Call progress callback
      if (onProgress) {
        onProgress(status.progress);
      }

      if (status.status === 'COMPLETED') {
        if (!status.translations) {
          throw new Error('Translation completed but no translations returned');
        }
        return {
          translations: status.translations,
          localeMetadata: status.localeMetadata,
        };
      }

      if (status.status === 'FAILED') {
        throw new Error(
          `Translation failed: ${status.errorMessage || 'Unknown error'}`,
        );
      }

      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Translation timeout after ${timeout}ms`);
  }
}
