#!/usr/bin/env node

import { Command } from 'commander';
import { sync } from './commands/sync.js';

const program = new Command();

program
  .name('vocoder')
  .description('Vocoder CLI - Sync translations for your application')
  .version('0.1.0');

program
  .command('sync')
  .description('Extract strings and sync translations')
  .option('--branch <name>', 'Override branch detection')
  .option('--force', 'Sync even if not a target branch')
  .option('--dry-run', 'Show what would be synced without doing it')
  .option('--verbose', 'Show detailed progress')
  .option('--max-age <seconds>', 'Use cache if younger than this (seconds)', parseInt)
  .action(sync);

program.parse(process.argv);
