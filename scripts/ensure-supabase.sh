#!/bin/bash
set -euo pipefail

# Tim's Mac dotfiles select remote mode for normal development. Other hosts
# retain local behavior, and CI always uses its own local stack. Local mode on
# Tim's Mac is an explicit opt-in, never an outage fallback.

backend="${PINPOINT_SUPABASE_BACKEND:-local}"
if [[ "${CI:-}" == "1" || "${CI:-}" == "true" ]]; then
  backend=local
fi
if [[ "$backend" != remote && "$backend" != local ]]; then
  echo "Error: PINPOINT_SUPABASE_BACKEND must be remote or local." >&2
  exit 2
fi

if [[ "$backend" == remote ]]; then
  python3 scripts/remote-supabase.py start
  exit $?
fi

# Local mode only checks readiness. Start a local stack explicitly from the
# correct worktree; this guard never starts one for CI or interactive opt-in.

if ! command -v supabase &>/dev/null; then
  echo "Error: supabase CLI is not installed." >&2
  exit 1
fi

# A healthy localhost URL can still be an owned remote SSH forward. Confirm
# both service ports belong to this worktree's running local Docker stack.
if ! python3 scripts/assert-local-stack.py --require-api; then
  echo "  Start this worktree's local stack with: supabase start" >&2
  exit 1
fi

# Use worktree-specific URL (set in .env.local by post-checkout hook)
SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-http://localhost:54321}"

if ! curl -fsS --max-time 2 "${SUPABASE_URL}/auth/v1/health" >/dev/null 2>&1; then
  echo "Error: Supabase is not running at ${SUPABASE_URL}." >&2
  echo "  Start it with: supabase start" >&2
  exit 1
fi

echo "Supabase is running at ${SUPABASE_URL}."
