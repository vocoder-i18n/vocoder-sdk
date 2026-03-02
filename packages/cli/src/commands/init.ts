import { VocoderAPI, VocoderAPIError } from '../utils/api.js';
import { existsSync, readFileSync, writeFileSync } from 'fs';

import type { InitOptions } from '../types.js';
import chalk from 'chalk';
import { createInterface } from 'node:readline/promises';
import { join } from 'path';
import ora from 'ora';
import { resolveGitContext } from '../utils/git-identity.js';
import { spawn } from 'node:child_process';

const SUBSCRIPTION_SETTINGS_PATH = '/dashboard/workspace/settings?tab=subscription';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseTargetLocales(value?: string): string[] | undefined {
  if (!value) return undefined;

  const locales = value
    .split(',')
    .map((locale) => locale.trim())
    .filter(Boolean);

  return locales.length > 0 ? locales : undefined;
}

function getEnvLine(filePath: string, key: string): string | null {
  if (!existsSync(filePath)) {
    return null;
  }

  const current = readFileSync(filePath, 'utf-8');
  const pattern = new RegExp(`^${escapeRegExp(key)}=.*$`, 'm');
  const existingMatch = current.match(pattern);
  return existingMatch?.[0] ?? null;
}

function upsertEnvValue(params: {
  filePath: string;
  key: string;
  value: string;
  allowOverwrite: boolean;
}): void {
  const lineValue = `${params.key}=${params.value}`;

  if (!existsSync(params.filePath)) {
    writeFileSync(params.filePath, `${lineValue}\n`, 'utf-8');
    return;
  }

  const current = readFileSync(params.filePath, 'utf-8');
  const pattern = new RegExp(`^${escapeRegExp(params.key)}=.*$`, 'm');
  const existingMatch = current.match(pattern);

  if (existingMatch && existingMatch[0] !== lineValue && !params.allowOverwrite) {
    throw new Error(
      `${params.key} already exists in ${params.filePath}. Re-run with --yes to overwrite.`
    );
  }

  if (existingMatch) {
    const updated = current.replace(pattern, lineValue);
    writeFileSync(params.filePath, updated.endsWith('\n') ? updated : `${updated}\n`, 'utf-8');
    return;
  }

  const prefix = current.endsWith('\n') || current.length === 0 ? '' : '\n';
  writeFileSync(params.filePath, `${current}${prefix}${lineValue}\n`, 'utf-8');
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

async function promptForBrowserOpen(): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stdout.isTTY || process.env.CI === 'true') {
    return false;
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    await rl.question(chalk.white('Press Enter to open this URL in your browser...'));
    return true;
  } catch {
    return false;
  } finally {
    rl.close();
  }
}

async function promptForEnvOverwrite(filePath: string, key: string): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stdout.isTTY || process.env.CI === 'true') {
    return false;
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await rl.question(
      chalk.white(`${key} already exists in ${filePath}. Overwrite it? [Y/n] `)
    );
    const normalized = answer.trim().toLowerCase();
    return normalized === '' || normalized === 'y' || normalized === 'yes';
  } catch {
    return false;
  } finally {
    rl.close();
  }
}

function isPlanLimitFailure(message?: string): boolean {
  if (!message) return false;
  return /limit|upgrade/i.test(message);
}

function getSubscriptionSettingsUrl(apiUrl: string): string {
  return new URL(SUBSCRIPTION_SETTINGS_PATH, apiUrl).toString();
}

function printPlanLimitMessage(apiUrl: string, message: string): void {
  console.error(chalk.red('\n❌ You are over your plan limits.'));
  console.error(chalk.red(`   ${message}`));
  console.log(chalk.cyan(`   Manage subscription: ${getSubscriptionSettingsUrl(apiUrl)}\n`));
}

