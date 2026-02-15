#!/usr/bin/env node

import { Command } from 'commander';
import { sync } from './commands/sync.js';
import { wrap } from './commands/wrap.js';

/**
 * Collector function for repeated CLI options
 * Allows multiple --include or --exclude flags
 */
function collect(value: string, previous: string[] = []): string[] {
  return previous.concat([value]);
}

const program = new Command();

program
  .name('vocoder')
  .description('Vocoder CLI - Sync translations for your application')
  .version('0.1.0');

program
  .command('sync')
  .description('Extract strings and sync translations')
  .option('--include <pattern>', 'Glob pattern(s) to include (can be used multiple times)', collect, [])
  .option('--exclude <pattern>', 'Glob pattern(s) to exclude (can be used multiple times)', collect, [])
  .option('--branch <name>', 'Override branch detection')
  .option('--force', 'Sync even if not a target branch')
  .option('--dry-run', 'Show what would be synced without doing it')
  .option('--verbose', 'Show detailed progress')
  .option('--max-age <seconds>', 'Use cache if younger than this (seconds)', parseInt)
  .action(sync);

program
  .command('wrap')
  .description('Auto-wrap strings with <T> and t() for translation')
  .option('--include <pattern>', 'Glob pattern(s) to include (can be used multiple times)', collect, [])
  .option('--exclude <pattern>', 'Glob pattern(s) to exclude (can be used multiple times)', collect, [])
  .option('--dry-run', 'Preview changes without modifying files')
  .option('--interactive', 'Confirm each string interactively')
  .option('--confidence <level>', 'Minimum confidence: high, medium, low', 'high')
  .option('--verbose', 'Detailed output')
  .action(wrap);

program.parse(process.argv);
