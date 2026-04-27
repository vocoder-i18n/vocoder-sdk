# @vocoder/cli

Command-line tool for Vocoder. Handles project setup, string extraction, and translation sync.

## Installation

```bash
npm install -g @vocoder/cli
```

Or use directly with npx:

```bash
npx vocoder <command>
```

## Commands

### `vocoder init`

Connect your repository to Vocoder. Runs a full TUI-based onboarding flow — authentication, workspace selection, GitHub connection, and project configuration all happen in the terminal. A browser is opened only for steps that require OAuth (sign-in, GitHub App install).

```bash
vocoder init
```

**Fast path:** If the current repository's remote is already linked to a Vocoder project, `init` detects it and prints the scaffold instructions immediately — no prompts, no browser.

**Full flow:**

```
◆  Vocoder Setup

●  Open the link below to sign in or create your account:
◇  Authentication URL ──────────────────────────────────────╮
│                                                            │
│  https://vocoder.app/auth/cli?session=<token>             │
│                                                            │
├────────────────────────────────────────────────────────────

◆  Open in your browser? › Yes

◒  Waiting for authentication...
◇  Authenticated as eric@example.com

◒  Loading workspaces...
◆  Select workspace
│  ● My Workspace  (2 projects)
│  ○ Create new workspace
└

◇  Workspace: My Workspace

◆  Project name › my-app
◆  Source language (type to search) › en → English — en
◆  Target languages (type to search) › es → Spanish — es
◆  Target branches (comma-separated) › main

◒  Creating project...

◆  Step 1: Add the plugin to vite.config.ts
│  ...
◆  Step 2: Add the provider to App.tsx
│  ...
◆  Step 3: Wrap translatable strings

◆  Use Vocoder with Claude Code
│  claude mcp add --scope project --transport stdio \
│    --env VOCODER_API_KEY=vc_xxxx \
│    vocoder -- npx -y @vocoder/mcp

◆  You're all set.
```

**Returning user (stored token, existing workspace):**

No browser opens. The stored auth token is verified, workspaces are listed, and the flow continues directly in the terminal.

```
◆  Vocoder Setup

◒  Checking authentication...
◇  Authenticated as eric@example.com

◒  Loading workspaces...
◆  Select workspace
│  ● My Workspace  (2 projects)
│  ○ Create new workspace
└
```

**New workspace (GitHub App install):**

If creating a new workspace, a second browser step installs the GitHub App. The CLI opens the install URL and waits for the browser to redirect back to a local callback server.

```
◆  Connect your new workspace to GitHub
│  ● Install the Vocoder GitHub App
│  ○ Link an existing installation
└

○  Opening GitHub to install the Vocoder App...
   Complete the installation in your browser.

◇  Connected to GitHub as itsmoops
```

**Options:**

| Flag | Description |
|---|---|
| `--yes` | Skip "Open in your browser?" confirmation |
| `--ci` | Non-interactive mode. Prints the auth URL as `VOCODER_AUTH_URL: <url>` on its own line to stdout — no browser opens, no interactive prompts, no local callback server. The CLI polls `GET /api/cli/auth/session` every 2 seconds until the browser completes authentication. Intended for automated test harnesses that drive the browser step externally. |

**Auth storage:**

After sign-in, the CLI stores a persistent auth token at `~/.config/vocoder/auth.json` (mode `0600`). The file contains:

```json
{
  "token": "vcu_...",
  "apiUrl": "https://vocoder.app",
  "userId": "...",
  "email": "user@example.com",
  "name": "User Name",
  "createdAt": "2026-04-25T12:00:00.000Z"
}
```

Tokens never expire. Use `vocoder logout` to revoke.

**Token priority:**

| Command | Token source |
|---|---|
| `vocoder init` | `VOCODER_AUTH_TOKEN` env var → `~/.config/vocoder/auth.json` |
| `vocoder sync` | `VOCODER_API_KEY` env var → `.env` file |
| MCP tools | `VOCODER_API_KEY` env var |

---

### `vocoder sync`

Submit extracted strings for translation and retrieve results.

```bash
vocoder sync
```

Reads `VOCODER_API_KEY` from environment or `.env`. Extracts `<T>` and `t()` usages from source files, submits them to Vocoder, and polls until translations are returned. Writes locale JSON files to the configured output path.

**Options:**

| Flag | Description |
|---|---|
| `--locale <code>` | Sync only this target locale |
| `--dry-run` | Show what would be synced without submitting |
| `--verbose` | Show extraction and sync details |

---

### `vocoder logout`

Revoke the stored auth token and clear `~/.config/vocoder/auth.json`.

```bash
vocoder logout
```

Also revokes the token server-side so it can no longer be used for API calls.

---

### `vocoder whoami`

Print the currently authenticated user.

```bash
vocoder whoami
# Authenticated as eric@example.com (My Workspace)
```

---

### `vocoder wrap`

Automatically wrap string literals in your source code with `<T>` and `t()`.

```bash
vocoder wrap
```

Scans JSX/TSX files for user-facing string literals and wraps them with the appropriate translation markers. Uses AST analysis to detect strings that are likely user-facing (not keys, classnames, or internal identifiers).

**Options:**

| Flag | Description |
|---|---|
| `--include <pattern>` | Glob pattern(s) to include (repeatable) |
| `--exclude <pattern>` | Glob pattern(s) to exclude (repeatable) |
| `--dry-run` | Preview changes without modifying files |
| `--interactive` | Confirm each string interactively |
| `--confidence <level>` | Minimum confidence: `high`, `medium`, `low` (default: `high`) |
| `--verbose` | Detailed output |

---

## How `init` interacts with the browser

The CLI never redirects the terminal to a URL or relies on the browser to complete setup. Instead:

1. The CLI starts a local HTTP server on a random available port.
2. It requests an auth session from Vocoder, passing the local port as the callback destination.
3. The terminal displays the verification URL and (optionally) opens it in the system browser.
4. After the user signs in, `vocoder.app/auth/cli` silently pings `localhost:<port>/callback?token=...` in the background.
5. The CLI's local server receives the token instantly and the TUI continues — no polling delay.

If the local server fails to bind (port conflict, firewall), the CLI falls back to polling `GET /api/cli/auth/session` every 2 seconds until the token is available.

The same local server pattern is used for the GitHub App install callback.

---

## String Extraction

The `wrap` command uses Babel to parse JSX/TSX files and detect strings that are likely user-facing:

- JSX text content is wrapped with `<T>`
- String props like `placeholder`, `title`, `aria-label` are wrapped with `t()`
- Non-translatable strings (class names, keys, URLs) are left alone

It tracks imports from `@vocoder/react` to avoid double-wrapping strings already marked for translation.

---

## Git Integration

The CLI auto-detects the repository and branch:

- **Repository:** Reads the git remote URL and normalizes it to a canonical format (`github:owner/repo`)
- **Branch:** Checks CI environment variables first (GitHub Actions, Vercel, Netlify, etc.), then falls back to reading `.git/HEAD`
- **Scope path:** For monorepos, computes the relative path from the git root to the working directory

---

## Environment Variables

| Variable | Used by | Purpose |
|---|---|---|
| `VOCODER_API_KEY` | `sync`, MCP | Project API key (`vc_` prefix) |
| `VOCODER_AUTH_TOKEN` | `init` | Override stored user auth token (`vcu_` prefix) |
| `VOCODER_API_URL` | All commands | Override API base URL (default: `https://vocoder.app`) |

---

## License

MIT
