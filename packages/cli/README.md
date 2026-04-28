# @vocoder/cli

Command-line tool for Vocoder. Handles project setup, string extraction, and translation sync.

## Installation

```bash
npm install -g @vocoder/cli
```

Or use without installing:

```bash
npx @vocoder/cli <command>
```

## Commands

### `vocoder init`

Connect your repository to Vocoder. Runs an interactive TUI that handles authentication, workspace setup, and project configuration — all in the terminal. Only one browser step is required (GitHub authorization), and only on first run.

```bash
vocoder init
```

**First-time setup:**

The CLI opens the Vocoder GitHub App installation page. Authorizing the App creates your account and workspace in one step — no separate sign-up required.

```
┌  Vocoder Setup

◆  Opening GitHub to connect your account...
│  Authorize Vocoder and install the GitHub App in one step.
│
│  https://github.com/apps/vocoder/installations/new?state=...
│
◆  Open in your browser? › Yes

◒  Waiting for GitHub authorization...

◇  Connected as @username — workspace: username

◆  App Directory (Optional)
│  Leave blank to cover the entire repository (or enter a subdirectory for monorepos)

◆  Source language (type to search)
│  English — en

◆  Target languages (type to search, space to select)
│  ◼ Spanish — es

◆  Target branches
│  ◼ main

◒  Creating project...

◆  Finish setup in your code

◆  vite.config.ts  — register the build plugin so Vocoder can extract your strings
◆  your root layout or App component  — wrap your app so translations load at runtime
◆  wrap translatable text  — mark strings for extraction — Vocoder picks these up on push

✓  Push to main to trigger your first translation run.

◆  Your API Key
│  ┌─────────────────────────────────────────┐
│  │ VOCODER_API_KEY=vcp_xxxx               │
│  └─────────────────────────────────────────┘
✓  Saved to .env

◇  You're all set.
```

**Returning user (stored credentials):**

No browser opens. The stored token is verified and the flow continues in the terminal.

```
┌  Vocoder Setup

◇  Authenticated as user@example.com

◆  Select workspace
│  ● my-workspace  (3 projects)
│  ○ + Create new workspace
```

**Monorepo support:**

When running `vocoder init` from a subdirectory of a git repository, the CLI automatically suggests that subdirectory as the app directory. Each app in a monorepo should be set up as a separate Vocoder project.

**Options:**

| Flag | Description |
|---|---|
| `--yes` | Skip the "Open in your browser?" confirmation |
| `--ci` | Non-interactive mode. Prints `VOCODER_AUTH_URL: <url>` to stdout instead of opening a browser. Intended for CI environments where the browser step is driven externally. |

**Stored credentials:**

After first sign-in, the CLI stores credentials at `~/.config/vocoder/auth.json` (mode `0600`). Tokens do not expire. Use `vocoder logout` to revoke.

**Token resolution:**

| Command | Source |
|---|---|
| `vocoder init` | `VOCODER_AUTH_TOKEN` env var → `~/.config/vocoder/auth.json` |
| `vocoder sync` | `VOCODER_API_KEY` env var → `.env` file |
| MCP tools | `VOCODER_API_KEY` env var |

---

### `vocoder sync`

Extract translatable strings from your source code and submit them for translation.

```bash
vocoder sync
```

Reads `VOCODER_API_KEY` from environment or `.env`. Detects `<T>` and `t()` usages, submits them to Vocoder, and polls until translations are returned. Writes locale JSON files to the configured output path.

**Options:**

| Flag | Description |
|---|---|
| `--include <glob>` | Glob pattern for files to scan (repeatable). Default: `**/*.{tsx,jsx,ts,js}` |
| `--exclude <glob>` | Glob pattern to skip (repeatable). Merged with built-in excludes |
| `--locale <code>` | Sync only this target locale |
| `--dry-run` | Show what would be synced without submitting |
| `--verbose` | Show extraction and sync details |

Patterns can also be set via env vars: `VOCODER_INCLUDE_PATTERN` and `VOCODER_EXCLUDE_PATTERN` (comma-separated).

---

### `vocoder logout`

Revoke the stored credentials and clear `~/.config/vocoder/auth.json`.

```bash
vocoder logout
```

The token is also revoked server-side.

---

### `vocoder whoami`

Print the currently authenticated user.

```bash
vocoder whoami
# Authenticated as user@example.com (my-workspace)
```

---

## How `init` interacts with the browser

`vocoder init` opens exactly one browser window, and only on first run. The browser is used to authorize the Vocoder GitHub App — this simultaneously authenticates you and connects your GitHub account, so no separate sign-up is needed.

Once the GitHub authorization is complete, the browser redirects back and the CLI receives your credentials automatically via a local callback server. The rest of setup happens in the terminal.

On subsequent runs, the stored token is used directly and no browser is needed.

---

## Git Integration

The CLI auto-detects repository context from the working directory:

- **Repository:** Reads the git remote URL and normalizes it to `github:owner/repo`
- **Branch:** Checks CI environment variables first (GitHub Actions, Vercel, Netlify, etc.), then falls back to `.git/HEAD`
- **App directory:** For monorepos, computes the relative path from the git root to `process.cwd()`

---

## Environment Variables

| Variable | Used by | Purpose |
|---|---|---|
| `VOCODER_API_KEY` | `sync`, MCP | Project API key (`vc_` prefix) |
| `VOCODER_AUTH_TOKEN` | `init` | Override stored user token (`vcu_` prefix) |
| `VOCODER_API_URL` | All commands | Override API base URL (default: `https://vocoder.app`) |

---

## License

MIT