export async function init(options: InitOptions = {}): Promise<number> {
  const projectRoot = process.cwd();
  const apiUrl = options.apiUrl || process.env.VOCODER_API_URL || 'https://vocoder.app';

  try {
    const spinner = ora('Starting Vocoder setup...').start();
    const api = new VocoderAPI({
      apiUrl,
      apiKey: '',
    });
    const gitContext = resolveGitContext();
    const identity = gitContext.identity;

    const start = await api.startInitSession({
      projectName: options.projectName,
      sourceLocale: options.sourceLocale,
      targetLocales: parseTargetLocales(options.targetLocales),
      ...(identity?.repoCanonical ? { repoCanonical: identity.repoCanonical } : {}),
      ...(identity ? { repoScopePath: identity.repoScopePath } : {}),
    });

    spinner.succeed('Setup session created');

    const verificationUrlString = start.verificationUrl;

    console.log();
    console.log(`${chalk.cyan('Authorize setup URL:')} ${verificationUrlString}`);
    console.log();
    console.log(`${chalk.yellow('!')} First copy your one-time code: ${chalk.bold(start.userCode)}`);
    console.log();
    if (gitContext.warnings.length > 0) {
      for (const warning of gitContext.warnings) {
        console.log(chalk.yellow(`⚠ ${warning}`));
      }
    }

    const shouldOpenBrowser = await promptForBrowserOpen();
    if (shouldOpenBrowser) {
      const opened = await tryOpenBrowser(verificationUrlString);
      if (opened) {
        console.log(chalk.dim('Opened your browser for verification.'));
      } else {
        console.log(chalk.dim('Could not open a browser automatically. Use the URL above.'));
      }
    }

    const expiresAt = new Date(start.expiresAt).getTime();
    spinner.start('Waiting for browser authorization...');

    while (Date.now() < expiresAt) {
      const status = await api.getInitSessionStatus({
        sessionId: start.sessionId,
        pollToken: start.poll.token,
      });

      if (status.status === 'pending') {
        const pendingMessage = status.message?.trim();
        if (pendingMessage) {
          spinner.text = `Waiting for browser authorization... (${pendingMessage})`;
        }
        await sleep((status.pollIntervalSeconds || start.poll.intervalSeconds) * 1000);
        continue;
      }

      if (status.status === 'failed') {
        spinner.fail('Setup failed');
        if (isPlanLimitFailure(status.message)) {
          printPlanLimitMessage(apiUrl, status.message);
        } else {
          console.error(chalk.red(`\n❌ ${status.message}\n`));
        }
        return 1;
      }

      if (status.status === 'completed') {
        spinner.succeed('Setup completed');

        const envPath = join(projectRoot, '.env');
        const key = 'VOCODER_API_KEY';
        const desiredLine = `${key}=${status.credentials.apiKey}`;
        const existingLine = getEnvLine(envPath, key);
        const isAlreadyCurrent = existingLine === desiredLine;
        let didOverwrite = false;

        if (!isAlreadyCurrent) {
          try {
            upsertEnvValue({
              filePath: envPath,
              key,
              value: status.credentials.apiKey,
              allowOverwrite: Boolean(options.yes),
            });
            didOverwrite = Boolean(existingLine);
          } catch (error) {
            const overwriteConflict =
              error instanceof Error &&
              error.message.includes(`${key} already exists in ${envPath}`);
            if (!overwriteConflict) {
              throw error;
            }

            const shouldOverwrite = await promptForEnvOverwrite(envPath, key);
            if (!shouldOverwrite) {
              console.log(chalk.yellow('\n⚠ Existing VOCODER_API_KEY was not changed.'));
              console.log(chalk.dim('   Re-run with --yes to overwrite it without prompting.'));
              console.log(
                chalk.dim('   Update .env manually if this project should use a different key.')
              );
              return 1;
            }

            upsertEnvValue({
              filePath: envPath,
              key,
              value: status.credentials.apiKey,
              allowOverwrite: true,
            });
            didOverwrite = true;
          }
        }

        console.log(chalk.green('\n✅ Vocoder initialized successfully.'));
        if (isAlreadyCurrent) {
          console.log(chalk.dim(`   VOCODER_API_KEY already matches your .env file (${envPath})`));
        } else if (didOverwrite) {
          console.log(chalk.dim(`   Updated VOCODER_API_KEY in your .env file (${envPath})`));
        } else {
          console.log(chalk.dim(`   Wrote VOCODER_API_KEY to your .env file (${envPath})`));
        }

        console.log(chalk.dim(`\nProject: ${status.credentials.projectName} (${status.credentials.projectId})`));
        console.log(chalk.dim(`Organization: ${status.credentials.organizationName}`));
        return 0;
      }
    }

    spinner.fail('Setup timed out');
    console.error(chalk.red('\n❌ Authorization timed out. Run `vocoder init` again.\n'));
    return 1;
  } catch (error) {
    if (error instanceof VocoderAPIError && error.limitError) {
      printPlanLimitMessage(apiUrl, error.limitError.message);
      console.log(chalk.dim(`   Current: ${error.limitError.current}`));
      console.log(chalk.dim(`   Required: ${error.limitError.required}`));
      console.log(chalk.cyan(`   Upgrade: ${error.limitError.upgradeUrl}\n`));
      return 1;
    }

    if (error instanceof Error) {
      if (isPlanLimitFailure(error.message)) {
        printPlanLimitMessage(apiUrl, error.message);
        return 1;
      }
      console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
    } else {
      console.error(chalk.red('\n❌ Unknown setup error\n'));
    }

    return 1;
  }
}
