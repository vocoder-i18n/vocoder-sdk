# @vocoder/mcp

MCP server for [Vocoder](https://vocoder.app) — lets AI assistants (Claude, Cursor, Windsurf) set up and manage i18n in your project.

## Installation

### Claude Code

```bash
claude mcp add --scope project --transport stdio \
  --env VOCODER_API_KEY=vc_... \
  vocoder -- npx -y @vocoder/mcp
```

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

Get your project API key by running `npx @vocoder/cli init` in your project directory.

---

## Tools

### `vocoder_setup`

Detects your project's framework and returns everything needed to integrate Vocoder: install command, build plugin config, provider wrapper, and usage examples. Works without an API key.

```
Input:
  sourceLocale?   string    Source language code (default: "en")
  targetLocales?  string[]  Target language codes, e.g. ["es", "fr", "de"]
```

### `vocoder_status`

Returns your project's current configuration: name, workspace, source locale, target locales, target branches, and sync policy.

```
Input:    none
Requires: VOCODER_API_KEY
```

### `vocoder_sync`

Extracts all translatable strings from the current project and submits them for translation. Polls until complete.

```
Input:
  branch?  string                              Git branch (auto-detected if omitted)
  force?   boolean                             Re-sync even if strings are unchanged
  mode?    "auto" | "required" | "best-effort"
Requires: VOCODER_API_KEY
```

### `vocoder_get_translations`

Fetches the current translation snapshot for a branch.

```
Input:
  branch?  string  Branch to fetch (default: "main")
  locale?  string  Single locale to return (returns all locales if omitted)
Requires: VOCODER_API_KEY
```

### `vocoder_list_locales`

Lists all locales supported by Vocoder with their BCP 47 codes and display names. Useful before calling `vocoder_add_locale` to find the correct code for a language.

```
Input:    none
Requires: VOCODER_API_KEY
```

### `vocoder_add_locale`

Adds a new target language to your project.

```
Input:
  locale  string  BCP 47 locale code, e.g. "fr" or "pt-BR"
Requires: VOCODER_API_KEY
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `VOCODER_API_KEY` | Project API key from `vocoder init`. Required for all tools except `vocoder_setup`. |
| `VOCODER_API_URL` | Override the API base URL (default: `https://vocoder.app`). |

---

## Example

```
User: Add Spanish and French support to this project.

Claude: [calls vocoder_setup with targetLocales: ["es", "fr"]]
        → Detects Next.js, returns install command and config snippets
        → Installs @vocoder/react and @vocoder/plugin
        → Adds VocoderProvider to the root layout
        → Adds vocoderPlugin() to next.config.ts
        [calls vocoder_sync]
        → Extracts strings, submits for translation
        → Returns translated content when ready
```

## License

MIT
