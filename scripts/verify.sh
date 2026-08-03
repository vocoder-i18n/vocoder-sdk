#!/usr/bin/env bash
#
# The gate. See specs/022-verify-acceptance-manifest/contracts/verify-cli.md.
#
#   ./scripts/verify.sh              # verify the current branch
#   ./scripts/verify.sh --evidence   # emit only the evidence block, no checks
#
# Thin orchestration only — record parsing, criteria resolution, the
# disclosure scan, and evidence rendering live in scripts/verify/*.ts, where
# vitest can reach them. This wrapper resolves the repo root and propagates
# the exit code unchanged via `exec`.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

exec pnpm exec tsx scripts/verify/index.ts "$@"
