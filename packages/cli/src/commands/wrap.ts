import { readFileSync, writeFileSync } from 'fs';
import { relative } from 'path';
import * as p from '@clack/prompts';
import chalk from 'chalk';
import { StringAnalyzer } from '../utils/wrap/analyzer.js';
import { StringTransformer } from '../utils/wrap/transformer.js';
import { reactAdapter } from '../utils/wrap/adapters/react.js';
import type { WrapOptions, WrapCandidate, ConfidenceLevel } from '../utils/wrap/types.js';

const CONFIDENCE_ORDER: ConfidenceLevel[] = ['high', 'medium', 'low'];

function meetsConfidenceThreshold(
  candidate: ConfidenceLevel,
  threshold: ConfidenceLevel,
): boolean {
  return CONFIDENCE_ORDER.indexOf(candidate) <= CONFIDENCE_ORDER.indexOf(threshold);
}

/**
 * Main wrap command
 *
 * Workflow:
 * 1. Scan files for unwrapped strings
 * 2. Classify each string with heuristics
 * 3. Filter by confidence threshold
 * 4. Optionally preview (dry-run) or confirm (interactive)
 * 5. Transform files with <T> and t() wrappers
 * 6. Write transformed files
 */
export async function wrap(options: WrapOptions = {}): Promise<number> {
  const startTime = Date.now();
  const projectRoot = process.cwd();
  const confidenceThreshold = options.confidence || 'high';

  p.intro('Vocoder Wrap');

  const spinner = p.spinner();

  try {
    // 1. Scan files
    spinner.start('Scanning files for unwrapped strings');

    const analyzer = new StringAnalyzer(reactAdapter);
    const allCandidates = await analyzer.analyzeProject(options, projectRoot);

    if (allCandidates.length === 0) {
      spinner.stop('No unwrapped strings found');
      p.log.info('All user-facing strings appear to be wrapped already.');
      p.outro('');
      return 0;
    }

    spinner.stop(
      `Found ${chalk.cyan(allCandidates.length)} candidate strings`,
    );

    // 2. Filter by confidence
    const filtered = allCandidates.filter((c: WrapCandidate) =>
      meetsConfidenceThreshold(c.confidence, confidenceThreshold),
    );

    if (filtered.length === 0) {
      p.log.warn(
        `No strings meet the ${chalk.bold(confidenceThreshold)} confidence threshold.`,
      );
      p.log.info('Try --confidence medium or --confidence low to see more candidates.');
      p.outro('');
      return 0;
    }

    p.log.info(
      `${filtered.length} strings meet ${chalk.bold(confidenceThreshold)} confidence threshold`,
    );

    // Group candidates by file
    const byFile = new Map<string, WrapCandidate[]>();
    for (const c of filtered) {
      const existing = byFile.get(c.file) || [];
      existing.push(c);
      byFile.set(c.file, existing);
    }

    // 3. Dry-run mode
    if (options.dryRun) {
      const lines: string[] = [];
      for (const [file, candidates] of byFile) {
        const relPath = relative(projectRoot, file);
        lines.push(chalk.bold(relPath));

        for (const c of candidates) {
          const confidenceColor =
            c.confidence === 'high' ? chalk.green :
            c.confidence === 'medium' ? chalk.yellow :
            chalk.red;

          const strategyLabel = c.strategy === 'T-component' ? '<T>' : 't()';
          lines.push(
            `  ${chalk.dim(`L${c.line}`)} ${confidenceColor(`[${c.confidence}]`)} ` +
            `${chalk.cyan(strategyLabel)} "${truncate(c.text, 50)}"`,
          );

          if (options.verbose) {
            lines.push(chalk.dim(`        ${c.reason}`));
          }
        }
        lines.push('');
      }

      lines.push(summarizeCandidates(filtered));
      p.note(lines.join('\n'), 'Dry run — would wrap');
      p.outro('Run without --dry-run to apply changes.');
      return 0;
    }

    // 4. Interactive mode
    let accepted: WrapCandidate[];

    if (options.interactive) {
      accepted = await interactiveConfirm(byFile, projectRoot);
      if (accepted.length === 0) {
        p.log.warn('No strings selected for wrapping.');
        p.outro('');
        return 0;
      }
    } else {
      accepted = filtered;
    }

    // 5. Transform files
    spinner.start('Wrapping strings');

    const transformer = new StringTransformer(reactAdapter);
    let totalWrapped = 0;
    let filesModified = 0;

    // Group accepted candidates by file
    const acceptedByFile = new Map<string, WrapCandidate[]>();
    for (const c of accepted) {
      const existing = acceptedByFile.get(c.file) || [];
      existing.push(c);
      acceptedByFile.set(c.file, existing);
    }

    for (const [file, candidates] of acceptedByFile) {
      const code = readFileSync(file, 'utf-8');
      const result = transformer.transform(code, candidates, file);

      if (result.wrappedCount > 0) {
        writeFileSync(file, result.output, 'utf-8');
        totalWrapped += result.wrappedCount;
        filesModified++;
      }

      if (options.verbose && result.skipped.length > 0) {
        const relPath = relative(projectRoot, file);
        p.log.info(`Skipped ${result.skipped.length} strings in ${relPath}`);
      }
    }

    spinner.stop(
      `Wrapped ${chalk.cyan(totalWrapped)} strings across ${chalk.cyan(filesModified)} files`,
    );

    // 6. Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    p.outro(`Done! (${duration}s)`);

    p.log.info('Next steps:');
    p.log.info('  1. Review the changes (git diff)');
    p.log.info('  2. Run your tests to verify nothing broke');
    p.log.info('  3. Run "vocoder sync" to extract and translate');
    return 0;

  } catch (error: unknown) {
    spinner.stop();
    if (error instanceof Error) {
      p.log.error(error.message);
      if (options.verbose) {
        p.log.info(`Full error: ${error.stack ?? error}`);
      }
    }
    return 1;
  }
}

