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

# Applied migrations must be exactly this branch's journal: Drizzle records each
# by its journal `when` (created_at), mark-migration-applied.ts by its tag (hash).
# db:fast-reset only truncates data, so a schema migrated on another branch would
# otherwise reach the tests.
command -v psql >/dev/null || fail "psql is not installed" "install the PostgreSQL client"
if ! applied=$(psql "$POSTGRES_URL" -XqAt -F ' ' \
  -c "SELECT created_at, hash FROM drizzle.__drizzle_migrations" 2>&1); then
  [[ "$applied" == *"does not exist"* ]] \
    || fail "could not read migrations at ${db_target}: ${applied}" "python3 scripts/worktree_setup.py"
  applied=""
fi
# shellcheck disable=SC2016  # a Node program, not shell
problem=$(printf '%s\n' "$applied" | node -e '
  const journal = require("./drizzle/meta/_journal.json").entries;
  const byWhen = new Map(journal.map((m) => [String(m.when), m.tag]));
  const tags = new Set(journal.map((m) => m.tag));
  const rows = require("node:fs").readFileSync(0, "utf8").split("\n").filter(Boolean);
  const matched = rows.map((row) => {
    const [when, hash] = row.split(" ");
    return byWhen.get(when) ?? (tags.has(hash) ? hash : null);
  });
  if (matched.includes(null) || new Set(matched).size !== matched.length) {
    console.log("diverged");
  } else if (matched.length < tags.size) {
    console.log(`${matched.length} of ${tags.size} migrations applied`);
  }
')
[[ "$problem" != diverged ]] \
  || fail "applied migrations at ${db_target} are not this branch's" "pnpm run db:reset"
[[ -z "$problem" ]] || fail "${problem} at ${db_target}"

echo "PASS: preflight readiness — Postgres ready at ${db_target}"
