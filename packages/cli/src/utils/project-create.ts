import * as p from '@clack/prompts';
import chalk from 'chalk';
import type { VocoderAPI } from './api.js';
import type { LocaleOption } from './locale-search.js';
import { searchMultiSelectLocales, searchSelectLocale } from './locale-search.js';
import { detectGitBranches, filterableBranchSelect } from './branch-select.js';

export interface ProjectCreateParams {
  api: VocoderAPI;
  userToken: string;
  organizationId: string;
  /** Default project name (repo name or directory name) */
  defaultName?: string;
  /** Pre-detected source locale, e.g. "en" */
  defaultSourceLocale?: string;
  /** Repo canonical for binding the project, e.g. "github:owner/repo" */
  repoCanonical?: string;
  /** Default target branches */
  defaultBranches?: string[];
  /**
   * Auto-detected scope path (CWD relative to git root).
   * Non-empty when running from a subdirectory of the repo — monorepo use case.
   * e.g. "apps/web"
   */
  defaultScopePath?: string;
}

export interface ProjectCreateResult {
  projectId: string;
  projectName: string;
  apiKey: string;
  sourceLocale: string;
  targetLocales: string[];
  translationTriggers: string[];
  repositoryBound: boolean;
  configureUrl?: string;
}

/** All locales — used for target language selection. */
function buildLocaleOptions(
  locales: Array<{ code: string; name: string; nativeName?: string }>,
): LocaleOption[] {
  return locales.map((l) => ({
    bcp47: l.code,
    label: `${l.name} — ${l.code}`,
  }));
}

/**
 * Deduplicated language list — used for source language selection.
 * Groups locales by language family (prefix before first hyphen) and keeps one
 * representative per family, preferring the shortest/base code (e.g. "en" over
 * "en-US"). This prevents showing "English", "English (American)", "English
 * (British)" as three separate choices when the user just means "English".
 */
function buildLanguageOptions(
  locales: Array<{ code: string; name: string; nativeName?: string }>,
): LocaleOption[] {
  const byFamily = new Map<string, LocaleOption>();

  for (const l of locales) {
    const family = l.code.split('-')[0]!.toLowerCase();
    const opt: LocaleOption = { bcp47: l.code, label: `${l.name} — ${l.code}` };
    const existing = byFamily.get(family);
    // Prefer base code (shorter, no region suffix) over regional variants
    if (!existing || l.code.length < existing.bcp47.length) {
      byFamily.set(family, opt);
    }
  }

  return Array.from(byFamily.values());
}

/**
 * Run the full project configuration TUI: prompts for name, source locale,
 * target locales, and target branches, then calls POST /api/cli/projects.
 *
 * Returns the created project info (including API key), or null if cancelled.
 */
export async function runProjectCreate(
  params: ProjectCreateParams,
): Promise<ProjectCreateResult | null> {
  const { api, userToken, organizationId, repoCanonical } = params;

  // ── Project name ────────────────────────────────────────────────────────────
  // Use the detected repo name automatically — no prompt needed.
  const projectName = (params.defaultName ?? 'my-project').trim();
  p.log.success(`Project: ${chalk.bold(projectName)}`);

  // ── Fetch available locales ─────────────────────────────────────────────────
  let rawLocales: Array<{ code: string; name: string; nativeName?: string }>;
  try {
    rawLocales = await api.listLocales(userToken);
  } catch {
    p.log.error('Failed to fetch supported locales. Check your connection and try again.');
    return null;
  }

  // Source: deduplicated by language family (e.g. just "English — en", not all variants)
  const languageOptions = buildLanguageOptions(rawLocales);
  // Target: all locales (regional variants matter for translation targets)
  const localeOptions = buildLocaleOptions(rawLocales);

  // ── Scope path (monorepo) ───────────────────────────────────────────────────
  // Pre-fill with the auto-detected subdir path. Empty = entire repo.
  const rawScope = await p.text({
    message: 'App directory (leave blank for the entire repo)',
    placeholder: 'e.g. apps/web',
    initialValue: params.defaultScopePath ?? '',
    validate(value) {
      const v = value.trim();
      if (!v) return; // blank is valid — means root
      if (v.startsWith('/')) return 'Use a relative path, not an absolute path';
      if (v.includes('..')) return 'Path must not contain ".."';
    },
  });
  if (p.isCancel(rawScope)) return null;
  const scopePath = (rawScope as string).trim();

  // ── Source locale ───────────────────────────────────────────────────────────
  const sourceLocale = await searchSelectLocale(
    languageOptions,
    'Source language (the language your code is written in)',
    params.defaultSourceLocale ?? 'en',
  );

  if (sourceLocale === null) return null;

  // ── Target locales ──────────────────────────────────────────────────────────
  // Exclude the exact source locale; regional variants (e.g. en-GB when source=en) remain available
  const targetOptions = localeOptions.filter((opt) => opt.bcp47 !== sourceLocale);

  const targetLocales = await searchMultiSelectLocales(
    targetOptions,
    'Target languages (languages to translate into)',
  );

  if (targetLocales === null) return null;

  if (targetLocales.length === 0) {
    p.log.warn('No target languages selected — you can add them later from the dashboard.');
  }

  // ── Target branches ─────────────────────────────────────────────────────────
  const detected = detectGitBranches();
  const initialBranches = params.defaultBranches?.length
    ? params.defaultBranches
    : [detected.defaultBranch];

  let targetBranches: string[] = [];
  {
    let initial = initialBranches;
    while (targetBranches.length === 0) {
      const result = await filterableBranchSelect({
        message: 'Target branches (translations will run when you push to these)',
        branches: detected.branches,
        defaultBranch: detected.defaultBranch,
        initialValues: initial,
      });
      if (result === null) return null;
      if (result.length === 0) {
        p.log.warn('At least one branch is required. Please select at least one.');
        initial = [detected.defaultBranch];
      } else {
        targetBranches = result;
      }
    }
  }

  // ── Create project ──────────────────────────────────────────────────────────
  try {
    const result = await api.createProject(userToken, {
      organizationId,
      name: projectName,
      sourceLocale,
      targetLocales,
      targetBranches,
      translationTriggers: ['push'],
      scopePaths: scopePath ? [scopePath] : [],
      repoCanonical,
    });

    p.log.success(`Project ${chalk.bold(result.projectName)} created!`);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    p.log.error(`Failed to create project: ${message}`);
    return null;
  }
}
