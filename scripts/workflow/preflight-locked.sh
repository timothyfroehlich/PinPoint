#!/usr/bin/env bash
# preflight-locked.sh — wrap `pnpm run preflight` in a host-wide concurrency cap.
#
# Caps concurrent preflights to 2 per host using GNU parallel's `sem` (a
# persistent counting semaphore stored under ~/.parallel/semaphores/).
#
# Rationale: a single preflight peaks at ~1.5 GB of vitest RSS + ~2 GB during
# `next build`. Two concurrent preflights = ~3 GB combined peak; three or more
# start swapping on a typical laptop. The cap protects developers
# who keep multiple worktrees open and accidentally fire preflight in two of
# them at once.
#
# Escape hatch: `pnpm run preflight:unlocked` bypasses the cap. Add `:human`
# to either public command to stream the same gate graph instead of receiving
# the compact agent-facing verdict.
#
# Companion: PR #1403 (PP-pblt) shipped the per-run memory reduction.
# This script adds the cross-session bound.

set -euo pipefail

human=false
if [[ ${1:-} == "--human" ]]; then
  human=true
  shift
fi
if [[ $# -ne 0 ]]; then
  echo "Usage: bash scripts/workflow/preflight-locked.sh [--human]" >&2
  exit 64
fi

if ! command -v sem >/dev/null 2>&1 \
   || ! sem --version 2>/dev/null | grep -q '^GNU parallel'; then
  # moreutils also ships a `sem` binary that doesn't speak --jobs/--id/--fg,
  # so we additionally probe `sem --version` for the GNU parallel banner.
  cat >&2 <<'EOF'
Error: GNU parallel's `sem` not found (or `sem` on PATH is from another
package, e.g. moreutils — that variant doesn't speak --jobs/--id/--fg).

`pnpm run preflight` uses GNU parallel's `sem` to cap host-wide preflight
concurrency at 2. Install it:

  macOS:  brew install parallel
  Linux:  apt install parallel  (or your distro equivalent)

If you cannot or do not want to install it, run the matching uncapped variant:

  pnpm run preflight:unlocked
  pnpm run preflight:unlocked:human
EOF
  exit 1
fi

# --jobs 2:           up to 2 concurrent preflights across all worktrees
# --id pinpoint-preflight:  named semaphore shared across processes
# --fg:               block until this command finishes and propagate exit code.
#                     (Note: GNU sem's `--wait` is for draining queued jobs at
#                     end of script, not blocking on a single invocation. Using
#                     `--fg --wait` together causes sem to return immediately —
#                     `--fg` alone is the synchronous form.)
# `preflight:_run` is the one canonical graph for capped, uncapped, compact,
# and human runs. The presentation layer is the only difference.
run_command=(pnpm run preflight:_run)
if [[ $human == false ]]; then
  run_command=(
    python3 scripts/quiet-run.py --label preflight -- "${run_command[@]}"
  )
fi

# sem re-parses a command string through a shell. Quote each argument first so
# future paths or arguments containing spaces survive that boundary.
printf -v quoted_command '%q ' "${run_command[@]}"
exec sem --jobs 2 --id pinpoint-preflight --fg "$quoted_command"
