---
"@vocoder/mcp": minor
---

`vocoder_init_complete` no longer blocks waiting for browser sign-in, and
sessions survive a restart.

It looped for up to five minutes polling the auth session. Most MCP clients time
out long before that, killing the call while the session was still valid and
leaving no way to resume. It now polls once and returns `pending: true` with
instructions to call again with the same `sessionId`.

Sessions move from a process-local `Map` to `~/.vocoder/mcp-sessions.json`. The
setup flow tells the user to restart their editor after adding the API key,
which used to destroy the session the next step needs. Entries carry an expiry
and are pruned on read.

`InitCompleteResult.authenticated` is now `boolean` rather than the literal
`true`, and gains an optional `pending` flag.
