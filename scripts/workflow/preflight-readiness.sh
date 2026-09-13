#!/usr/bin/env bash
# Read-only readiness gate for the local database required by preflight.

set -euo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
readonly script_dir
repository_root=$(cd "${script_dir}/../.." && pwd -P)
readonly repository_root

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

relations_ready="$({
  psql "$database_url" -XqAt -v ON_ERROR_STOP=1 \
    -c "SELECT to_regclass('public.machines') IS NOT NULL AND to_regclass('drizzle.__drizzle_migrations') IS NOT NULL;"
} 2>/dev/null || true)"

if [[ "$relations_ready" != "t" ]]; then
  printf '%s\n' \
    "FAIL: preflight readiness — Postgres at ${database_target} is not migrated" \
    "Run: ${remediation}" >&2
  exit 1
fi

migration_manifest="$({
  # JavaScript template literals expand in Node, not Bash.
  # shellcheck disable=SC2016
  node -e '
    const crypto = require("node:crypto");
    const fs = require("node:fs");
    const migrationRoot = process.argv[1];
    const journal = JSON.parse(
      fs.readFileSync(`${migrationRoot}/meta/_journal.json`, "utf8"),
    );
    const hashes = journal.entries.map(({ tag }) =>
      crypto
        .createHash("sha256")
        .update(fs.readFileSync(`${migrationRoot}/${tag}.sql`))
        .digest("hex"),
    );
    if (hashes.length === 0 || new Set(hashes).size !== hashes.length) process.exit(1);
    process.stdout.write(`${hashes.length}:${hashes.join(",")}`);
  ' "${repository_root}/drizzle"
} 2>/dev/null || true)"

expected_migration_count="${migration_manifest%%:*}"
expected_migration_hashes="${migration_manifest#*:}"
if [[ "$migration_manifest" != *:* \
  || ! "$expected_migration_count" =~ ^[0-9]+$ \
  || ! "$expected_migration_hashes" =~ ^[0-9a-f]{64}(,[0-9a-f]{64})*$ ]]; then
  printf '%s\n' \
    "FAIL: preflight readiness — current migration journal is unreadable" \
    "Run: mise install --locked" >&2
  exit 1
fi

expected_hash_sql="'${expected_migration_hashes//,/','}'"
migrations_current="$({
  psql "$database_url" -XqAt -v ON_ERROR_STOP=1 \
    -c "SELECT COUNT(DISTINCT hash) = ${expected_migration_count} FROM drizzle.__drizzle_migrations WHERE hash IN (${expected_hash_sql});"
} 2>/dev/null || true)"

if [[ "$migrations_current" != "t" ]]; then
  printf '%s\n' \
    "FAIL: preflight readiness — Postgres at ${database_target} is not migrated" \
    "Run: ${remediation}" >&2
  exit 1
fi

if [[ "$quiet_success" == false ]]; then
  printf 'PASS: preflight readiness — Postgres ready at %s\n' "$database_target"
fi
