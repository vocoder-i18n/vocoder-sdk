#!/usr/bin/env node

import { Command } from 'commander';
import { init } from './commands/init.js';
import { sync } from './commands/sync.js';
import { wrap } from './commands/wrap.js';

/**
 * Collector function for repeated CLI options
 * Allows multiple --include or --exclude flags
 */
function collect(value: string, previous: string[] = []): string[] {
  return previous.concat([value]);
}

async function runCommand(command: (options: any) => Promise<number>, options: any): Promise<void> {
  const exitCode = await command(options);
  process.exitCode = exitCode;
}

const program = new Command();

program
  .name('vocoder')
  .description('Vocoder CLI - Project setup and string extraction')
  .version('0.1.5');

program
  .command('wrap')
  .description('Auto-wrap strings with <T> and t() for translation')
  .option('--include <pattern>', 'Glob pattern(s) to include (can be used multiple times)', collect, [])
  .option('--exclude <pattern>', 'Glob pattern(s) to exclude (can be used multiple times)', collect, [])
  .option('--dry-run', 'Preview changes without modifying files')
  .option('--interactive', 'Confirm each string interactively')
  .option('--confidence <level>', 'Minimum confidence: high, medium, low', 'high')
  .option('--verbose', 'Detailed output')
  .action((options) => runCommand(wrap, options));

program
  .command('init')
  .description('Authenticate and provision Vocoder for this project')
  .option('--api-url <url>', 'Override Vocoder API URL')
  .option('--yes', 'Allow overwriting existing local config values')
  .option('--project-name <name>', 'Starter project name to create')
  .option('--source-locale <locale>', 'Source locale for the starter project')
  .option('--target-locales <list>', 'Comma-separated target locales (e.g. es,fr,de)')
  .action((options) => runCommand(init, options));

program
  .command('sync')
  .description('Extract strings and sync translations')
  .option('--branch <branch>', 'Override detected branch')
  .option('--mode <mode>', 'Sync mode: auto, required, best-effort', 'auto')
  .option('--max-wait <ms>', 'Max wait for translations (ms)')
  .option('--force', 'Force re-extraction even if no changes')
  .option('--dry-run', 'Preview without syncing')
  .option('--no-fallback', 'Disable fallback to cached translations')
  .option('--include <pattern>', 'Include glob pattern', collect, [])
  .option('--exclude <pattern>', 'Exclude glob pattern', collect, [])
  .option('--verbose', 'Detailed output')
  .action((options) => {
    const translated: Record<string, unknown> = { ...options };
    if (options.maxWait) translated.maxWaitMs = Number(options.maxWait);
    if (options.fallback === false) translated.noFallback = true;
    return runCommand(sync, translated);
  });

program.parse(process.argv);
