#!/usr/bin/env bash
# preflight-locked.sh — wrap `pnpm run preflight` in a host-wide concurrency cap.
#
# Caps concurrent preflights to 2 per host using GNU parallel's `sem` (a
# persistent counting semaphore stored under ~/.parallel/semaphores/).
#
# Rationale: a single preflight peaks at ~1.5 GB of vitest RSS + ~2 GB during
# `next build`. Two concurrent preflights = ~3 GB combined peak, comfortable
# on a 16 GB Mac. Three or more start swapping. The cap protects developers
# who keep multiple worktrees open and accidentally fire preflight in two of
# them at once.
#
# Escape hatch: `pnpm run preflight:unlocked` bypasses the cap (useful when
# `sem` isn't installed, or for one-off debugging).
#
# Companion: PR #1403 (PP-pblt) shipped the per-run memory reduction.
# This script adds the cross-session bound.

set -euo pipefail

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

If you cannot or do not want to install it, run the uncapped variant:

  pnpm run preflight:unlocked
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
exec sem --jobs 2 --id pinpoint-preflight --fg \
  npm-run-all --silent \
    --parallel typecheck lint:fix format:fix test check:config \
    --sequential db:fast-reset build test:integration test:integration:supabase smoke
