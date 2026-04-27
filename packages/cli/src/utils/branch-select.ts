import { Prompt, isCancel } from '@clack/core';
import chalk from 'chalk';
import { execSync } from 'node:child_process';

// ── Symbols ───────────────────────────────────────────────────────────────────

const S_BAR     = '│';
const S_BAR_END = '└';
const S_ACTIVE  = '◆';
const S_SUBMIT  = '◆';
const S_CANCEL  = '■';
const S_ERROR   = '▲';

const noColor = process.env.NO_COLOR === '1' || process.env.FORCE_COLOR === '0';
const dim  = (s: string) => noColor ? s : chalk.gray(s);
const cyan = (s: string) => noColor ? s : chalk.cyan(s);
const grn  = (s: string) => noColor ? s : chalk.green(s);
const ylw  = (s: string) => noColor ? s : chalk.yellow(s);
const red  = (s: string) => noColor ? s : chalk.red(s);
const bld  = (s: string) => noColor ? s : chalk.bold(s);

function symbol(state: string): string {
  switch (state) {
    case 'submit': return grn(S_SUBMIT);
    case 'cancel': return red(S_CANCEL);
    case 'error':  return ylw(S_ERROR);
    default:       return cyan(S_ACTIVE);
  }
}

// ── Git detection ─────────────────────────────────────────────────────────────

export interface DetectedBranches {
  branches: string[];
  defaultBranch: string;
}

