export interface TranslateOptions {
  branch?: string;
  force?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  include?: string[];
  exclude?: string[];
}

export interface InitOptions {
  apiUrl?: string;
  yes?: boolean;
  writeEnv?: boolean;
  projectName?: string;
  sourceLocale?: string;
  targetLocales?: string;
  verbose?: boolean;
}

export interface RepoIdentityPayload {
  repoCanonical?: string;
  repoLabel?: string;
}

// Local configuration (from env vars)
export interface LocalConfig {
  apiKey: string;
  apiUrl: string;
}

// Project configuration (from API)
export interface APIProjectConfig {
  sourceLocale: string;
  targetLocales: string[];
  targetBranches: string[];
}

// Combined configuration used by CLI
export interface ProjectConfig extends LocalConfig, APIProjectConfig {
  extractionPattern: string | string[];
  excludePattern?: string | string[];
  timeout: number;
}

export interface ExtractedString {
  text: string;
  file: string;
  line: number;
  context?: string;
  formality?: 'formal' | 'informal' | 'auto';
}

export interface TranslationBatchResponse {
  batchId: string;
  newStrings: number;
  deletedStrings?: number;
  totalStrings: number;
  status: 'PENDING' | 'TRANSLATING' | 'COMPLETED' | 'FAILED' | 'UP_TO_DATE';
  noChanges?: boolean;
  estimatedTime?: number;
  translations?: Record<string, Record<string, string>>;
}

export interface TranslationStatusResponse {
  status: 'PENDING' | 'TRANSLATING' | 'COMPLETED' | 'FAILED';
  progress: number;
  jobs?: Array<{
    locale: string;
    status: string;
    progress: number;
  }>;
  translations?: Record<string, Record<string, string>>;
  localeMetadata?: Record<string, { nativeName: string; dir?: 'rtl' }>;
  errorMessage?: string;
}

export interface LimitErrorResponse {
  errorCode: 'LIMIT_EXCEEDED' | 'INSUFFICIENT_CREDITS';
  limitType:
    | 'organizations'
    | 'projects'
    | 'git_connections'
    | 'members'
    | 'providers'
    | 'translation_chars'
    | 'source_strings'
    | 'credits';
  planId: string;
  current: number;
  required: number;
  upgradeUrl: string;
  message: string;
}

export interface SyncPolicyErrorResponse {
  errorCode: 'BRANCH_NOT_ALLOWED' | 'PROJECT_REPOSITORY_MISMATCH';
  message: string;
  branch?: string;
  targetBranches?: string[];
  boundRepoLabel?: string | null;
}

export interface InitStartResponse {
  sessionId: string;
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  expiresAt: string;
  poll: {
    token: string;
    intervalSeconds: number;
  };
}

export type InitStatusResponse =
  | {
      status: 'pending';
      pollIntervalSeconds: number;
      expiresAt: string;
      message?: string;
    }
  | {
      status: 'failed';
      message: string;
    }
  | {
      status: 'completed';
      credentials: {
        apiKey: string;
        apiUrl: string;
        organizationId: string;
        organizationName: string;
        projectId: string;
        projectName: string;
        sourceLocale: string;
        targetLocales: string[];
      };
    };
