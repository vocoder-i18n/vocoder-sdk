import type {
  APIProjectConfig,
  InitStartResponse,
  InitStatusResponse,
	LimitErrorResponse,
	LocalConfig,
	RequestedSyncMode,
	RepoIdentityPayload,
	SyncPolicyErrorResponse,
	TranslationBatchResponse,
	TranslationSnapshotResponse,
	TranslationStringEntry,
	TranslationStatusResponse,
} from '../types.js';

function isLimitErrorResponse(value: unknown): value is LimitErrorResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<LimitErrorResponse>;
  return (
    typeof candidate.errorCode === 'string' &&
    typeof candidate.limitType === 'string' &&
    typeof candidate.planId === 'string' &&
    typeof candidate.current === 'number' &&
    typeof candidate.required === 'number' &&
    typeof candidate.upgradeUrl === 'string' &&
    typeof candidate.message === 'string'
  );
}

function isSyncPolicyErrorResponse(value: unknown): value is SyncPolicyErrorResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<SyncPolicyErrorResponse>;
  return (
    (candidate.errorCode === 'BRANCH_NOT_ALLOWED' ||
      candidate.errorCode === 'PROJECT_REPOSITORY_MISMATCH') &&
    typeof candidate.message === 'string'
  );
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  const candidate = payload as Record<string, unknown>;
  if (typeof candidate.message === 'string') {
    return candidate.message;
  }

  if (typeof candidate.error === 'string') {
    return candidate.error;
  }

  return fallback;
}

function parsePayload(raw: string): unknown {
  if (raw.length === 0) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return { message: raw };
  }
}

async function readPayload(response: {
  text?: () => Promise<string>;
  json?: () => Promise<unknown>;
}): Promise<unknown> {
  if (typeof response.text === 'function') {
    const raw = await response.text();
    return parsePayload(raw);
  }

  if (typeof response.json === 'function') {
    return response.json();
  }

  return null;
}

export class VocoderAPIError extends Error {
  readonly status: number;
  readonly payload: unknown;
  readonly limitError: LimitErrorResponse | null;
  readonly syncPolicyError: SyncPolicyErrorResponse | null;

  constructor(params: {
    message: string;
    status: number;
    payload: unknown;
    limitError?: LimitErrorResponse | null;
    syncPolicyError?: SyncPolicyErrorResponse | null;
  }) {
    super(params.message);
    this.name = 'VocoderAPIError';
    this.status = params.status;
    this.payload = params.payload;
    this.limitError = params.limitError ?? null;
    this.syncPolicyError = params.syncPolicyError ?? null;
  }
}

export class VocoderAPI {
  private apiUrl: string;
  private apiKey: string;

