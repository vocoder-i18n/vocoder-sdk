import * as p from '@clack/prompts';

import {
  buildInstallCommand,
  detectLocalEcosystem,
  getPackagesToInstall,
} from '../utils/detect-local.js';
import { clearAuthData, readAuthData, writeAuthData } from '../utils/auth-store.js';
import { runGitHubDiscoveryFlow, runGitHubInstallFlow, selectGitHubInstallation } from '../utils/github-connect.js';

import type { InitOptions } from '../types.js';
import { VocoderAPI, VocoderAPIError } from '../utils/api.js';
import chalk from 'chalk';
import { execSync } from 'node:child_process';
import { getSetupSnippets } from '../utils/setup-snippets.js';
import { config as loadEnv } from 'dotenv';
import { resolveGitContext } from '../utils/git-identity.js';
import { runProjectAppCreate, runProjectCreate } from '../utils/project-create.js';
import { selectWorkspace } from '../utils/workspace.js';
import { spawn } from 'node:child_process';
import { startCallbackServer } from '../utils/local-server.js';

loadEnv();

const SUBSCRIPTION_SETTINGS_PATH = '/dashboard/workspace/settings?tab=subscription';

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
  sourceLocale: string;
  targetBranches: string[];
}

function runScaffold(params: ScaffoldParams): void {
  const { sourceLocale, targetBranches } = params;

  const detection = detectLocalEcosystem();

  if (detection.ecosystem) {
    const frameworkLabel = detection.framework ?? detection.ecosystem;
    const pmLabel = detection.packageManager;
    p.log.info(`Detected:  ${chalk.bold(frameworkLabel)} (${pmLabel})`);
  }

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

  const snippets = getSetupSnippets({
    framework: detection.framework,
    ecosystem: detection.ecosystem,
    sourceLocale,
    targetBranches,
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

  p.log.message('');
  for (const line of snippets.whatsNext.split('\n')) {
    p.log.success(line);
  }
}

function printMcpSetup(apiKey: string): void {
  const addCommand = `claude mcp add --scope project --transport stdio \\\n  --env VOCODER_API_KEY=${apiKey} \\\n  vocoder -- npx -y @vocoder/mcp`;

  const teamConfig = JSON.stringify(
    {
      mcpServers: {
        vocoder: {
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@vocoder/mcp'],
          env: { VOCODER_API_KEY: '${env:VOCODER_API_KEY}' },
        },
      },
    },
    null,
    2,
  );

  p.log.message('');
  p.log.message(chalk.bold('Use Vocoder with Claude Code'));
  p.log.message('Run this to add the MCP server to your project:');
  p.log.message('');
  printCodeBlock(addCommand);
  p.log.message('');
  p.log.message('To share with your team, commit ' + chalk.cyan('.mcp.json') + ' with an env var reference');
  p.log.message('so each developer supplies their own key:');
  p.log.message('');
  printCodeBlock(teamConfig);
  p.log.message('');
  p.log.message(chalk.gray('Setup instructions: https://vocoder.app/docs/mcp'));
}

function printCodeBlock(code: string): void {
  const lines = code.split('\n');
  const maxLen = lines.reduce((max: number, line: string) => Math.max(max, line.length), 0);
  const bar = chalk.gray('│');
  const pad = (s: string) => s + ' '.repeat(maxLen - s.length);

  process.stdout.write(`${chalk.gray('│')}\n`);
  process.stdout.write(`${chalk.gray('│')}  ${chalk.gray('┌' + '─'.repeat(maxLen + 2) + '┐')}\n`);
  for (const line of lines) {
    process.stdout.write(`${chalk.gray('│')}  ${bar} ${pad(line)} ${bar}\n`);
  }
  process.stdout.write(`${chalk.gray('│')}  ${chalk.gray('└' + '─'.repeat(maxLen + 2) + '┘')}\n`);
}

// ── Auth helpers ─────────────────────────────────────────────────────────────

/**
 * Verify a stored auth token against the API.
 * Returns user info on success, null if the token is invalid/expired.
 * Always clears the stored token on failure.
 *
 * Returns `{ userGone: true }` when the server confirms the user no longer
 * exists (404) — callers should treat this as a first-time setup, not a reauth.
 */
async function verifyStoredToken(
  api: VocoderAPI,
  token: string,
): Promise<{ userId: string; email: string; name: string | null } | { userGone: true } | null> {
  try {
    return await api.getCliUserInfo(token);
  } catch (err) {
    clearAuthData();
    // 404 = user record deleted — treat as first-time, not reauth
    if (err instanceof VocoderAPIError && err.status === 404) {
      return { userGone: true };
    }
    return null;
  }
}

/**
 * Run the browser authentication flow.
 * Returns `{ token, userInfo, organizationId? }` on success, or null if cancelled.
 * When `organizationId` is set, the GitHub App was installed in the same browser
 * trip — the caller should skip workspace selection and GitHub connect.
 *
 * @param reauth - When true, the user has an expired token and already has a workspace.
 *   Use verificationUrl (auth/cli page) instead of installUrl so we don't create a
 *   duplicate workspace. The direct-to-GitHub install URL is only for first-time setup.
 */
async function runAuthFlow(
  api: VocoderAPI,
  options: InitOptions,
  reauth = false,
  repoCanonical?: string,
): Promise<{ token: string; userId: string; email: string; name: string | null; organizationId?: string; discoveryReady?: boolean } | null> {
  // Try to start a local callback server for instant token delivery.
  // In --ci mode the browser step is handled externally, so skip the callback
  // server and go straight to polling — simpler and testable.
  let server: Awaited<ReturnType<typeof startCallbackServer>> | null = null;
  if (!options.ci) {
    try {
      server = await startCallbackServer();
    } catch {
      // Port conflict or other issue — fall back to polling
    }
  }

  const session = await api.startCliAuthSession(server?.port, repoCanonical);
  // Re-auth: user already has a workspace — use verificationUrl (auth/cli page)
  // so we don't trigger a new GitHub App install and create a duplicate workspace.
  // First-time: use installUrl to combine Vocoder auth + App install in one trip.
  const browserUrl = reauth
    ? session.verificationUrl
    : (session.installUrl ?? session.verificationUrl);
  const expiresAt = new Date(session.expiresAt).getTime();

  if (options.ci) {
    // Machine-readable output for automated test harnesses.
    // Parsed by e2e/helpers/cli.ts: /^VOCODER_AUTH_URL: (.+)$/m
    process.stdout.write(`VOCODER_AUTH_URL: ${browserUrl}\n`);
    // Also emit the session ID separately so tests can expire/complete sessions
    process.stdout.write(`VOCODER_SESSION_ID: ${session.sessionId}\n`);
  } else if (process.stdin.isTTY && process.stdout.isTTY && process.env.CI !== 'true') {
    if (reauth) {
      // Re-auth: token expired, just sign in — no install choice needed
      if (!options.yes) {
        const shouldOpen = await p.confirm({ message: 'Open your browser to sign in again?' });
        if (p.isCancel(shouldOpen)) {
          server?.close();
          p.cancel('Setup cancelled.');
          return null;
        }
        if (!shouldOpen) {
          p.log.info('Open the URL above manually in your browser to continue.');
        } else {
          const opened = await tryOpenBrowser(browserUrl);
          if (!opened) {
            p.note(browserUrl, 'Sign In');
            p.log.info('Open the URL above manually to continue.');
          }
        }
      } else {
        await tryOpenBrowser(browserUrl);
      }
    } else {
      // First-time setup: let user choose install vs link existing
      let isLinkFlow = false;
      if (!options.yes) {
        const connectChoice = await p.select<string>({
          message: 'Vocoder needs to be installed on your GitHub account to get started',
          options: [
            { value: 'install', label: 'Install GitHub App', hint: 'recommended' },
            { value: 'link', label: 'Already installed? Link your account' },
          ],
        });

        if (p.isCancel(connectChoice)) {
          server?.close();
          p.cancel('Setup cancelled.');
          return null;
        }

        isLinkFlow = connectChoice === 'link';
      }

      // For "link": get the OAuth-only URL from the server (no install page shown)
      let urlToOpen = browserUrl;
      if (isLinkFlow) {
        try {
          const linkSession = await api.startCliGitHubLinkSession(
            session.sessionId,
            server?.port,
          );
          urlToOpen = linkSession.oauthUrl;
        } catch {
          // Fall back to install URL if link-start fails
          urlToOpen = browserUrl;
        }
      }

      // Open browser immediately — no separate confirm needed
      const opened = await tryOpenBrowser(urlToOpen);
      if (!opened) {
        // Only show URL as a fallback if auto-open fails
        p.log.warn('Could not open your browser automatically.');
        p.note(urlToOpen, 'GitHub');
        p.log.info('Open the URL above to continue.');
      }
    }
  }

  const authSpinner = p.spinner();
  authSpinner.start('Waiting for GitHub authorization...');

  let rawToken: string | null = null;
  let callbackOrganizationId: string | undefined;
  let callbackDiscoveryReady = false;

  if (server) {
    // Fast path: wait for the localhost callback
    try {
      const deadline = Math.min(expiresAt, Date.now() + 10 * 60 * 1000);
      const timeoutMs = deadline - Date.now();
      const params = await Promise.race([
        server.waitForCallback(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
      ]);

      if (params && typeof params.token === 'string') {
        rawToken = params.token;
        if (typeof params.organizationId === 'string' && params.organizationId) {
          callbackOrganizationId = params.organizationId;
        }
        // Link flow: callback signals discovery results are cached
        if (params.discovery_ready === '1') {
          callbackDiscoveryReady = true;
        }
      }
    } catch {
      // Fall through to polling
    } finally {
      server.close();
    }
  }

  if (!rawToken) {
    // Polling fallback
    while (Date.now() < expiresAt) {
      const result = await api.pollCliAuthSession(session.sessionId);

      if (result.status === 'complete') {
        rawToken = result.token;
        if (result.organizationId) {
          callbackOrganizationId = result.organizationId;
        }
        break;
      }

      if (result.status === 'failed') {
        authSpinner.stop();
        p.log.error(result.reason);
        return null;
      }

      // Still pending — wait 2s before next poll
      await sleep(2000);
    }
  }

  if (!rawToken) {
    authSpinner.stop();
    p.log.error('The authentication link expired. Run `vocoder init` again.');
    return null;
  }

  // Validate the token and get user info
  const userInfo = await api.getCliUserInfo(rawToken);
  authSpinner.stop(`Authenticated as ${chalk.bold(userInfo.email)}`);

  return { token: rawToken, ...userInfo, organizationId: callbackOrganizationId, discoveryReady: callbackDiscoveryReady };
}

// ── Main command ─────────────────────────────────────────────────────────────

export async function init(options: InitOptions = {}): Promise<number> {
  const apiUrl = options.apiUrl || process.env.VOCODER_API_URL || 'https://vocoder.app';

  p.intro(chalk.bold('Vocoder Setup'));

  try {
    // ── Detect git context ──────────────────────────────────────────────────
    const gitContext = resolveGitContext();
    const identity = gitContext.identity;

    if (gitContext.warnings.length > 0) {
      for (const warning of gitContext.warnings) {
        p.log.warn(warning);
      }
    }

    // ── Fast lookup: does a project already exist for this repo? ────────────
    // No spinner — this is a fast DB read and we don't want an empty ◇ on miss.
    let existingAppsForRepo: Array<{
      appDir: string;
      projectId: string;
      projectName: string;
      organizationName: string;
    }> = [];
    let repoProjectId: string | null = null;
    let repoProjectName: string | null = null;

    if (identity) {
      const anonApi = new VocoderAPI({ apiUrl, apiKey: '' });
      const lookup = await anonApi.lookupProjectByRepo({
        repoCanonical: identity.repoCanonical,
        appDir: identity.repoAppDir,
      });

      // Exact match: this scope is already configured — confirm and exit.
      if (lookup.exactMatch) {
        const { exactMatch } = lookup;
        p.log.success(`Project: ${chalk.bold(exactMatch.projectName)}`);
        p.log.info(`Branches: ${chalk.cyan((exactMatch.targetBranches ?? ['main']).join(', '))}`);
        p.outro("Vocoder is already set up for this repository.");
        return 0;
      }

      // Whole-repo app exists: covers this repo from any directory — confirm and exit.
      if (lookup.hasWholeRepoApp) {
        const wholeRepo = lookup.existingApps.find((a) => a.appDir === '');
        if (wholeRepo) {
          p.log.success(`Project: ${chalk.bold(wholeRepo.projectName)}`);
          p.outro("Vocoder is already set up for this repository.");
          return 0;
        }
      }

      // Other scoped apps exist: this repo has a project but not for this scope.
      // Store for display + validation in the app directory prompt.
      if (lookup.existingApps.length > 0) {
        existingAppsForRepo = lookup.existingApps;
        // All apps belong to the same project (one project per repo)
        repoProjectId = lookup.existingApps[0]?.projectId ?? null;
        repoProjectName = lookup.existingApps[0]?.projectName ?? null;
      }
    }

    // ── Auth: check stored token, prompt if missing ─────────────────────────
    const api = new VocoderAPI({ apiUrl, apiKey: '' });
    let userToken: string;
    let userEmail: string;
    let userName: string | null;

    // organizationId is set when auth+GitHub install completed in one browser trip
    let authOrganizationId: string | undefined;

    const stored = readAuthData();
    if (stored && stored.apiUrl === apiUrl) {
      const verified = await verifyStoredToken(api, stored.token);

      if (verified && !('userGone' in verified)) {
        p.log.success(`Authenticated as ${chalk.bold(verified.email)}`);
        userToken = stored.token;
        userEmail = verified.email;
        userName = verified.name;
      } else {
        // userGone = user deleted from DB → full first-time flow (installUrl)
        // null = token expired → reauth via verificationUrl
        const isFirstTime = verified !== null && 'userGone' in verified;
        if (isFirstTime) {
          p.log.warn('Account not found — starting fresh setup');
        } else {
          p.log.warn('Stored credentials expired — signing in again');
        }
        const authResult = await runAuthFlow(api, options, /* reauth */ !isFirstTime, identity?.repoCanonical);
        if (!authResult) return 1;
        userToken = authResult.token;
        userEmail = authResult.email;
        userName = authResult.name;
        authOrganizationId = authResult.organizationId;

        writeAuthData({
          token: userToken,
          apiUrl,
          userId: authResult.userId,
          email: userEmail,
          name: userName,
          createdAt: new Date().toISOString(),
        });
      }
    } else {
      const authResult = await runAuthFlow(api, options, false, identity?.repoCanonical);
      if (!authResult) return 1;
      userToken = authResult.token;
      userEmail = authResult.email;
      userName = authResult.name;
      authOrganizationId = authResult.organizationId;

      writeAuthData({
        token: userToken,
        apiUrl,
        userId: authResult.userId,
        email: userEmail,
        name: userName,
        createdAt: new Date().toISOString(),
      });
    }

    // ── Workspace selection ─────────────────────────────────────────────────────
    let selectedWorkspaceId: string;
    let selectedWorkspaceName: string;

    if (authOrganizationId) {
      // Install path: auth+install completed in one browser trip, workspace already created.
      const workspaceData = await api.listWorkspaces(userToken);
      const ws = workspaceData.workspaces.find((w) => w.id === authOrganizationId);
      selectedWorkspaceId = authOrganizationId;
      selectedWorkspaceName = ws?.name ?? userEmail;
      p.log.success(`Connected as ${chalk.bold(userEmail)} — workspace: ${chalk.bold(selectedWorkspaceName)}`);
    } else {
      // Always check for cached discovery results first. The cache expires in
      // 5 minutes so returning users (no recent link flow) fall through cleanly.
      const discoveryResult = await api.getCliGitHubDiscovery(userToken).catch(() => null);
      const cachedInstallations = discoveryResult?.installations ?? [];

      if (cachedInstallations.length > 0) {
        // Warn if none of the discovered installations belong to the org that
        // owns the current repo — the binding won't be created even if setup succeeds.
        if (identity?.repoCanonical) {
          const repoOwner = identity.repoCanonical.split(':')[1]?.split('/')[0]?.toLowerCase();
          if (repoOwner) {
            const hasMatchingAccount = cachedInstallations.some(
              (i) => i.accountLogin.toLowerCase() === repoOwner,
            );
            if (!hasMatchingAccount) {
              p.log.warn(
                `None of your GitHub App installations belong to "${repoOwner}", ` +
                `the account that owns this repository.\n` +
                `  The project will be created but translations won't trigger automatically.\n` +
                `  To fix: install the Vocoder GitHub App on "${repoOwner}" instead.`,
              );
            }
          }
        }

        // Auto-select when there's exactly one valid (non-suspended, unclaimed) installation
        const validInstallations = cachedInstallations.filter(
          (i) => !i.isSuspended && !i.conflictLabel,
        );

        let selectedInstallationId: number | string | null = null;

        if (validInstallations.length === 1 && cachedInstallations.length === 1) {
          // Single installation — claim silently, no prompt needed
          selectedInstallationId = validInstallations[0]!.installationId;
        } else {
          selectedInstallationId = await selectGitHubInstallation(
            cachedInstallations.map((inst) => ({
              installationId: inst.installationId,
              accountLogin: inst.accountLogin,
              accountType: inst.accountType,
              isSuspended: inst.isSuspended,
              conflictLabel: inst.conflictLabel,
            })),
            false,
          );
        }

        if (selectedInstallationId === null || selectedInstallationId === 'install_new') {
          p.cancel('Setup cancelled. Re-run `vocoder init` and choose Install GitHub App.');
          return 1;
        }

        const claimResult = await api.claimCliGitHubInstallation(userToken, {
          installationId: String(selectedInstallationId),
          organizationId: null,
        });
        selectedWorkspaceId = claimResult.organizationId;
        selectedWorkspaceName = claimResult.organizationName;
        p.log.success(`Workspace: ${chalk.bold(selectedWorkspaceName)}`);
      } else {
      // ── Repo-aware workspace resolution ──────────────────────────────────────
      const workspaceData = await api.listWorkspaces(userToken, {
        repo: identity?.repoCanonical,
      });

      const repoCanonical = identity?.repoCanonical ?? null;
      // Workspaces whose GitHub installation covers the current repo
      const covering = repoCanonical
        ? workspaceData.workspaces.filter((w) => w.coversRepo === true)
        : [];
      // Workspaces that have any GitHub connection (may not cover this repo)
      const connected = workspaceData.workspaces.filter((w) => w.hasGitHubConnection);

      if (repoCanonical && covering.length === 1) {
        // ── Scenario 1: exactly one workspace covers this repo — auto-select ──
        const ws = covering[0]!;
        selectedWorkspaceId = ws.id;
        selectedWorkspaceName = ws.name;
        p.log.success(`Workspace: ${chalk.bold(selectedWorkspaceName)}`);

      } else if (repoCanonical && covering.length > 1) {
        // ── Scenario 2: multiple workspaces cover this repo — let user pick ──
        const choice = await p.select<string>({
          message: 'Select workspace for this repo',
          options: covering.map((w) => ({
            value: w.id,
            label: `${w.name}  ${chalk.dim(`(${w.projectCount} project${w.projectCount !== 1 ? 's' : ''})`)}`,
          })),
        });
        if (p.isCancel(choice)) { p.cancel('Setup cancelled.'); return 1; }
        const ws = covering.find((w) => w.id === choice)!;
        selectedWorkspaceId = ws.id;
        selectedWorkspaceName = ws.name;
        p.log.success(`Workspace: ${chalk.bold(selectedWorkspaceName)}`);

      } else if (repoCanonical && covering.length === 0 && connected.length > 0) {
        // ── Scenario 3: connected workspaces exist but none cover this repo ──
        const shortRepo = repoCanonical.split(':')[1] ?? repoCanonical;
        p.log.warn(
          `${chalk.bold(shortRepo)} isn't accessible from your Vocoder installation.\n` +
          `  Grant access to this repository or install on the account that owns it.`,
        );

        const fixOptions: Array<{ value: string; label: string }> = [];
        for (const ws of connected) {
          if (ws.installationConfigureUrl) {
            fixOptions.push({
              value: `grant:${ws.id}`,
              label: `Configure ${chalk.bold(ws.connectionLabel ?? ws.name)}'s GitHub App installation`,
            });
          }
        }
        fixOptions.push({
          value: 'install_new',
          label: `Install on a different GitHub account ${chalk.dim('(creates a new personal workspace)')}`,
        });
        fixOptions.push({ value: 'cancel', label: 'Cancel' });

        const fix = await p.select<string>({
          message: 'How would you like to fix this?',
          options: fixOptions,
        });

        if (p.isCancel(fix) || fix === 'cancel') {
          p.cancel('Setup cancelled.');
          return 1;
        }

        if (fix.startsWith('grant:')) {
          const ws = connected.find((w) => `grant:${w.id}` === fix)!;
          await tryOpenBrowser(ws.installationConfigureUrl!);
          p.cancel(
            `Grant access to ${chalk.bold(shortRepo)} in your browser,\n` +
            `  then re-run ${chalk.bold('vocoder init')}.`,
          );
          return 1;
        }

        // install_new: full install → creates new workspace covering the new account
        const connectResult = await runGitHubInstallFlow({ api, userToken, yes: options.yes });
        if (!connectResult) {
          p.log.error('GitHub App installation did not complete. Run `vocoder init` again.');
          return 1;
        }
        selectedWorkspaceId = connectResult.organizationId;
        selectedWorkspaceName = connectResult.organizationName;
        p.log.success(`Workspace: ${chalk.bold(selectedWorkspaceName)}`);

      } else {
        // ── Fallback: no repo context or first-time user — standard select ────
        if (workspaceData.workspaces.length === 1 && !workspaceData.canCreateWorkspace) {
          const ws = workspaceData.workspaces[0]!;
          selectedWorkspaceId = ws.id;
          selectedWorkspaceName = ws.name;
          p.log.success(`Workspace: ${chalk.bold(selectedWorkspaceName)}`);
        } else {

        const workspaceResult = await selectWorkspace(workspaceData);

        if (workspaceResult.action === 'cancelled') {
          p.cancel('Setup cancelled.');
          return 1;
        }

        if (workspaceResult.action === 'use') {
          selectedWorkspaceId = workspaceResult.workspace.id;
          selectedWorkspaceName = workspaceResult.workspace.name;
          p.log.success(`Workspace: ${chalk.bold(selectedWorkspaceName)}`);
        } else {
          // ── New workspace: GitHub connect flow ────────────────────────────────
          const connectChoice = await p.select<string>({
            message: 'Connect your new workspace to GitHub',
            options: [
              { value: 'install', label: 'Install the Vocoder GitHub App' },
              { value: 'link', label: 'Link an existing installation' },
            ],
          });

          if (p.isCancel(connectChoice)) {
            p.cancel('Setup cancelled.');
            return 1;
          }

          if (connectChoice === 'install') {
            const connectResult = await runGitHubInstallFlow({ api, userToken, yes: options.yes });
            if (!connectResult) {
              p.log.error('GitHub App installation did not complete. Run `vocoder init` again.');
              return 1;
            }
            selectedWorkspaceId = connectResult.organizationId;
            selectedWorkspaceName = connectResult.organizationName;
            p.log.success(`Workspace: ${chalk.bold(selectedWorkspaceName)}`);
          } else {
            const installations = await runGitHubDiscoveryFlow({ api, userToken, yes: options.yes });
            if (!installations) return 1;

            if (installations.length === 0) {
              p.log.warn('No GitHub installations found. Install the Vocoder GitHub App first.');
              const installNow = await p.confirm({ message: 'Open GitHub to install the App?' });
              if (p.isCancel(installNow) || !installNow) return 1;
              const connectResult = await runGitHubInstallFlow({ api, userToken, yes: options.yes });
              if (!connectResult) return 1;
              selectedWorkspaceId = connectResult.organizationId;
              selectedWorkspaceName = connectResult.organizationName;
            } else {
              const selectedInstallationId = await selectGitHubInstallation(
                installations.map((inst) => ({
                  installationId: inst.installationId,
                  accountLogin: inst.accountLogin,
                  accountType: inst.accountType,
                  isSuspended: inst.isSuspended,
                  conflictLabel: inst.conflictLabel,
                })),
                true,
              );

              if (selectedInstallationId === null) { p.cancel('Setup cancelled.'); return 1; }

              if (selectedInstallationId === 'install_new') {
                const connectResult = await runGitHubInstallFlow({ api, userToken, yes: options.yes });
                if (!connectResult) return 1;
                selectedWorkspaceId = connectResult.organizationId;
                selectedWorkspaceName = connectResult.organizationName;
              } else {
                const claimResult = await api.claimCliGitHubInstallation(userToken, {
                  installationId: String(selectedInstallationId),
                  organizationId: null,
                });
                selectedWorkspaceId = claimResult.organizationId;
                selectedWorkspaceName = claimResult.organizationName;
              }
            }
            p.log.success(`Workspace: ${chalk.bold(selectedWorkspaceName)}`);
          }
        } // closes new workspace else
        } // closes auto-select else
      } // closes main scenario if/else chain
      } // closes cachedInstallations else
    } // closes if (authOrganizationId) else

    // ── Add-app path: repo already has a project with scoped apps ───────────────
    // Skip plan limit check — we're adding a ProjectApp to an existing project,
    // not creating a new one. Run the project config prompts then call
    // POST /api/cli/project/apps.
    if (repoProjectId && repoProjectName && existingAppsForRepo.length > 0) {
      p.log.info(
        `${chalk.bold(repoProjectName)} is already set up for this repo.\n` +
        `  Configured apps: ${existingAppsForRepo
          .map((a) => chalk.cyan(a.appDir || '(entire repo)'))
          .join(', ')}`,
      );

      const appResult = await runProjectAppCreate({
        api,
        userToken,
        projectId: repoProjectId,
        projectName: repoProjectName,
        organizationName: selectedWorkspaceName,
        repoCanonical: identity?.repoCanonical,
        defaultAppDir: identity?.repoAppDir,
        existingApps: existingAppsForRepo,
      });

      if (!appResult) {
        p.log.error('App setup failed. Run `vocoder init` again.');
        return 1;
      }

      runScaffold({
        sourceLocale: appResult.sourceLocale,
        targetBranches: appResult.targetBranches,
      });
      p.outro("You're all set.");
      return 0;
    }

    // ── Plan limit pre-flight ────────────────────────────────────────────────────
    try {
      const wsCheck = await api.listWorkspaces(userToken);
      const ws = wsCheck.workspaces.find((w) => w.id === selectedWorkspaceId);
      if (ws && ws.maxProjects !== -1 && ws.projectCount >= ws.maxProjects) {
        p.log.warn(
          `Project limit reached — ${ws.projectCount}/${ws.maxProjects} on your ${chalk.bold(ws.planId)} plan.`,
        );

        // If we're in a known repo, offer to connect an existing project to it.
        // This handles the case where the project exists but the repo binding
        // is missing (e.g. was lost in a migration or never created).
        const hasRepoContext = !!identity?.repoCanonical;

        const options: Array<{ value: string; label: string }> = [];
        if (hasRepoContext) {
          options.push({
            value: 'connect',
            label: 'Connect this repo to an existing project',
          });
        }
        options.push({ value: 'upgrade', label: 'Upgrade plan' });
        options.push({ value: 'cancel', label: 'Cancel' });

        const limitAction = await p.select<string>({
          message: 'What would you like to do?',
          options,
        });

        if (p.isCancel(limitAction) || limitAction === 'cancel') {
          p.cancel('Setup cancelled.');
          return 1;
        }

        if (limitAction === 'upgrade') {
          await tryOpenBrowser(`${apiUrl}${SUBSCRIPTION_SETTINGS_PATH}`);
          p.cancel('Upgrade your plan in the browser, then re-run `vocoder init`.');
          return 1;
        }

        // connect: list projects in this workspace, pick one, create ProjectApp binding
        const existingProjects = await api.listProjects(userToken, selectedWorkspaceId);
        if (existingProjects.length === 0) {
          p.log.error('No projects found in this workspace.');
          return 1;
        }

        const chosenId = await p.select<string>({
          message: 'Which project should this repo be connected to?',
          options: existingProjects.map((proj) => ({
            value: proj.id,
            label: proj.name,
          })),
        });

        if (p.isCancel(chosenId)) {
          p.cancel('Setup cancelled.');
          return 1;
        }

        const chosen = existingProjects.find((proj) => proj.id === chosenId)!;

        const appResult = await runProjectAppCreate({
          api,
          userToken,
          projectId: chosen.id,
          projectName: chosen.name,
          organizationName: selectedWorkspaceName,
          repoCanonical: identity?.repoCanonical,
          defaultAppDir: identity?.repoAppDir,
          existingApps: [],
        });

        if (!appResult) {
          p.log.error('Setup failed. Run `vocoder init` again.');
          return 1;
        }

        runScaffold({
          sourceLocale: appResult.sourceLocale,
          targetBranches: appResult.targetBranches,
        });
        p.outro("You're all set.");
        return 0;
      }
    } catch {
      // Non-fatal
    }

    // ── Project configuration ────────────────────────────────────────────────────
    const projectResult = await runProjectCreate({
      api,
      userToken,
      organizationId: selectedWorkspaceId,
      defaultName: identity?.repoCanonical
        ? identity.repoCanonical.split('/').pop()
        : undefined,
      defaultSourceLocale: 'en',
      repoCanonical: identity?.repoCanonical,
      defaultBranches: ['main'],
      defaultAppDir: identity?.repoAppDir,
    });


    if (!projectResult) {
      p.log.error('Project creation failed. Run `vocoder init` again.');
      return 1;
    }

    // Warn if the current repo isn't accessible to the GitHub App installation.
    // This means translations won't trigger on push until the App is granted access.
    if (!projectResult.repositoryBound && identity?.repoCanonical) {
      p.log.warn(
        `This repository isn't accessible to your GitHub App installation.\n` +
        `Translations won't run automatically until you grant access.\n\n` +
        `  To fix: go to your GitHub App installation settings and add this\n` +
        `  repository to the allowed list, or switch to "All repositories".\n` +
        (projectResult.configureUrl
          ? `\n  ${chalk.dim(projectResult.configureUrl)}\n`
          : ''),
      );
    }

    // ── Scaffold + MCP setup ─────────────────────────────────────────────────────
    runScaffold({
      sourceLocale: projectResult.sourceLocale,
      targetBranches: projectResult.targetBranches,
    });

    printMcpSetup(projectResult.apiKey);

    p.outro("You're all set.");
    return 0;
  } catch (error) {
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
