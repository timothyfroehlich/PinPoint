#!/bin/bash
set -euo pipefail

# Guard: verify Supabase is running before the dev server starts.
# Does NOT auto-start — in multi-worktree setups, auto-starting from the
# wrong directory would use the wrong ports/config. Start explicitly.

if ! command -v supabase &>/dev/null; then
  echo "Error: supabase CLI is not installed." >&2
  exit 1
fi

# Use worktree-specific URL (set in .env.local by pinpoint-wt.py)
SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-http://localhost:54321}"

if ! curl -fsS --max-time 2 "${SUPABASE_URL}/auth/v1/health" >/dev/null 2>&1; then
  echo "Error: Supabase is not running at ${SUPABASE_URL}." >&2
  echo "  Start it with: supabase start" >&2
  exit 1
fi

echo "Supabase is running at ${SUPABASE_URL}."
