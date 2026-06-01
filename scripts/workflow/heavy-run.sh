#!/usr/bin/env bash
# heavy-run.sh — wrap a command in the host-wide concurrency semaphore.
#
# Guards memory-intensive commands (test:integration, build, smoke) from
# stacking up across parallel worktree sessions on a 16 GB Mac. Uses the same
# semaphore id / slot count as preflight-locked.sh so all heavy jobs compete
# for the same pool.
#
# Transparent passthrough when:
#   - Running in CI ($CI is set), where resource isolation is already handled
#     by the runner, OR
#   - GNU parallel's `sem` is not available (or the `sem` on PATH is the
#     moreutils variant that doesn't speak --jobs/--id/--fg).
#
# Usage (invoke via `bash` so no chmod is needed):
#   bash scripts/workflow/heavy-run.sh <command> [args…]
#
# package.json wires this as:
#   "test:integration": "pnpm run test:ensure-schema && bash scripts/workflow/heavy-run.sh vitest run …"

set -euo pipefail

# CI passthrough — runners already provide isolation; semaphore would deadlock
# on single-slot environments.
if [ -n "${CI:-}" ]; then
  exec "$@"
fi

# Detect GNU parallel's sem. moreutils also ships a `sem` binary that doesn't
# speak --jobs/--id/--fg, so probe the version banner too.
if ! command -v sem >/dev/null 2>&1 \
   || ! sem --version 2>/dev/null | grep -q '^GNU parallel'; then
  # Fall through silently — just run the command uncapped. The install hint
  # lives in preflight-locked.sh for the higher-stakes preflight case; here
  # we degrade gracefully instead of hard-failing.
  exec "$@"
fi

# --jobs 2:               up to 2 concurrent heavy jobs across all worktrees
# --id pinpoint-heavy:    named semaphore shared with preflight slots
# --fg:                   block synchronously and propagate exit code
exec sem --jobs 2 --id pinpoint-heavy --fg "$@"
