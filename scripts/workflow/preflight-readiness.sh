#!/usr/bin/env bash
# Read-only readiness gate for the local database required by preflight.

set -euo pipefail

quiet_success=false
if [[ ${1:-} == "--quiet-success" ]]; then
  quiet_success=true
  shift
fi
if [[ $# -ne 0 ]]; then
  echo "Usage: bash scripts/workflow/preflight-readiness.sh [--quiet-success]" >&2
  exit 64
fi

# shellcheck source=/dev/null
source .env.local 2>/dev/null || true

database_url="${POSTGRES_URL:-}"
remediation="supabase start && pnpm run db:migrate"

if [[ -z "$database_url" ]]; then
  printf '%s\n' \
    "FAIL: preflight readiness — POSTGRES_URL is not configured" \
    "Run: python3 scripts/worktree_setup.py" >&2
  exit 1
fi

# Strip the scheme, credentials, path, and query without ever printing them.
database_target="${database_url#*://}"
database_target="${database_target#*@}"
database_target="${database_target%%/*}"
database_target="${database_target%%\?*}"

if [[ "$database_target" != localhost:* ]]; then
  printf '%s\n' \
    "FAIL: preflight readiness — POSTGRES_URL is not a localhost worktree database" \
    "Run: python3 scripts/worktree_setup.py" >&2
  exit 1
fi

if ! command -v pg_isready >/dev/null 2>&1 \
  || ! pg_isready -d "$database_url" -t 1 >/dev/null 2>&1; then
  printf '%s\n' \
    "FAIL: preflight readiness — Postgres is unavailable at ${database_target}" \
    "Run: ${remediation}" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  printf '%s\n' \
    "FAIL: preflight readiness — psql is required to inspect ${database_target}" \
    "Run: mise install --locked" >&2
  exit 1
fi

initialized="$({
  psql "$database_url" -XqAt -v ON_ERROR_STOP=1 \
    -c "SELECT to_regclass('public.machines') IS NOT NULL AND to_regclass('drizzle.__drizzle_migrations') IS NOT NULL;"
} 2>/dev/null || true)"

if [[ "$initialized" != "t" ]]; then
  printf '%s\n' \
    "FAIL: preflight readiness — Postgres at ${database_target} is not migrated" \
    "Run: ${remediation}" >&2
  exit 1
fi

if [[ "$quiet_success" == false ]]; then
  printf 'PASS: preflight readiness — Postgres ready at %s\n' "$database_target"
fi
