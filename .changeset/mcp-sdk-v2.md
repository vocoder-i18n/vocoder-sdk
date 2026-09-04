---
"@vocoder/mcp": minor
---

Port the MCP server to `@modelcontextprotocol/server` v2, and report the real
server version.

The server was built on `@modelcontextprotocol/sdk` v1. It now uses the v2
package: `server.tool(name, description, shape, cb)` becomes
`server.registerTool(name, { description, inputSchema }, cb)`, `server.resource`
becomes `server.registerResource`, and input schemas are `z.object(...)` rather
than raw shapes. All 13 tools and 10 resources are ported; behaviour is
unchanged.

v2 requires Zod 4, so the package moves from `zod@^3.24.0` to `zod@^4.2.0`.
Zod is used nowhere else in the monorepo, and only for `z.object`, `z.string`,
`z.array`, `.optional()` and `.describe()`, all of which are unchanged across
the major.

`serverInfo.version` is now read from package.json. It was hardcoded to `0.1.0`
while the package shipped `0.22.0`, and connecting clients display it.

Note this does **not** move the negotiated protocol version. Both the v1 SDK at
1.30.0 and the v2 server at 2.0.0 report `LATEST_PROTOCOL_VERSION: 2025-11-25`;
no released TypeScript package implements the 2026-07-28 revision yet. The
reason to be on v2 is that it ships the MRTR primitives — `inputRequired`,
`acceptedContent`, `createRequestStateCodec` — which are what replace the
blocking auth poll.
