import { execSync } from 'child_process';

export type GitRepositoryIdentity = {
  repoCanonical: string;
  repoLabel: string;
};

export type GitContext = {
  identity: GitRepositoryIdentity | null;
  branch: string | null;
  warnings: string[];
};

function safeExec(command: string): string | null {
  try {
    const output = execSync(command, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
    return output.length > 0 ? output : null;
  } catch {
    return null;
  }
}

function normalizePath(pathname: string): string | null {
  const cleaned = pathname
    .replace(/^\/+/, '')
    .replace(/\.git$/i, '')
    .trim();

  if (!cleaned || !cleaned.includes('/')) {
    return null;
  }

  return cleaned;
}

function parseRemoteUrl(remoteUrl: string): {
  host: string;
  ownerRepoPath: string;
} | null {
  const trimmed = remoteUrl.trim();
  if (!trimmed) {
    return null;
  }

  // SCP-like syntax: git@github.com:owner/repo.git
  if (!trimmed.includes('://')) {
    const scpMatch = trimmed.match(/^(?:.+@)?([^:]+):(.+)$/);
    if (scpMatch) {
      const host = (scpMatch[1] || '').toLowerCase();
      const ownerRepoPath = normalizePath(scpMatch[2] || '');
      if (!host || !ownerRepoPath) {
        return null;
      }
      return { host, ownerRepoPath };
    }
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    const ownerRepoPath = normalizePath(decodeURIComponent(parsed.pathname));
    if (!host || !ownerRepoPath) {
      return null;
    }
    return { host, ownerRepoPath };
  } catch {
    return null;
  }
}

function toCanonical(host: string, ownerRepoPath: string): string {
  if (host.includes('github.com')) {
    return `github:${ownerRepoPath.toLowerCase()}`;
  }
  if (host.includes('gitlab.com')) {
    return `gitlab:${ownerRepoPath.toLowerCase()}`;
  }
  if (host.includes('bitbucket.org')) {
    return `bitbucket:${ownerRepoPath.toLowerCase()}`;
  }
  return `git:${host}/${ownerRepoPath.toLowerCase()}`;
}

export function resolveGitRepositoryIdentity(): GitRepositoryIdentity | null {
  const remoteUrl = safeExec('git config --get remote.origin.url');
  if (!remoteUrl) {
    return null;
  }

  const parsed = parseRemoteUrl(remoteUrl);
  if (!parsed) {
    return null;
  }

  return {
    repoCanonical: toCanonical(parsed.host, parsed.ownerRepoPath),
    repoLabel: parsed.ownerRepoPath,
  };
}

export function detectBranchFromGitCommand(): string | null {
  const branch = safeExec('git rev-parse --abbrev-ref HEAD');
  if (!branch || branch === 'HEAD') {
    return null;
  }
  return branch;
}

export function resolveGitContext(): GitContext {
  const warnings: string[] = [];
  const identity = resolveGitRepositoryIdentity();
  const branch = detectBranchFromGitCommand();

  if (!identity) {
    warnings.push(
      'Could not detect git remote origin. Repo binding will be skipped until sync can detect it.',
    );
  }

  if (!branch) {
    warnings.push(
      'Could not detect the current git branch. Target branches will use defaults unless you change them in setup.',
    );
  }

  return { identity, branch, warnings };
}
