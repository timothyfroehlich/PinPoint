#!/usr/bin/env bash
# preflight.sh — the full local gate for non-trivial changes, run in order and
# stopping at the first failure. Run it through `pnpm run preflight` (compact
# verdict via quiet-run.py) or `pnpm run preflight:human` (streamed), so
# node_modules/.bin is on PATH. Heavy leaf commands (unit, build, integration,
# smoke) take the host-wide heavy-run.sh slot themselves.

set -euo pipefail

step() {
  echo "== $1"
  shift
  "$@"
}

# Fail in seconds, not after the build, when the worktree stack is down.
step readiness bash scripts/workflow/preflight-readiness.sh
# Same static gate as `pnpm run check`, including the prototype-clean guard.
step check pnpm run check:human
step unit pnpm run test:human
step db-reset pnpm run db:fast-reset
step build pnpm run build
step integration pnpm run test:integration
step integration-supabase pnpm run test:integration:supabase
# Chromium only: one browser against the one worktree DB. CI runs the rest.
step smoke bash scripts/workflow/heavy-run.sh playwright test \
  --config=playwright.config.smoke.ts --project=chromium --quiet
echo "== preflight passed"
