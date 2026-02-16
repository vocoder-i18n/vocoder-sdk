import { readFileSync, writeFileSync } from 'fs';
import { relative } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import * as readline from 'readline';
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

  try {
    // 1. Scan files
    const spinner = ora('Scanning files for unwrapped strings...').start();

    const analyzer = new StringAnalyzer(reactAdapter);
    const allCandidates = await analyzer.analyzeProject(options, projectRoot);

    if (allCandidates.length === 0) {
      spinner.succeed('No unwrapped strings found');
      console.log(chalk.dim('All user-facing strings appear to be wrapped already.'));
      return 0;
    }

    spinner.succeed(
      `Found ${chalk.cyan(allCandidates.length)} candidate strings`,
    );

    // 2. Filter by confidence
    const filtered = allCandidates.filter((c: WrapCandidate) =>
      meetsConfidenceThreshold(c.confidence, confidenceThreshold),
    );

    if (filtered.length === 0) {
      console.log(
        chalk.yellow(
          `No strings meet the ${chalk.bold(confidenceThreshold)} confidence threshold.`,
        ),
      );
      console.log(
        chalk.dim('Try --confidence medium or --confidence low to see more candidates.'),
      );
      return 0;
    }

    console.log(
      chalk.dim(
        `  ${filtered.length} strings meet ${confidenceThreshold} confidence threshold`,
      ),
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
      console.log(chalk.cyan('\nDry run - would wrap:\n'));

      for (const [file, candidates] of byFile) {
        const relPath = relative(projectRoot, file);
        console.log(chalk.bold(relPath));

        for (const c of candidates) {
          const confidenceColor =
            c.confidence === 'high' ? chalk.green :
            c.confidence === 'medium' ? chalk.yellow :
            chalk.red;

          const strategyLabel = c.strategy === 'T-component' ? '<T>' : 't()';
          console.log(
            `  ${chalk.dim(`L${c.line}`)} ${confidenceColor(`[${c.confidence}]`)} ` +
            `${chalk.cyan(strategyLabel)} ${chalk.white(`"${truncate(c.text, 50)}"`)}`
          );

          if (options.verbose) {
            console.log(chalk.dim(`        ${c.reason}`));
          }
        }
        console.log();
      }

      const summary = summarizeCandidates(filtered);
      console.log(chalk.dim(`Summary: ${summary}`));
      console.log(chalk.dim('\nRun without --dry-run to apply changes.'));
      return 0;
    }

    // 4. Interactive mode
    let accepted: WrapCandidate[];

    if (options.interactive) {
      accepted = await interactiveConfirm(byFile, projectRoot, options);
    } else {
      accepted = filtered;
    }

    if (accepted.length === 0) {
      console.log(chalk.yellow('No strings selected for wrapping.'));
      return 0;
    }

    // 5. Transform files
    spinner.start('Wrapping strings...');

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
        console.log(
          chalk.dim(`\n  Skipped ${result.skipped.length} strings in ${relPath}`),
        );
      }
    }

    spinner.succeed(
      `Wrapped ${chalk.cyan(totalWrapped)} strings across ${chalk.cyan(filesModified)} files`,
    );

    // 6. Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(chalk.green(`\nDone! (${duration}s)\n`));

    console.log(chalk.dim('Next steps:'));
    console.log(chalk.dim('  1. Review the changes (git diff)'));
    console.log(chalk.dim('  2. Run your tests to verify nothing broke'));
    console.log(chalk.dim('  3. Run "vocoder sync" to extract and translate'));
    return 0;

  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(chalk.red(`\nError: ${error.message}\n`));
      if (options.verbose) {
        console.error(chalk.dim('\nFull error:'), error);
      }
    }
    return 1;
  }
}

/**
 * Interactive confirmation mode.
 * Prompts user for each candidate (or group).
 */
async function interactiveConfirm(
  byFile: Map<string, WrapCandidate[]>,
  projectRoot: string,
  options: WrapOptions,
): Promise<WrapCandidate[]> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (question: string): Promise<string> =>
    new Promise((resolve) => rl.question(question, resolve));

  const accepted: WrapCandidate[] = [];
  let quit = false;

  console.log(
    chalk.cyan('\nInteractive mode - confirm each string:'),
  );
  console.log(
    chalk.dim('  (y)es  (n)o  (a)ll remaining  (s)kip file  (q)uit\n'),
  );

  for (const [file, candidates] of byFile) {
    if (quit) break;

    const relPath = relative(projectRoot, file);
    console.log(chalk.bold(relPath));

    let skipFile = false;

    for (const c of candidates) {
      if (quit || skipFile) break;

      const strategyLabel = c.strategy === 'T-component' ? '<T>' : 't()';
      console.log(
        `  ${chalk.dim(`L${c.line}`)} ${chalk.cyan(strategyLabel)} ` +
        `${chalk.white(`"${truncate(c.text, 60)}"`)}`
      );

      const answer = await ask('  Wrap? [y/n/a/s/q] ');

      switch (answer.toLowerCase().trim()) {
        case 'y':
        case 'yes':
          accepted.push(c);
          break;
        case 'n':
        case 'no':
          break;
        case 'a':
        case 'all':
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
          quit = true;
          break;
        case 's':
        case 'skip':
          skipFile = true;
          break;
        case 'q':
        case 'quit':
          quit = true;
          break;
        default:
          break;
      }
    }

    console.log();
  }

  rl.close();
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