export function detectGitBranches(cwd?: string): DetectedBranches {
  const workDir = cwd ?? process.cwd();
  try {
    // Local branches
    const localOut = execSync('git branch', { cwd: workDir, stdio: 'pipe' }).toString();
    const localBranches = localOut.split('\n')
      .filter(Boolean)
      .map((b) => b.replace(/^\*?\s*/, '').trim())
      .filter(Boolean);

    // Remote branches (strip "origin/" prefix, skip HEAD pointer)
    let remoteBranches: string[] = [];
    try {
      const remoteOut = execSync('git branch -r', { cwd: workDir, stdio: 'pipe' }).toString();
      remoteBranches = remoteOut.split('\n')
        .map((b) => b.trim())
        .filter((b) => b && !b.includes('HEAD'))
        .map((b) => b.replace(/^[^/]+\//, '')); // strip "origin/" (or any remote name)
    } catch { /* no remote */ }

    const branches = [...new Set([...localBranches, ...remoteBranches])].sort();

    // Default branch: ask git for origin's HEAD (local cache, no network call).
    // Falls back to 'main' if the remote HEAD isn't cached.
    let defaultBranch = 'main';
    try {
      const ref = execSync('git symbolic-ref refs/remotes/origin/HEAD', { cwd: workDir, stdio: 'pipe' })
        .toString().trim();
      // ref = "refs/remotes/origin/main"
      defaultBranch = ref.split('/').pop() ?? 'main';
    } catch { /* HEAD not cached — run "git remote set-head origin --auto" to fix */ }

    return {
      branches: branches.length > 0 ? branches : [defaultBranch],
      defaultBranch,
    };
  } catch {
    return { branches: ['main'], defaultBranch: 'main' };
  }
}

// ── Validation ────────────────────────────────────────────────────────────────

const INVALID_CHARS = /[\s?^~:[\]\\]/;

export function validateBranchPattern(pattern: string): string | null {
  const t = pattern.trim();
  if (!t) return 'Pattern cannot be empty';
  if (INVALID_CHARS.test(t)) return 'Invalid characters — avoid spaces, ?, ^, ~, :, [, ], \\';
  if (t.startsWith('/') || t.endsWith('/')) return 'Cannot start or end with /';
  if (t.includes('//')) return 'Cannot contain //';
  return null;
}

// ── List renderer ─────────────────────────────────────────────────────────────

const MAX_VISIBLE = 10;
const ADD_PATTERN_VALUE = '__add__';

interface BranchItem {
  value: string;
  label: string;
  isCustom?: boolean;
}

function buildItems(
  branches: string[],
  defaultBranch: string,
  customPatterns: string[],
): BranchItem[] {
  const items: BranchItem[] = branches.map((b) => ({
    value: b,
    label: b === defaultBranch ? `${b} (default branch)` : b,
  }));
  for (const pt of customPatterns) {
    if (!branches.includes(pt)) {
      items.push({ value: pt, label: pt, isCustom: true });
    }
  }
  return items;
}

function filterItems(items: BranchItem[], query: string): BranchItem[] {
  if (!query.trim()) return items;
  const lower = query.toLowerCase();
  return items.filter((i) => i.value.toLowerCase().includes(lower));
}

function buildList(
  filtered: BranchItem[],
  cursor: number,
  scrollOffset: number,
  selected: Set<string>,
  filter: string,
  customPatterns: string[],
  addCursor: boolean,
): string {
  const lines: string[] = [];
  const end = Math.min(filtered.length, scrollOffset + MAX_VISIBLE);

  for (let i = scrollOffset; i < end; i++) {
    const item = filtered[i]!;
    const isCursor = i === cursor && !addCursor;
    const isChecked = selected.has(item.value);

    const icon = isChecked
      ? (isCursor ? grn('◼') : '◼')
      : (isCursor ? grn('◻') : dim('◻'));

    let label = item.isCustom ? `${item.label} ${dim('(custom)')}` : item.label;
    if (isCursor) label = bld(label);

    lines.push(`${cyan(S_BAR)}  ${icon}  ${label}`);
  }

  // "Add pattern" option
  const trimmed = filter.trim();
  const allItems = [...filtered]; // simplified: just check filtered
  const isNewPattern =
    trimmed.length > 0 &&
    !allItems.some((i) => i.value === trimmed) &&
    !customPatterns.includes(trimmed);

  if (isNewPattern) {
    const err = validateBranchPattern(trimmed);
    const icon = addCursor ? grn('◻') : dim('◻');
    const label = err
      ? `${ylw('+')}  ${dim(`"${trimmed}" — ${err}`)}`
      : `${grn('+')}  Add "${trimmed}" as branch pattern`;
    lines.push(`${cyan(S_BAR)}  ${icon}  ${label}`);
  } else if (filtered.length === 0 && trimmed.length === 0) {
    lines.push(dim(`${S_BAR}  No branches detected`));
  }

  const hidden = filtered.length - (end - scrollOffset);
  if (hidden > 0) lines.push(dim(`${S_BAR}  ${hidden} more`));
  if (selected.size > 0) lines.push(dim(`${S_BAR}  ${selected.size} selected — Enter to confirm`));

  return lines.join('\n');
}

// ── Component ─────────────────────────────────────────────────────────────────

export async function filterableBranchSelect(params: {
  message: string;
  branches: string[];
  defaultBranch: string;
  initialValues?: string[];
}): Promise<string[] | null> {
  const { message, branches, defaultBranch } = params;

  let filter = '';
  let cursor = 0;
  let scrollOffset = 0;
  let addCursor = false;
  const customPatterns: string[] = [];
  const selected = new Set<string>(params.initialValues ?? [defaultBranch]);

  const getItems = () => buildItems(branches, defaultBranch, customPatterns);
  const getFiltered = () => filterItems(getItems(), filter);

  const isNewPattern = () => {
    const t = filter.trim();
    if (!t) return false;
    return !getItems().some((i) => i.value === t) && !customPatterns.includes(t);
  };

  const clampCursor = (filtered: BranchItem[]) => {
    const hasAdd = isNewPattern();
    const max = filtered.length - 1 + (hasAdd ? 1 : 0);
    if (cursor > max && !addCursor) cursor = Math.max(0, max);
    if (!addCursor) {
      if (cursor < scrollOffset) scrollOffset = cursor;
      if (cursor >= scrollOffset + MAX_VISIBLE) scrollOffset = cursor - MAX_VISIBLE + 1;
      if (scrollOffset < 0) scrollOffset = 0;
    }
  };

  const prompt = new (Prompt as any)(
    {
      validate() {
        if (selected.size === 0) return 'At least one branch is required.';
        return undefined;
      },
      render(this: { state: string; error: string }) {
        const filtered = getFiltered();
        clampCursor(filtered);

        const hdr = `${dim(S_BAR)}\n${symbol(this.state)}  ${message}\n`;
        const hint = filter.length > 0
          ? filter
          : dim('type to filter or add pattern, ↑↓ navigate, space select');

        switch (this.state) {
          case 'submit': {
            const summary = selected.size > 0
              ? bld(Array.from(selected).join(', '))
              : dim('none');
            return `${hdr}${dim(S_BAR)}  ${summary}`;
          }
          case 'cancel':
            return `${hdr}${dim(S_BAR)}`;
          case 'error':
            return [
              hdr.trimEnd(),
              `${ylw(S_BAR)}  ${dim('/')} ${hint}`,
              buildList(filtered, cursor, scrollOffset, selected, filter, customPatterns, addCursor),
              `${ylw(S_BAR_END)}  ${ylw(this.error)}`,
              '',
            ].join('\n');
          default:
            return [
              hdr.trimEnd(),
              `${cyan(S_BAR)}  ${dim('/')} ${hint}`,
              buildList(filtered, cursor, scrollOffset, selected, filter, customPatterns, addCursor),
              `${cyan(S_BAR_END)}`,
              '',
            ].join('\n');
        }
      },
    },
    false,
  ) as InstanceType<typeof Prompt> & { value: unknown; state: string };

  prompt.on('key', (key: string | undefined) => {
    if (!key || key === ' ') return;
    const cp = key.codePointAt(0) ?? 0;
    if (cp === 0x7f || cp === 0x08) {
      filter = filter.slice(0, -1);
      cursor = 0; scrollOffset = 0; addCursor = false;
    } else if (cp >= 32 && cp !== 127) {
      filter += key;
      cursor = 0; scrollOffset = 0; addCursor = false;
    }
  });

  prompt.on('cursor', (action: string | undefined) => {
    const filtered = getFiltered();
    const hasAdd = isNewPattern();

    switch (action) {
      case 'up':
        if (addCursor) { addCursor = false; cursor = Math.max(0, filtered.length - 1); }
        else cursor = Math.max(0, cursor - 1);
        break;
      case 'down':
        if (!addCursor && cursor >= filtered.length - 1 && hasAdd) addCursor = true;
        else if (!addCursor) cursor = Math.min(filtered.length - 1, cursor + 1);
        break;
      case 'space':
        if (addCursor) {
          const t = filter.trim();
          const err = validateBranchPattern(t);
          if (!err) {
            customPatterns.push(t);
            selected.add(t);
            filter = '';
            cursor = 0; scrollOffset = 0; addCursor = false;
          }
        } else {
          const item = filtered[cursor];
          if (item) {
            if (selected.has(item.value)) selected.delete(item.value);
            else selected.add(item.value);
          }
        }
        break;
    }
  });

  prompt.on('finalize', () => {
    if ((prompt as any).state === 'submit') {
      (prompt as any).value = Array.from(selected);
    }
  });

  const result = await prompt.prompt();
  if (isCancel(result)) return null;
  return result as string[];
}
