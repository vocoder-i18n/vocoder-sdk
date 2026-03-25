# @vocoder/cli

Command-line tool for Vocoder. Handles project setup and automatic string wrapping for translation.

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

Connect your repository to Vocoder.

```bash
vocoder init
```

The command detects your git remote and checks if a Vocoder project already exists for the repository. If found, it confirms the connection and prints next steps. If not, it opens a browser-based setup flow to create a new project.

**Options:**

| Flag | Description |
|---|---|
| `--yes` | Skip confirmation prompts |
| `--project-name <name>` | Pre-fill project name |
| `--source-locale <locale>` | Pre-fill source locale |
| `--target-locales <list>` | Comma-separated target locales (e.g., `es,fr,de`) |

### `vocoder wrap`

Automatically wrap string literals in your source code with `<T>` and `t()`.

```bash
vocoder wrap
```

Scans your JSX/TSX files for user-facing string literals and wraps them with the appropriate Vocoder translation markers. Uses AST analysis to detect strings that are likely user-facing (not keys, classnames, or internal identifiers).

**Options:**

| Flag | Description |
|---|---|
| `--include <pattern>` | Glob pattern(s) to include (repeatable) |
| `--exclude <pattern>` | Glob pattern(s) to exclude (repeatable) |
| `--dry-run` | Preview changes without modifying files |
| `--interactive` | Confirm each string interactively |
| `--confidence <level>` | Minimum confidence: `high`, `medium`, `low` (default: `high`) |
| `--verbose` | Detailed output |

## String Extraction

The `wrap` command uses Babel to parse JSX/TSX files and detect strings that are likely user-facing. It distinguishes between:

- JSX text content (wrapped with `<T>`)
- String props like `placeholder`, `title`, `aria-label` (wrapped with `t()`)
- Non-translatable strings like class names, keys, and URLs (left alone)

It tracks imports from `@vocoder/react` to avoid double-wrapping strings that are already marked for translation.

## Git Integration

The CLI auto-detects the repository and branch:

- **Repository:** Reads the git remote URL and normalizes it to a canonical format (`github:owner/repo`)
- **Branch:** Checks CI environment variables first (GitHub Actions, Vercel, Netlify, etc.), then falls back to reading `.git/HEAD`
- **Scope path:** For monorepos, computes the relative path from the git root to the working directory

## License

MIT
