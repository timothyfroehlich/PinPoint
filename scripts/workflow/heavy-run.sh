#!/usr/bin/env bash
# heavy-run.sh — wrap a command in the host-wide concurrency semaphore.
#
# Guards complete unit runs, static checks, and heavier commands
# (test:integration, build, smoke) from stacking up across parallel worktree
# sessions on a memory-constrained host. Focused unit-file commands intentionally
# bypass this wrapper so they remain a fast local inner loop.
#
# This is the local fallback admission layer. PP-3vdr.16 separately owns a
# supported Crabbox job for remote full-unit verdicts; it does not replace the
# local cap when a caller chooses `pnpm run test` or `pnpm run test:human`.
# Uses the same --jobs 2 slot count as preflight-locked.sh, but a SEPARATE id
# (`pinpoint-heavy` vs `pinpoint-preflight`). The two pools are intentionally
# distinct: preflight already holds an outer `pinpoint-preflight` slot and then
# invokes these same heavy steps internally, so sharing one id would have
# preflight wait on a slot it already owns — a self-deadlock. Bare heavy
# commands (run outside preflight) contend within `pinpoint-heavy`; preflight
# runs contend within `pinpoint-preflight`. Each pool independently caps at 2.
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
#   "test:_run": "pnpm run test:ensure-schema && bash scripts/workflow/heavy-run.sh vitest run …"

set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "Usage: bash scripts/workflow/heavy-run.sh <command> [args…]" >&2
  exit 64 # EX_USAGE
fi

# CI passthrough — runners already provide isolation; semaphore would deadlock
# on single-slot environments.
if [ -n "${CI:-}" ]; then
  exec "$@"
fi

# A memory-pressure gate used to run here, before the sem slot was acquired. It
# was one developer's hardware problem — 4–5 parallel agent sessions on a 16 GB
# laptop — living in a shared repo, so PP-p9cy moved it to that machine's own
# Claude hooks. What is left is the concurrency cap, which is true of any host.
#
# Detect GNU parallel's sem. moreutils also ships a `sem` binary that doesn't
# speak --jobs/--id/--fg, so probe the version banner too.
if ! command -v sem >/dev/null 2>&1 \
   || ! sem --version 2>/dev/null | grep -q '^GNU parallel'; then
  # Fall through silently — just run the command uncapped. The install hint
  # lives in preflight-locked.sh for the higher-stakes preflight case; here
  # we degrade gracefully instead of hard-failing.
  exec "$@"
fi

# GNU Parallel defaults to ~/.parallel, which is outside Codex's writable
# boundary. Keep PinPoint's semaphore state in the existing cross-worktree
# state root instead. Every checkout on the host resolves the same path, while
# PINPOINT_PARALLEL_HOME gives tests and unusual installations an explicit
# override without changing GNU Parallel's global configuration.
pinpoint_state_home="${XDG_STATE_HOME:-${HOME}/.local/state}/pinpoint"
pinpoint_parallel_home="${PINPOINT_PARALLEL_HOME:-$pinpoint_state_home/parallel}"
if ! mkdir -p "$pinpoint_parallel_home"; then
  echo "Error: cannot create PinPoint semaphore state: $pinpoint_parallel_home" >&2
  exit 1
fi

# sem re-joins its command argv and re-parses it through a shell, so an argument
# that legitimately contains a space (e.g. --project='Mobile Chrome' from the
# `smoke` script) would be word-split into two tokens. Pre-quote each argument
# with printf %q and hand sem a single string; the shell sem spawns then
# reconstructs the exact original argv. See PP-yso5.
quoted_cmd="$(printf '%q ' "$@")"

# --jobs 2:               up to 2 concurrent admitted jobs across all worktrees
# --id pinpoint-heavy:    pool distinct from preflight's (see header — avoids
#                         a self-deadlock when preflight nests these commands)
# --fg:                   block synchronously and propagate exit code
PARALLEL_HOME="$pinpoint_parallel_home" \
  exec sem --jobs 2 --id pinpoint-heavy --fg "$quoted_cmd"