/**
 * Interactive confirmation mode.
 * Prompts user for each candidate using clack select.
 */
async function interactiveConfirm(
  byFile: Map<string, WrapCandidate[]>,
  projectRoot: string,
): Promise<WrapCandidate[]> {
  const accepted: WrapCandidate[] = [];

  p.log.info('Interactive mode — confirm each string:');

  for (const [file, candidates] of byFile) {
    const relPath = relative(projectRoot, file);
    p.log.step(chalk.bold(relPath));

    let skipFile = false;

    for (const c of candidates) {
      if (skipFile) break;

      const strategyLabel = c.strategy === 'T-component' ? '<T>' : 't()';
      const label = `L${c.line} ${strategyLabel} "${truncate(c.text, 50)}"`;

      const action = await p.select({
        message: label,
        options: [
          { value: 'yes', label: 'Yes, wrap this string' },
          { value: 'no', label: 'No, skip' },
          { value: 'all', label: 'Accept all remaining' },
          { value: 'skip', label: 'Skip this file' },
          { value: 'quit', label: 'Quit' },
        ],
      });

      if (p.isCancel(action) || action === 'quit') {
        return accepted;
      }

      if (action === 'yes') {
        accepted.push(c);
      } else if (action === 'all') {
        accepted.push(c);
        // Accept all remaining in this file
        const remaining = candidates.slice(candidates.indexOf(c) + 1);
        accepted.push(...remaining);
        // Accept all remaining files
        for (const [, moreCandidates] of byFile) {
          if (moreCandidates !== candidates) {
            accepted.push(...moreCandidates);
          }
        }
        return accepted;
      } else if (action === 'skip') {
        skipFile = true;
      }
      // 'no' — just continue
    }
  }

  return accepted;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

function summarizeCandidates(candidates: WrapCandidate[]): string {
  let high = 0;
  let medium = 0;
  let low = 0;
  let tComponent = 0;
  let tFunction = 0;

  for (const c of candidates) {
    if (c.confidence === 'high') high++;
    else if (c.confidence === 'medium') medium++;
    else low++;

    if (c.strategy === 'T-component') tComponent++;
    else tFunction++;
  }

  const parts: string[] = [];
  if (high > 0) parts.push(chalk.green(`${high} high`));
  if (medium > 0) parts.push(chalk.yellow(`${medium} medium`));
  if (low > 0) parts.push(chalk.red(`${low} low`));

  return `${candidates.length} total (${parts.join(', ')}) | ${tComponent} <T>, ${tFunction} t()`;
}
