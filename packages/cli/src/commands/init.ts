import * as p from '@clack/prompts';
import chalk from 'chalk';

import { VocoderAPI } from '../utils/api.js';
import {
  buildInstallCommand,
  detectLocalEcosystem,
  getPackagesToInstall,
} from '../utils/detect-local.js';
import { getSetupSnippets } from '../utils/setup-snippets.js';

import type { InitOptions } from '../types.js';
import { resolveGitContext } from '../utils/git-identity.js';
import { config as loadEnv } from 'dotenv';

loadEnv();
import { execSync } from 'node:child_process';
import { spawn } from 'node:child_process';

const SUBSCRIPTION_SETTINGS_PATH = '/dashboard/workspace/settings?tab=subscription';

function parseTargetLocales(value?: string): string[] | undefined {
  if (!value) return undefined;

  const locales = value
    .split(',')
    .map((locale: string) => locale.trim())
    .filter(Boolean);

  return locales.length > 0 ? locales : undefined;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryOpenBrowser(url: string): Promise<boolean> {
  if (!process.stdout.isTTY || process.env.CI === 'true') {
    return false;
  }

  let command: string;
  let args: string[];

  if (process.platform === 'darwin') {
    command = 'open';
    args = [url];
  } else if (process.platform === 'win32') {
    command = 'rundll32';
    args = ['url.dll,FileProtocolHandler', url];
  } else {
    command = 'xdg-open';
    args = [url];
  }

  return await new Promise<boolean>((resolve) => {
    try {
      const child = spawn(command, args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });

      let settled = false;
      child.once('spawn', () => {
        if (settled) return;
        settled = true;
        child.unref();
        resolve(true);
      });
      child.once('error', () => {
        if (settled) return;
        settled = true;
        resolve(false);
      });
      setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve(false);
      }, 300);
    } catch {
      resolve(false);
    }
  });
}

function isPlanLimitFailure(message?: string): boolean {
  if (!message) return false;
  return /limit|upgrade/i.test(message);
}

function getSubscriptionSettingsUrl(apiUrl: string): string {
  return new URL(SUBSCRIPTION_SETTINGS_PATH, apiUrl).toString();
}

function printPlanLimitMessage(apiUrl: string, message: string): void {
  p.log.error(`You are over your plan limits.\n   ${message}`);
  p.log.info(`Manage subscription: ${getSubscriptionSettingsUrl(apiUrl)}`);
}

interface ScaffoldParams {
  projectName: string;
  organizationName: string;
  sourceLocale: string;
  translationTriggers: string[];
}

function runScaffold(params: ScaffoldParams): void {
  const { projectName, organizationName, sourceLocale, translationTriggers } = params;

  p.log.info(`Project:   ${chalk.bold(projectName)}`);
  p.log.info(`Workspace: ${chalk.bold(organizationName)}`);

  // Detect local ecosystem
  const detection = detectLocalEcosystem();

  if (detection.ecosystem) {
    const frameworkLabel = detection.framework ?? detection.ecosystem;
    const pmLabel = detection.packageManager;
    p.log.info(`Detected:  ${chalk.bold(frameworkLabel)} (${pmLabel})`);
  }

  // Install packages
  const packagesToInstall = getPackagesToInstall(detection);
  if (packagesToInstall.length > 0) {
    const installCmd = buildInstallCommand(detection.packageManager, packagesToInstall);
    p.log.info('');
    const installSpinner = p.spinner();
    installSpinner.start(`Installing ${packagesToInstall.join(', ')}...`);

    try {
      execSync(installCmd, { stdio: 'pipe', cwd: process.cwd() });
      installSpinner.stop(`Installed ${packagesToInstall.join(', ')}`);
    } catch {
      installSpinner.stop('Package installation failed');
      p.log.warn(`Run manually: ${chalk.cyan(installCmd)}`);
    }
  } else if (detection.ecosystem) {
    p.log.info(`Packages:  ${chalk.green('already installed')}`);
  }

  // Print setup snippets
  const snippets = getSetupSnippets({
    framework: detection.framework,
    ecosystem: detection.ecosystem,
    sourceLocale,
    translationTriggers,
  });

  let stepNum = 1;

  if (snippets.pluginStep) {
    p.log.message('');
    p.log.step(`${chalk.bold(`Step ${stepNum}:`)} Add the plugin to ${chalk.cyan(snippets.pluginStep.file)}`);
    printCodeBlock(snippets.pluginStep.code);
    stepNum++;
  }

  if (snippets.providerStep) {
    p.log.step(`${chalk.bold(`Step ${stepNum}:`)} Add the provider to ${chalk.cyan(snippets.providerStep.file)}`);
    printCodeBlock(snippets.providerStep.code);
    stepNum++;
  }

  p.log.step(`${chalk.bold(`Step ${stepNum}:`)} Wrap translatable strings`);
  printCodeBlock(snippets.wrapStep.code);

  // What's next
  p.log.message('');
  for (const line of snippets.whatsNext.split('\n')) {
    p.log.success(line);
  }
}