  constructor(config: LocalConfig) {
    this.apiUrl = config.apiUrl;
    this.apiKey = config.apiKey;
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
    errorPrefix?: string,
  ): Promise<T> {
    const response = await fetch(`${this.apiUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...(init.headers ?? {}),
      },
    });

    const payload = await readPayload(response);

    if (!response.ok) {
      const limitError = isLimitErrorResponse(payload) ? payload : null;
      const syncPolicyError = isSyncPolicyErrorResponse(payload) ? payload : null;
      const baseMessage = extractErrorMessage(payload, `Request failed with status ${response.status}`);
      throw new VocoderAPIError({
        message: errorPrefix ? `${errorPrefix}: ${baseMessage}` : baseMessage,
        status: response.status,
        payload,
        limitError,
        syncPolicyError,
      });
    }

    return payload as T;
  }

  /**
   * Fetch project configuration from API
   * Project is determined from the API key
   */
	async getProjectConfig(): Promise<APIProjectConfig> {
		const data = await this.request<{
			projectName: string;
			organizationName: string;
			sourceLocale: string;
			targetLocales: string[];
			targetBranches: string[];
			syncPolicy?: {
				blockingBranches?: string[];
				blockingMode?: "required" | "best-effort";
				nonBlockingMode?: "required" | "best-effort";
				defaultMaxWaitMs?: number;
			};
		}>('/api/cli/config', {}, 'Failed to fetch project config');

		return {
			projectName: data.projectName,
			organizationName: data.organizationName,
			sourceLocale: data.sourceLocale,
			targetLocales: data.targetLocales,
			targetBranches: data.targetBranches,
			syncPolicy: {
				blockingBranches: data.syncPolicy?.blockingBranches ?? ["main", "master"],
				blockingMode: data.syncPolicy?.blockingMode ?? "required",
				nonBlockingMode: data.syncPolicy?.nonBlockingMode ?? "best-effort",
				defaultMaxWaitMs: data.syncPolicy?.defaultMaxWaitMs ?? 60_000,
			},
		};
	}

  /**
   * Submit strings for translation
   * Project is determined from the API key
   */
  private stableTextKey(text: string): string {
    // FNV-1a 32-bit hash for deterministic fallback IDs
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return `SK_TEXT_${(hash >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
  }

  private normalizeStringEntries(
    entries: string[] | TranslationStringEntry[],
  ): TranslationStringEntry[] {
    if (entries.length === 0) {
      return [];
    }

    const first = entries[0];
    if (typeof first === 'string') {
      return (entries as string[]).map((text) => ({
        key: this.stableTextKey(text),
        text,
      }));
    }

    return (entries as TranslationStringEntry[]).map((entry, index) => ({
      key: entry.key || this.stableTextKey(`${entry.text}:${index}`),
      text: entry.text,
      ...(entry.context ? { context: entry.context } : {}),
      ...(entry.formality ? { formality: entry.formality } : {}),
    }));
  }

	async submitTranslation(
		branch: string,
		entries: string[] | TranslationStringEntry[],
		targetLocales: string[],
		options?: {
			requestedMode?: RequestedSyncMode;
			requestedMaxWaitMs?: number;
			clientRunId?: string;
		},
		repoIdentity?: RepoIdentityPayload,
	): Promise<TranslationBatchResponse> {
    const stringEntries = this.normalizeStringEntries(entries);
    const strings = stringEntries.map((entry) => entry.text);

    // Compute hash of sorted strings for fast comparison
    const crypto = await import('crypto');
    const sortedStrings = [...strings].sort();
    const stringsHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(sortedStrings))
      .digest('hex');

    return this.request<TranslationBatchResponse>('/api/cli/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
	      body: JSON.stringify({
	        branch,
	        stringEntries,
	        targetLocales,
	        stringsHash,
	        ...(options?.requestedMode ? { requestedMode: options.requestedMode } : {}),
	        ...(typeof options?.requestedMaxWaitMs === 'number'
	          ? { requestedMaxWaitMs: options.requestedMaxWaitMs }
	          : {}),
	        ...(options?.clientRunId ? { clientRunId: options.clientRunId } : {}),
	        ...(repoIdentity?.repoCanonical ? { repoCanonical: repoIdentity.repoCanonical } : {}),
	        ...(repoIdentity?.repoScopePath !== undefined
	          ? { repoScopePath: repoIdentity.repoScopePath }
          : {}),
      }),
    }, 'Translation submission failed');
  }

  /**
   * Check translation status
   */
	async getTranslationStatus(
		batchId: string,
	): Promise<TranslationStatusResponse> {
		return this.request<TranslationStatusResponse>(
			`/api/cli/sync/status/${batchId}`,
			{},
			'Failed to check translation status',
		);
	}

	async getTranslationSnapshot(params: {
		branch: string;
		targetLocales: string[];
	}): Promise<TranslationSnapshotResponse> {
		const search = new URLSearchParams();
		search.set('branch', params.branch);
		for (const locale of params.targetLocales) {
			search.append('targetLocale', locale);
		}

		return this.request<TranslationSnapshotResponse>(
			`/api/cli/sync/snapshot?${search.toString()}`,
			{},
			'Failed to fetch translation snapshot',
		);
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

  async startInitSession(input: {
    projectName?: string;
    sourceLocale?: string;
    targetLocales?: string[];
    repoCanonical?: string;
    repoScopePath?: string;
  }): Promise<InitStartResponse> {
    const response = await fetch(`${this.apiUrl}/api/cli/init/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    const payload = await readPayload(response);

    if (!response.ok) {
      throw new VocoderAPIError({
        message: extractErrorMessage(payload, `Failed to start init session (${response.status})`),
        status: response.status,
        payload,
      });
    }

    return payload as InitStartResponse;
  }

  async getInitSessionStatus(params: {
    sessionId: string;
    pollToken: string;
  }): Promise<InitStatusResponse> {
    const response = await fetch(
      `${this.apiUrl}/api/cli/init/status/${params.sessionId}`,
      {
        headers: {
          Authorization: `Bearer ${params.pollToken}`,
        },
      },
    );

    const payload = await readPayload(response);

    if (!response.ok) {
      throw new VocoderAPIError({
        message: extractErrorMessage(payload, `Failed to get init status (${response.status})`),
        status: response.status,
        payload,
      });
    }

    return payload as InitStatusResponse;
  }
}
