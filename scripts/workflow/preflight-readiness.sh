#!/usr/bin/env bash
# Read-only readiness gate: is this worktree's Supabase stack up and migrated?
# Runs first in preflight so a missing stack fails in seconds, not after the
# build. Reads the worktree's ports through @next/env, the loader `pnpm dev`
# uses: dotenv parsing, and exported variables win over .env.local.

set -euo pipefail

fail() {
  echo "FAIL: preflight readiness — $1. Run: ${2:-supabase start && pnpm run db:migrate}" >&2
  exit 1
}

[[ -f .env.local ]] || fail ".env.local is missing" "python3 scripts/worktree_setup.py"
env_value() {
  node -e "require('@next/env').loadEnvConfig('.', true, { info() {}, error() {} });
    process.stdout.write(process.env[process.argv[1]] ?? '')" "$1"
}
POSTGRES_URL=$(env_value POSTGRES_URL)
NEXT_PUBLIC_SUPABASE_URL=$(env_value NEXT_PUBLIC_SUPABASE_URL)
[[ -n "$POSTGRES_URL" && -n "$NEXT_PUBLIC_SUPABASE_URL" ]] \
  || fail ".env.local lacks POSTGRES_URL or NEXT_PUBLIC_SUPABASE_URL" "python3 scripts/worktree_setup.py"

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
