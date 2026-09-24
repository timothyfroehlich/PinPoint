#!/usr/bin/env bash
# heavy-run.sh — wrap a command in the host-wide concurrency semaphore.
#
# Guards complete unit runs and heavier commands (integration, build, smoke)
# from stacking up across parallel worktree sessions on a memory-constrained
# host: at most 2 admitted jobs at a time, host-wide. Focused unit-file commands
# and static checks intentionally bypass this wrapper so they stay a fast inner
# loop.
#
# Transparent passthrough when:
#   - Running in CI ($CI is set), where the runner already isolates resources, OR
#   - GNU parallel's `sem` is not available (or the `sem` on PATH is the
#     moreutils variant that doesn't speak --jobs/--id/--fg).
#
# Usage (invoke via `bash` so no chmod is needed):
#   bash scripts/workflow/heavy-run.sh <command> [args…]

set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "Usage: bash scripts/workflow/heavy-run.sh <command> [args…]" >&2
  exit 64 # EX_USAGE
fi

if [ -n "${CI:-}" ]; then
  exec "$@"
fi

if ! command -v sem >/dev/null 2>&1 \
   || ! sem --version 2>/dev/null | grep -q '^GNU parallel'; then
  exec "$@"
fi

# GNU Parallel defaults to ~/.parallel, which is not writable in every agent
# sandbox. Every checkout on the host resolves this same state path instead.
export PARALLEL_HOME="${XDG_STATE_HOME:-${HOME}/.local/state}/pinpoint/parallel"
mkdir -p "$PARALLEL_HOME"

# sem re-joins its command argv and re-parses it through a shell, so an argument
# that legitimately contains a space (e.g. --project='Mobile Chrome' from the
# `smoke` script) would be word-split. Pre-quote each argument with printf %q
# and hand sem a single string. See PP-yso5.
quoted_cmd="$(printf '%q ' "$@")"

# --fg blocks synchronously and propagates the exit code.
exec sem --jobs 2 --id pinpoint-heavy --fg "$quoted_cmd"
