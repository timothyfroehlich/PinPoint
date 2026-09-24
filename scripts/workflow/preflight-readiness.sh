#!/usr/bin/env bash
# Read-only readiness gate: is this worktree's Supabase stack up and migrated?
# Runs first in preflight so a missing stack fails in seconds, not after the
# build. Reads the worktree's ports from .env.local the same way `pnpm dev` does.

set -euo pipefail

fail() {
  echo "FAIL: preflight readiness — $1. Run: ${2:-supabase start && pnpm run db:migrate}" >&2
  exit 1
}

[[ -f .env.local ]] || fail ".env.local is missing" "python3 scripts/worktree_setup.py"
set -a
# shellcheck source=/dev/null
source .env.local
set +a

# Report host:port only; never print the URL's credentials.
db_target="${POSTGRES_URL#*@}"
db_target="${db_target%%/*}"

pg_isready -q -t 2 -d "$POSTGRES_URL" \
  || fail "Postgres is not answering at ${db_target}"

curl -fsS --max-time 2 "${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health" >/dev/null 2>&1 \
  || fail "Supabase Auth is not answering at ${NEXT_PUBLIC_SUPABASE_URL}"

expected=$(node -p "require('./drizzle/meta/_journal.json').entries.length")
applied=$(psql "$POSTGRES_URL" -XqAt \
  -c "SELECT count(*) FROM drizzle.__drizzle_migrations" 2>/dev/null || echo 0)
[[ "$applied" == "$expected" ]] \
  || fail "${applied} of ${expected} migrations applied at ${db_target}"

echo "PASS: preflight readiness — Postgres ready at ${db_target}"
