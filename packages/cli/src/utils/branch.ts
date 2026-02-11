import { execSync } from 'child_process';

/**
 * Detects the current git branch from multiple sources in priority order:
 * 1. Explicit --branch flag (passed as parameter)
 * 2. CI environment variables (GitHub Actions, Vercel, Netlify, etc.)
 * 3. Git command (local development)
 *
 * @param override - Optional branch name to override detection
 * @returns The current branch name
 */
export function detectBranch(override?: string): string {
  // 1. Explicit override (from --branch flag)
  if (override) {
    return override;
  }

  // 2. CI environment variables
  const envBranch =
    process.env.GITHUB_REF_NAME ||       // GitHub Actions
    process.env.VERCEL_GIT_COMMIT_REF || // Vercel
    process.env.BRANCH ||                // Netlify, generic
    process.env.CI_COMMIT_REF_NAME ||    // GitLab
    process.env.BITBUCKET_BRANCH ||      // Bitbucket
    process.env.CIRCLE_BRANCH;           // CircleCI

  if (envBranch) {
    return envBranch;
  }

  // 3. Git command (local development)
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();

    return branch;
  } catch (error) {
    throw new Error(
      'Failed to detect git branch. Make sure you are in a git repository or set the --branch flag.',
    );
  }
}

/**
 * Checks if the current branch is a target branch that should trigger translations
 *
 * @param currentBranch - The current branch name
 * @param targetBranches - List of branches that should trigger translations
 * @returns True if the branch should trigger translations
 */
export function isTargetBranch(
  currentBranch: string,
  targetBranches: string[],
): boolean {
  return targetBranches.includes(currentBranch);
}
