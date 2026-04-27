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

const SHA_REGEX = /^[0-9a-f]{40}$/i;

/**
 * Detect the current commit SHA from CI env vars, fuzzy env scan, or .git files.
 * Returns null if detection fails — callers should fall back to branch-based fingerprint.
 *
 * Priority:
 * 1. VOCODER_COMMIT_SHA — explicit override
 * 2. Known platform env vars
 * 3. Fuzzy scan of all env vars for 40-char hex values
 * 4. Git file fallback (.git/refs/heads/<branch> or .git/packed-refs)
 */
export function detectCommitSha(): string | null {
  // 1. Explicit override
  if (process.env.VOCODER_COMMIT_SHA && SHA_REGEX.test(process.env.VOCODER_COMMIT_SHA)) {
    return process.env.VOCODER_COMMIT_SHA;
  }

  // 2. Known platform env vars
  const knownSha =
    process.env.GITHUB_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.CI_COMMIT_SHA ||
    process.env.BITBUCKET_COMMIT ||
    process.env.CIRCLE_SHA1 ||
    process.env.RENDER_GIT_COMMIT;

  if (knownSha && SHA_REGEX.test(knownSha)) return knownSha;

  // 3. Fuzzy scan — look for any env var whose key suggests a SHA and value looks like one.
  // Sort entries deterministically (by key) so the result is stable across runs.
  const fuzzyMatch = Object.entries(process.env)
    .filter(([key, value]) => /sha|commit/i.test(key) && value && SHA_REGEX.test(value))
    .sort(([a], [b]) => a.localeCompare(b))[0];
  if (fuzzyMatch?.[1]) return fuzzyMatch[1];

  // 4. Git file fallback
  try {
    const gitDir = findGitDir(process.cwd());
    if (!gitDir) return null;

    const headPath = resolve(gitDir, 'HEAD');
    const headContent = readFileSync(headPath, 'utf-8').trim();

    // Detached HEAD — HEAD contains the SHA directly
    if (SHA_REGEX.test(headContent)) return headContent;

    // Symbolic ref — resolve to branch SHA
    const branchMatch = headContent.match(/^ref: refs\/heads\/(.+)$/);
    if (branchMatch?.[1]) {
      const branch = branchMatch[1];

      // Try loose ref file first
      const refPath = resolve(gitDir, 'refs', 'heads', branch);
      if (existsSync(refPath)) {
        const sha = readFileSync(refPath, 'utf-8').trim();
        if (SHA_REGEX.test(sha)) return sha;
      }

      // Fall back to packed-refs
      const packedRefsPath = resolve(gitDir, 'packed-refs');
      if (existsSync(packedRefsPath)) {
        const packedRefs = readFileSync(packedRefsPath, 'utf-8');
        const target = `refs/heads/${branch}`;
        for (const line of packedRefs.split('\n')) {
          if (line.endsWith(target)) {
            const sha = line.split(' ')[0]?.trim();
            if (sha && SHA_REGEX.test(sha)) return sha;
          }
        }
      }
    }
  } catch {
    // Non-fatal
  }

  return null;
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
 * Detect the repository identity from CI environment variables or .git/config.
 * CI env vars are checked first so Docker builds and shallow clones work
 * without a .git directory. Falls back to .git/config for local development.
 */
export function detectRepoIdentity(): RepoIdentity | null {
  const fromEnv = detectRepoIdentityFromEnv();
  if (fromEnv) return fromEnv;
  return detectRepoIdentityFromGit();
}

function detectRepoIdentityFromEnv(): RepoIdentity | null {
  // GitHub Actions: GITHUB_REPOSITORY = "owner/repo"
  if (process.env.GITHUB_REPOSITORY) {
    const canonical = `github:${process.env.GITHUB_REPOSITORY.toLowerCase()}`;
    return { repoCanonical: canonical, scopePath: '' };
  }

  // Vercel: VERCEL_GIT_REPO_OWNER + VERCEL_GIT_REPO_SLUG
  if (process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG) {
    const provider = (process.env.VERCEL_GIT_PROVIDER ?? 'github').toLowerCase();
    const ownerRepo = `${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}`.toLowerCase();
    const canonical = provider === 'github' ? `github:${ownerRepo}`
      : provider === 'gitlab' ? `gitlab:${ownerRepo}`
      : provider === 'bitbucket' ? `bitbucket:${ownerRepo}`
      : `git:${ownerRepo}`;
    return { repoCanonical: canonical, scopePath: '' };
  }

  // GitLab CI: CI_PROJECT_PATH = "owner/repo", CI_SERVER_HOST for non-gitlab.com
  if (process.env.CI_PROJECT_PATH) {
    const host = process.env.CI_SERVER_HOST ?? 'gitlab.com';
    const ownerRepo = process.env.CI_PROJECT_PATH.toLowerCase();
    const canonical = host.includes('gitlab.com') ? `gitlab:${ownerRepo}` : `git:${host}/${ownerRepo}`;
    return { repoCanonical: canonical, scopePath: '' };
  }

  // Bitbucket Pipelines: BITBUCKET_REPO_FULL_NAME = "owner/repo"
  if (process.env.BITBUCKET_REPO_FULL_NAME) {
    const canonical = `bitbucket:${process.env.BITBUCKET_REPO_FULL_NAME.toLowerCase()}`;
    return { repoCanonical: canonical, scopePath: '' };
  }

  // CircleCI: CIRCLE_PROJECT_USERNAME + CIRCLE_PROJECT_REPONAME
  if (process.env.CIRCLE_PROJECT_USERNAME && process.env.CIRCLE_PROJECT_REPONAME) {
    const ownerRepo = `${process.env.CIRCLE_PROJECT_USERNAME}/${process.env.CIRCLE_PROJECT_REPONAME}`.toLowerCase();
    const canonical = `github:${ownerRepo}`;
    return { repoCanonical: canonical, scopePath: '' };
  }

  return null;
}

function detectRepoIdentityFromGit(): RepoIdentity | null {
  const cwd = process.cwd();
  const gitDir = findGitDir(cwd);
  if (!gitDir) return null;

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
 * The server automatically waits for any in-flight translations to complete
 * before responding, avoiding build-time race conditions.
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
      signal: AbortSignal.timeout(45000),
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
