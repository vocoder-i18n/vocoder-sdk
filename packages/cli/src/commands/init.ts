import { VocoderAPI, VocoderAPIError } from '../utils/api.js';
import { existsSync, readFileSync, writeFileSync } from 'fs';

import type { InitOptions } from '../types.js';
import chalk from 'chalk';
import { createInterface } from 'node:readline/promises';
import { join } from 'path';
import ora from 'ora';
import { resolveGitContext } from '../utils/git-identity.js';
import { spawn } from 'node:child_process';

function parseTargetLocales(value?: string): string[] | undefined {
  if (!value) return undefined;

  const locales = value
    .split(',')
    .map((locale) => locale.trim())
    .filter(Boolean);

  return locales.length > 0 ? locales : undefined;
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
  const pattern = new RegExp(`^${params.key}=.*$`, 'm');
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

export async function init(options: InitOptions = {}): Promise<number> {
  const projectRoot = process.cwd();
  const apiUrl = options.apiUrl || process.env.VOCODER_API_URL || 'https://vocoder.app';
  const shouldWriteEnv = options.writeEnv !== false;

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
      ...(identity?.repoLabel ? { repoLabel: identity.repoLabel } : {}),
    });

    spinner.succeed('Setup session created');

    const verificationUrl = new URL(start.verificationUrl);
    if (gitContext.branch) {
      verificationUrl.searchParams.set('branch', gitContext.branch);
    }
    const verificationUrlString = verificationUrl.toString();

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
        console.error(chalk.red(`\n❌ ${status.message}\n`));
        return 1;
      }

      if (status.status === 'completed') {
        spinner.succeed('Setup completed');

        if (shouldWriteEnv) {
          const envPath = join(projectRoot, '.env');

          upsertEnvValue({
            filePath: envPath,
            key: 'VOCODER_API_KEY',
            value: status.credentials.apiKey,
            allowOverwrite: Boolean(options.yes),
          });

          console.log(chalk.green('\n✅ Vocoder initialized successfully.'));
          console.log(chalk.dim(`   Wrote VOCODER_API_KEY to your .env file (${envPath})`));
        } else {
          console.log(chalk.yellow('\n⚠ Setup completed, but no files were written.'));
          console.log(chalk.dim('   Re-run without --no-write-env to save configuration automatically.'));
          console.log(chalk.dim('   Or set this manually:'));
          console.log(chalk.white(`   VOCODER_API_KEY=${status.credentials.apiKey}`));
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
      console.error(chalk.red(`\n❌ ${error.limitError.message}`));
      console.log(chalk.dim(`   Current: ${error.limitError.current}`));
      console.log(chalk.dim(`   Required: ${error.limitError.required}`));
      console.log(chalk.cyan(`   Upgrade: ${error.limitError.upgradeUrl}\n`));
      return 1;
    }

    if (error instanceof Error) {
      console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
    } else {
      console.error(chalk.red('\n❌ Unknown setup error\n'));
    }

    return 1;
  }
}
