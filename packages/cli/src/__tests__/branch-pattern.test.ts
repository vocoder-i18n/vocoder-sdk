import { describe, expect, it } from 'vitest';
import { isTargetBranch, matchBranchPattern } from '../utils/branch.js';

describe('branch pattern matching', () => {
  it('matches exact branch names', () => {
    expect(matchBranchPattern('main', 'main')).toBe(true);
    expect(matchBranchPattern('develop', 'main')).toBe(false);
  });

  it('matches single-star patterns within one path segment', () => {
    expect(matchBranchPattern('release/v1', 'release/*')).toBe(true);
    expect(matchBranchPattern('release/v1/hotfix', 'release/*')).toBe(false);
  });

  it('matches double-star patterns across path segments', () => {
    expect(matchBranchPattern('feature/mobile/ios', 'feature/**')).toBe(true);
    expect(matchBranchPattern('feature/mobile/ios', 'feature/*')).toBe(false);
  });

  it('checks if branch is part of allowlist patterns', () => {
    expect(isTargetBranch('main', ['release/*', 'main'])).toBe(true);
    expect(isTargetBranch('release/2026.01', ['release/*', 'main'])).toBe(true);
    expect(isTargetBranch('feature/new-ui', ['release/*', 'main'])).toBe(false);
  });
});
