import { createHash } from 'node:crypto';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import type { VocoderPluginOptions, VocoderTranslationData } from './types';

/**
 * Load .env file into process.env if not already loaded.
 * Build plugins run before the bundler's own .env loading,
 * so we need to handle it ourselves.
 */
export function loadEnvFile(): void {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;

  try {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, '');
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // Non-fatal
  }
}

export type RepoIdentity = {
  repoCanonical: string;
  scopePath: string;
};

/**
 * Compute the opaque fingerprint from repo identity + branch.
 * Formula: sha256(repoCanonical + ":" + scopePath + ":" + branch).slice(0, 12)
 *
 * Must match the server-side formula in lib/vocoder/fingerprint.ts.
 */
export function computeFingerprint(repoCanonical: string, scopePath: string, branch: string): string {
  return createHash('sha256')
    .update(`${repoCanonical}:${scopePath}:${branch}`)
    .digest('hex')
    .slice(0, 12);
}

/**
 * Detect the current git branch from CI env vars or .git/HEAD.
 * No execSync — reads .git/HEAD directly for safety in build plugins.
 */
export function detectBranch(): string {
  const envBranch =
    process.env.GITHUB_HEAD_REF ||
    process.env.GITHUB_REF_NAME ||
    process.env.VERCEL_GIT_COMMIT_REF ||
    process.env.BRANCH ||
    process.env.CF_PAGES_BRANCH ||
    process.env.CI_COMMIT_REF_NAME ||
    process.env.BITBUCKET_BRANCH ||
    process.env.CIRCLE_BRANCH ||
    process.env.RENDER_GIT_BRANCH;

  if (envBranch) return envBranch;

  try {
    const gitDir = findGitDir(process.cwd());
    if (gitDir) {
      const headPath = resolve(gitDir, 'HEAD');
      const content = readFileSync(headPath, 'utf-8').trim();
      const match = content.match(/^ref: refs\/heads\/(.+)$/);
      if (match?.[1]) return match[1];
    }
  } catch {
    // Fall through to default
  }

  return 'main';
}

/**
 * Walk up from startDir to find the .git directory.
 */
function findGitDir(startDir: string): string | null {
  let dir = startDir;
  for (let i = 0; i < 20; i++) {
    const gitDir = resolve(dir, '.git');
    if (existsSync(gitDir)) return gitDir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * Detect the repository identity by reading .git/config.
 * Returns the canonical repo identifier and scope path (for monorepos).
 * No execSync — reads files directly for safety in build plugins.
 */
export function detectRepoIdentity(): RepoIdentity | null {
  const cwd = process.cwd();
  const gitDir = findGitDir(cwd);
  if (!gitDir) return null;

  // Read remote URL from .git/config
  const configPath = resolve(gitDir, 'config');
  if (!existsSync(configPath)) return null;

  try {
    const content = readFileSync(configPath, 'utf-8');
    const remoteUrl = parseGitConfigRemoteUrl(content);
    if (!remoteUrl) return null;

    const parsed = parseRemoteUrl(remoteUrl);
    if (!parsed) return null;

    const repoCanonical = toCanonical(parsed.host, parsed.ownerRepoPath);

    // Compute scope path: relative path from git root to cwd
    const gitRoot = dirname(gitDir);
    const rel = relative(gitRoot, cwd).replace(/\\/g, '/').trim();
    const scopePath = (rel && rel !== '.' && !rel.startsWith('..')) ? rel : '';

    return { repoCanonical, scopePath };
  } catch {
    return null;
  }
}

/**
 * Parse the origin remote URL from .git/config content.
 */
function parseGitConfigRemoteUrl(content: string): string | null {
  const lines = content.split('\n');
  let inOriginRemote = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '[remote "origin"]') {
      inOriginRemote = true;
      continue;
    }

    if (inOriginRemote) {
      if (trimmed.startsWith('[')) {
        break; // Entered a new section
      }
      const match = trimmed.match(/^url\s*=\s*(.+)$/);
      if (match?.[1]) return match[1].trim();
    }
  }

  return null;
}

/**
 * Parse a git remote URL into host + owner/repo path.
 * Supports both HTTPS and SCP-style SSH URLs.
 */
function parseRemoteUrl(remoteUrl: string): { host: string; ownerRepoPath: string } | null {
  const trimmed = remoteUrl.trim();
  if (!trimmed) return null;

  // SCP-like syntax: git@github.com:owner/repo.git
  if (!trimmed.includes('://')) {
    const scpMatch = trimmed.match(/^(?:.+@)?([^:]+):(.+)$/);
    if (scpMatch) {
      const host = (scpMatch[1] || '').toLowerCase();
      const ownerRepoPath = normalizePath(scpMatch[2] || '');
      if (!host || !ownerRepoPath) return null;
      return { host, ownerRepoPath };
    }
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    const ownerRepoPath = normalizePath(decodeURIComponent(parsed.pathname));
    if (!host || !ownerRepoPath) return null;
    return { host, ownerRepoPath };
  } catch {
    return null;
  }
}

function normalizePath(pathname: string): string | null {
  const cleaned = pathname
    .replace(/^\/+/, '')
    .replace(/\.git$/i, '')
    .trim();

  if (!cleaned || !cleaned.includes('/')) return null;
  return cleaned;
}

function toCanonical(host: string, ownerRepoPath: string): string {
  if (host.includes('github.com')) return `github:${ownerRepoPath.toLowerCase()}`;
  if (host.includes('gitlab.com')) return `gitlab:${ownerRepoPath.toLowerCase()}`;
  if (host.includes('bitbucket.org')) return `bitbucket:${ownerRepoPath.toLowerCase()}`;
  return `git:${host}/${ownerRepoPath.toLowerCase()}`;
}

/**
 * Fetch all translations from the Vocoder API for a given fingerprint.
 * Falls back to disk cache if the API is unreachable.
 */
export async function fetchTranslations(
  fingerprint: string,
  apiUrl: string,
): Promise<VocoderTranslationData> {
  const url = `${apiUrl}/api/t/${fingerprint}`;
  const cacheDir = resolve(process.cwd(), 'node_modules', '.vocoder', 'cache');
  const cacheFile = resolve(cacheDir, `${fingerprint}.json`);

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = (await response.json()) as VocoderTranslationData;

    // Cache to disk for offline fallback
    try {
      mkdirSync(cacheDir, { recursive: true });
      writeFileSync(cacheFile, JSON.stringify(data), 'utf-8');
    } catch {
      // Non-fatal: caching failed
    }

    return data;
  } catch (error) {
    // Try disk cache fallback
    if (existsSync(cacheFile)) {
      try {
        const cached = JSON.parse(readFileSync(cacheFile, 'utf-8')) as VocoderTranslationData;
        console.warn('[vocoder] API unreachable, using cached translations.');
        return cached;
      } catch {
        // Cache corrupted
      }
    }

    console.warn(
      `[vocoder] Could not fetch translations: ${error instanceof Error ? error.message : 'Unknown error'}. Build will proceed with empty translations.`,
    );

    return {
      config: { sourceLocale: '', targetLocales: [], locales: {} },
      translations: {},
      updatedAt: null,
    };
  }
}