function printCodeBlock(code: string): void {
  const lines = code.split('\n');
  const maxLen = lines.reduce((max: number, line: string) => Math.max(max, line.length), 0);
  const bar = chalk.gray('\u2502');
  const pad = (s: string) => s + ' '.repeat(maxLen - s.length);

  process.stdout.write(`${chalk.gray('\u2502')}\n`);
  process.stdout.write(`${chalk.gray('\u2502')}  ${chalk.gray('\u250C' + '\u2500'.repeat(maxLen + 2) + '\u2510')}\n`);
  for (const line of lines) {
    process.stdout.write(`${chalk.gray('\u2502')}  ${bar} ${pad(line)} ${bar}\n`);
  }
  process.stdout.write(`${chalk.gray('\u2502')}  ${chalk.gray('\u2514' + '\u2500'.repeat(maxLen + 2) + '\u2518')}\n`);
}

export async function init(options: InitOptions = {}): Promise<number> {
  const apiUrl = options.apiUrl || process.env.VOCODER_API_URL || 'https://vocoder.app';

  p.intro('Vocoder Setup');

  const spinner = p.spinner();

  try {
    // ── Detect git context ─────────────────────────────────────────
    const gitContext = resolveGitContext();
    const identity = gitContext.identity;

    if (gitContext.warnings.length > 0) {
      for (const warning of gitContext.warnings) {
        p.log.warn(warning);
      }
    }

    // ── Try fast lookup: does a project already exist for this repo?
    if (identity) {
      spinner.start('Checking for existing project...');

      const api = new VocoderAPI({ apiUrl, apiKey: '' });
      const existing = await api.lookupProjectByRepo({
        repoCanonical: identity.repoCanonical,
        scopePath: identity.repoScopePath,
      });

      if (existing) {
        spinner.stop('Found existing project!');
        p.outro('Vocoder is already set up for this repository.');

        runScaffold({
          projectName: existing.projectName,
          organizationName: existing.organizationName,
          sourceLocale: existing.sourceLocale ?? 'en',
          translationTriggers: existing.translationTriggers ?? ['push'],
        });

        return 0;
      }

      spinner.stop('No existing project found for this repo.');
    }

    // ── Browser setup flow (new project needed) ────────────────────
    spinner.start('Creating setup session');

    const api = new VocoderAPI({ apiUrl, apiKey: '' });

    const start = await api.startInitSession({
      projectName: options.projectName,
      sourceLocale: options.sourceLocale,
      targetLocales: parseTargetLocales(options.targetLocales),
      ...(identity?.repoCanonical ? { repoCanonical: identity.repoCanonical } : {}),
      ...(identity ? { repoScopePath: identity.repoScopePath } : {}),
    });

    spinner.stop('Setup session created');

    const verificationUrlString = start.verificationUrl;

    p.log.info('Create a project in your browser to continue.');
    p.note(verificationUrlString, 'Setup URL');

    // ── Browser open ───────────────────────────────────────────────
    if (process.stdin.isTTY && process.stdout.isTTY && process.env.CI !== 'true') {
      const shouldOpen = options.yes
        ? true
        : await p.confirm({ message: 'Open this URL in your browser?' });

      if (p.isCancel(shouldOpen)) {
        p.cancel('Setup cancelled.');
        return 1;
      }

      if (shouldOpen) {
        const opened = await tryOpenBrowser(verificationUrlString);
        if (opened) {
          p.log.info('Opened your browser.');
        } else {
          p.log.info('Could not open a browser automatically. Use the URL above.');
        }
      }
    }

    // ── Polling ────────────────────────────────────────────────────
    const expiresAt = new Date(start.expiresAt).getTime();
    spinner.start('Waiting for setup to complete...');

    while (Date.now() < expiresAt) {
      const status = await api.getInitSessionStatus({
        sessionId: start.sessionId,
        pollToken: start.poll.token,
      });

      if (status.status === 'pending') {
        const pendingMessage = status.message?.trim();
        if (pendingMessage) {
          spinner.message(`Waiting for setup to complete... (${pendingMessage})`);
        }
        await sleep((status.pollIntervalSeconds || start.poll.intervalSeconds) * 1000);
        continue;
      }

      if (status.status === 'failed') {
        spinner.stop('Setup failed');
        if (isPlanLimitFailure(status.message)) {
          printPlanLimitMessage(apiUrl, status.message);
        } else {
          p.log.error(status.message);
        }
        p.cancel('Setup could not be completed.');
        return 1;
      }

      if (status.status === 'completed') {
        spinner.stop('Setup complete!');

        const { credentials } = status;

        p.outro('Vocoder initialized successfully!');

        runScaffold({
          projectName: credentials.projectName,
          organizationName: credentials.organizationName,
          sourceLocale: credentials.sourceLocale,
          translationTriggers: credentials.translationTriggers ?? ['push'],
        });

        return 0;
      }
    }

    // ── Timeout ──────────────────────────────────────────────────
    spinner.stop('Setup timed out');
    p.log.error('Setup timed out. Run `vocoder init` again.');
    p.cancel('Setup could not be completed.');
    return 1;
  } catch (error) {
    spinner.stop();
    if (error instanceof Error) {
      if (isPlanLimitFailure(error.message)) {
        printPlanLimitMessage(apiUrl, error.message);
        return 1;
      }
      p.log.error(`Error: ${error.message}`);
    } else {
      p.log.error('Unknown setup error');
    }

    return 1;
  }
}
