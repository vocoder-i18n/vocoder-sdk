# @vocoder/mcp

MCP server for [Vocoder](https://vocoder.app) — lets AI assistants (Claude, Cursor, Windsurf) set up and manage i18n in your project.

## Installation

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "vocoder": {
      "command": "npx",
      "args": ["-y", "@vocoder/mcp"],
      "env": {
        "VOCODER_API_KEY": "vc_..."
      }
    }
  }
}
```

### Cursor / Windsurf

Add to your IDE's MCP config (`.cursor/mcp.json` or `.windsurf/mcp.json`):

```json
{
  "mcpServers": {
    "vocoder": {
      "command": "npx",
      "args": ["-y", "@vocoder/mcp"],
      "env": {
        "VOCODER_API_KEY": "vc_..."
      }
    }
  }
}
```

Get your API key by running `npx @vocoder/cli init` in any project.

## Tools

### `vocoder_setup`

Detects your project's framework and returns everything needed to add Vocoder i18n: install command, build plugin config, provider wrapper, and usage example. Works without an API key.

```
Input:
  sourceLocale?   string    Source language (default: "en")
  targetLocales?  string[]  Target language codes, e.g. ["es", "fr", "de"]
```

### `vocoder_status`

Returns your project's configuration: name, org, source locale, target locales, target branches, and sync policy.

```
Input: none
Requires: VOCODER_API_KEY
```

### `vocoder_sync`

Extracts all translatable strings from the current project and submits them to Vocoder for translation. Polls until complete (up to 60 seconds).

```
Input:
  branch?  string                          Git branch (auto-detected)
  force?   boolean                         Re-sync even if unchanged
  mode?    "auto" | "required" | "best-effort"
Requires: VOCODER_API_KEY
```

### `vocoder_get_translations`

Fetches the current translation snapshot for a branch.

```
Input:
  branch?  string  Branch to fetch (default: "main")
  locale?  string  Single locale to return (returns all if omitted)
Requires: VOCODER_API_KEY
```

### `vocoder_add_locale`

Adds a new target language to your project.

```
Input:
  locale  string  BCP 47 locale code, e.g. "fr" or "pt-BR"
Requires: VOCODER_API_KEY
```

## Environment Variables

| Variable | Description |
|---|---|
| `VOCODER_API_KEY` | API key from `vocoder init`. Required for all tools except `vocoder_setup`. |
| `VOCODER_API_URL` | Override the API base URL (default: `https://vocoder.app`). |

## Example interaction

```
User: Add i18n to this project with Spanish and French support.

Claude: [calls vocoder_setup with targetLocales: ["es", "fr"]]
        → Detects Next.js, returns install command and snippets
        → Installs @vocoder/react and @vocoder/unplugin
        → Wraps root layout with VocoderProvider
        → Adds vocoderPlugin() to next.config.ts
        [calls vocoder_sync]
        → Extracts strings, submits for translation
        → Returns when translations are ready
```
