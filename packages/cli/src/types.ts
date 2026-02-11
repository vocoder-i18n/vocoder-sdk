export interface TranslateOptions {
  branch?: string;
  force?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  maxAge?: number;
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
  extractionPattern: string;
  outputDir: string;
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
