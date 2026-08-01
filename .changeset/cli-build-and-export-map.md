---
"@vocoder/cli": patch
---

Fix the CLI build emitting no JavaScript, and correct the `./lib` types path.

The ESM build failed to resolve `@babel/preset-typescript/package.json`, a
static require inside `@babel/core`'s config-file detector. The code path is
unreachable at runtime — `transformMsgProps` runs with `configFile: false`
and no presets — but esbuild resolves every require at bundle time. The same
stub already used in `@vocoder/plugin` is now applied here. Previously only
`.d.mts` files were emitted, which also broke `@vocoder/mcp`'s import of
`@vocoder/cli/lib`.

`exports["./lib"].types` pointed at `./dist/lib.d.ts`, but tsup emits
`lib.d.mts`, so TypeScript consumers of `@vocoder/cli/lib` resolved no types.
