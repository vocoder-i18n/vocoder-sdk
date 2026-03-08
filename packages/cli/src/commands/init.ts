import * as p from '@clack/prompts';

import { VocoderAPI, VocoderAPIError } from '../utils/api.js';
import { existsSync, readFileSync, writeFileSync } from 'fs';

import type { InitOptions } from '../types.js';
import { join } from 'path';
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
    .map((locale: string) => locale.trim())
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

function getEnvValue(filePath: string, key: string): string | null {
  const line = getEnvLine(filePath, key);
  if (!line) return null;
  const eqIndex = line.indexOf('=');
  if (eqIndex === -1) return null;
  return line.slice(eqIndex + 1);
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

function maskApiKey(key: string): string {
  if (key.length <= 8) return key;
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

export async function init(options: InitOptions = {}): Promise<number> {
  const projectRoot = process.cwd();
  const apiUrl = options.apiUrl || process.env.VOCODER_API_URL || 'https://vocoder.app';
  const envPath = join(projectRoot, '.env');

  p.intro('Vocoder Setup');

  const spinner = p.spinner();

  try {
    // ── Re-init detection ──────────────────────────────────────────
    const existingKey = getEnvValue(envPath, 'VOCODER_API_KEY');

    if (existingKey && existingKey.startsWith('vc_')) {
      // Try to validate the existing key by fetching project config
      const existingApi = new VocoderAPI({ apiUrl, apiKey: existingKey });

      try {
        const config = await existingApi.getProjectConfig();

        // Key is valid — show current config and ask what to do
        p.log.info('Existing configuration found:');
        p.note(
          [
            `Project:    ${config.projectName}`,
            `Workspace:  ${config.organizationName}`,
            `Source:     ${config.sourceLocale}`,
            `Targets:    ${config.targetLocales.join(', ')}`,
            `Key:        ${maskApiKey(existingKey)}`,
          ].join('\n'),
        );

        // --yes flag: auto-keep and exit
        if (options.yes) {
          p.outro('Configuration unchanged. You\'re all set!');
          return 0;
        }

        const action = await p.select({
          message: 'What would you like to do?',
          options: [
            { value: 'keep', label: 'Keep current configuration' },
            { value: 'reconfigure', label: 'Reconfigure (new browser setup)' },
          ],
        });

        if (p.isCancel(action)) {
          p.cancel('Setup cancelled.');
          return 1;
        }

        if (action === 'keep') {
          p.outro('Configuration unchanged. You\'re all set!');
          return 0;
        }

        // action === 'reconfigure' — fall through to normal init flow
      } catch {
        // Key is invalid or expired
        p.log.warn('Found VOCODER_API_KEY in .env but it appears to be invalid or expired.');

        if (!options.yes) {
          const action = await p.select({
            message: 'What would you like to do?',
            options: [
              { value: 'reconfigure', label: 'Reconfigure (new browser setup)' },
              { value: 'keep', label: 'Keep current key anyway' },
            ],
          });

          if (p.isCancel(action)) {
            p.cancel('Setup cancelled.');
            return 1;
          }

          if (action === 'keep') {
            p.outro('Keeping existing key. You may encounter errors if the key is invalid.');
            return 0;
          }
        }

        // --yes or reconfigure — fall through to normal init flow
      }
    }

    // ── Session creation ───────────────────────────────────────────
    spinner.start('Creating setup session');

    const api = new VocoderAPI({ apiUrl, apiKey: '' });
    const gitContext = resolveGitContext();
    const identity = gitContext.identity;

    const start = await api.startInitSession({
      projectName: options.projectName,
      sourceLocale: options.sourceLocale,
      targetLocales: parseTargetLocales(options.targetLocales),
      ...(identity?.repoCanonical ? { repoCanonical: identity.repoCanonical } : {}),
      ...(identity ? { repoScopePath: identity.repoScopePath } : {}),
    });

    spinner.stop('Setup session created');

    const verificationUrlString = start.verificationUrl;

    // Show git warnings if any
    if (gitContext.warnings.length > 0) {
      for (const warning of gitContext.warnings) {
        p.log.warn(warning);
      }
    }

    // Display the authorization URL
    p.note(verificationUrlString, 'Authorize in your browser');

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
          p.log.info('Opened your browser for verification.');
        } else {
          p.log.info('Could not open a browser automatically. Use the URL above.');
        }
      }
    }

    // ── Polling ────────────────────────────────────────────────────
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
          spinner.message(`Waiting for browser authorization... (${pendingMessage})`);
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
        spinner.stop('Authorization complete!');

        // ── .env write ───────────────────────────────────────────
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

            const shouldOverwrite = await p.confirm({
              message: `${key} already exists in ${envPath}. Overwrite it?`,
            });

            if (p.isCancel(shouldOverwrite) || !shouldOverwrite) {
              p.log.warn('Existing VOCODER_API_KEY was not changed.');
              p.log.info('Re-run with --yes to overwrite it without prompting.');
              p.cancel('Setup cancelled.');
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

        if (isAlreadyCurrent) {
          p.log.info(`VOCODER_API_KEY already matches your .env file`);
        } else if (didOverwrite) {
          p.log.success(`Updated VOCODER_API_KEY in .env`);
        } else {
          p.log.success(`Wrote VOCODER_API_KEY to .env`);
        }

        p.outro('Vocoder initialized successfully!');

        p.log.info(`Project:   ${status.credentials.projectName}`);
        p.log.info(`Workspace: ${status.credentials.organizationName}`);

        return 0;
      }
    }

    // ── Timeout ──────────────────────────────────────────────────
    spinner.stop('Authorization timed out');
    p.log.error('Authorization timed out. Run `vocoder init` again.');
    p.cancel('Setup could not be completed.');
    return 1;
  } catch (error) {
    spinner.stop();
    if (error instanceof VocoderAPIError && error.limitError) {
      printPlanLimitMessage(apiUrl, error.limitError.message);
      p.log.info(`Current: ${error.limitError.current}`);
      p.log.info(`Required: ${error.limitError.required}`);
      p.log.info(`Upgrade: ${error.limitError.upgradeUrl}`);
      return 1;
    }

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
