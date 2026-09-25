#!/usr/bin/env bash
# Read-only readiness gate: is this worktree's Supabase stack up and migrated?
# Runs first in preflight so a missing stack fails in seconds, not after the
# build. Reads the worktree's ports from .env.local without running it as
# bash (dotenv values need not be valid shell); an exported value wins, as
# it does for `pnpm dev`.

set -euo pipefail

fail() {
  echo "FAIL: preflight readiness — $1. Run: ${2:-pnpm supabase:start && pnpm run db:migrate}" >&2
  exit 1
}

[[ -f .env.local ]] || fail ".env.local is missing" "python3 scripts/worktree_setup.py"
# worktree_setup.py writes both keys as plain KEY=value lines.
env_value() {
  local line
  line=$(grep -E "^(export[[:space:]]+)?$1=" .env.local | tail -n 1) || true
  line="${line#*=}"
  line="${line#[\"\']}"
  printf '%s' "${line%[\"\']}"
}
POSTGRES_URL="${POSTGRES_URL:-$(env_value POSTGRES_URL)}"
NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-$(env_value NEXT_PUBLIC_SUPABASE_URL)}"
[[ -n "$POSTGRES_URL" && -n "$NEXT_PUBLIC_SUPABASE_URL" ]] \
  || fail ".env.local lacks POSTGRES_URL or NEXT_PUBLIC_SUPABASE_URL" "python3 scripts/worktree_setup.py"

# Report host:port only; never print the URL's credentials. Which hosts may be
# reset (localhost, or a PINPOINT_DEV_DB_HOSTS dev stack) is db:fast-reset's
# call: assert-local-db.mjs.
db_target="${POSTGRES_URL#*@}"
db_target="${db_target%%/*}"

pg_isready -q -t 15 -d "$POSTGRES_URL" \
  || fail "Postgres is not answering at ${db_target}"

curl -fsS --max-time 10 "${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health" >/dev/null 2>&1 \
  || fail "Supabase Auth is not answering at ${NEXT_PUBLIC_SUPABASE_URL}"

expected=$(node -p "require('./drizzle/meta/_journal.json').entries.length")
applied=$(psql "$POSTGRES_URL" -XqAt \
  -c "SELECT count(*) FROM drizzle.__drizzle_migrations" 2>/dev/null || echo 0)
[[ "$applied" == "$expected" ]] \
  || fail "${applied} of ${expected} migrations applied at ${db_target}"

echo "PASS: preflight readiness — Postgres ready at ${db_target}"
