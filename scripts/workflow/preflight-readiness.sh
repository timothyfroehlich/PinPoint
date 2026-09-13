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

# Match Node's --env-file behavior for both database selectors: load worktree
# defaults, then restore every value the caller defined (including empty ones).
postgres_url_was_defined=false
postgres_url_override="${POSTGRES_URL-}"
if [[ ${POSTGRES_URL+x} == x ]]; then
  postgres_url_was_defined=true
fi
non_pooling_url_was_defined=false
non_pooling_url_override="${POSTGRES_URL_NON_POOLING-}"
if [[ ${POSTGRES_URL_NON_POOLING+x} == x ]]; then
  non_pooling_url_was_defined=true
fi
supabase_url_was_defined=false
supabase_url_override="${NEXT_PUBLIC_SUPABASE_URL-}"
if [[ ${NEXT_PUBLIC_SUPABASE_URL+x} == x ]]; then
  supabase_url_was_defined=true
fi

# shellcheck source=/dev/null
source .env.local 2>/dev/null || true
if [[ "$postgres_url_was_defined" == true ]]; then
  POSTGRES_URL="$postgres_url_override"
fi
if [[ "$non_pooling_url_was_defined" == true ]]; then
  POSTGRES_URL_NON_POOLING="$non_pooling_url_override"
fi
if [[ "$supabase_url_was_defined" == true ]]; then
  NEXT_PUBLIC_SUPABASE_URL="$supabase_url_override"
fi

database_url="${POSTGRES_URL:-}"
remediation="supabase start && pnpm run db:migrate"
stack_overridden=false
if [[ "$postgres_url_was_defined" == true \
  || "$non_pooling_url_was_defined" == true \
  || "$supabase_url_was_defined" == true ]]; then
  stack_overridden=true
fi

if [[ -z "$database_url" ]]; then
  if [[ "$postgres_url_was_defined" == true ]]; then
    printf '%s\n' \
      "FAIL: preflight readiness — POSTGRES_URL is explicitly empty" \
      "Run: unset POSTGRES_URL POSTGRES_URL_NON_POOLING NEXT_PUBLIC_SUPABASE_URL" >&2
    exit 1
  fi
  if [[ "$non_pooling_url_was_defined" == true ]]; then
    printf '%s\n' \
      "FAIL: preflight readiness — local stack overrides must be defined together and match" \
      "Run: unset POSTGRES_URL POSTGRES_URL_NON_POOLING NEXT_PUBLIC_SUPABASE_URL" >&2
    exit 1
  fi
  printf '%s\n' \
    "FAIL: preflight readiness — POSTGRES_URL is not configured" \
    "Run: python3 scripts/worktree_setup.py" >&2
  exit 1
fi

if [[ "$stack_overridden" == true \
  && ( "$postgres_url_was_defined" != true \
    || "$non_pooling_url_was_defined" != true \
    || "$supabase_url_was_defined" != true \
    || "${POSTGRES_URL_NON_POOLING:-}" != "$database_url" ) ]]; then
  printf '%s\n' \
    "FAIL: preflight readiness — local stack overrides must be defined together and match" \
    "Run: unset POSTGRES_URL POSTGRES_URL_NON_POOLING NEXT_PUBLIC_SUPABASE_URL" >&2
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

if [[ "$stack_overridden" == true ]]; then
  supabase_target="${NEXT_PUBLIC_SUPABASE_URL#*://}"
  supabase_target="${supabase_target%%/*}"
  supabase_target="${supabase_target%%\?*}"
  database_port="${database_target##*:}"
  supabase_port="${supabase_target##*:}"
  if [[ "$supabase_target" != localhost:* \
    || ! "$database_port" =~ ^[0-9]+$ \
    || ! "$supabase_port" =~ ^[0-9]+$ ]] \
    || (( 10#$database_port != 10#$supabase_port + 1 )); then
    printf '%s\n' \
      "FAIL: preflight readiness — local stack overrides do not identify one worktree stack" \
      "Run: unset POSTGRES_URL POSTGRES_URL_NON_POOLING NEXT_PUBLIC_SUPABASE_URL" >&2
    exit 1
  fi
fi

availability_remediation="$remediation"
divergence_remediation="pnpm run db:reset"
if [[ "$stack_overridden" == true ]]; then
  remediation="pnpm run db:migrate"
  availability_remediation="start the local Supabase stack that owns ${database_target}"
  divergence_remediation="reset ${database_target} from its owning worktree"
fi

if ! command -v pg_isready >/dev/null 2>&1 \
  || ! pg_isready -d "$database_url" -t 1 >/dev/null 2>&1; then
  printf '%s\n' \
    "FAIL: preflight readiness — Postgres is unavailable at ${database_target}" \
    "Run: ${availability_remediation}" >&2
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
    const migrations = journal.entries.map(({ tag, when }) => {
      if (!/^[A-Za-z0-9_-]+$/.test(tag) || !Number.isSafeInteger(when)) process.exit(1);
      const hash = crypto
        .createHash("sha256")
        .update(fs.readFileSync(`${migrationRoot}/${tag}.sql`))
        .digest("hex");
      return { tag, hash, when };
    });
    if (
      migrations.length === 0 ||
      new Set(migrations.map(({ hash }) => hash)).size !== migrations.length
    ) process.exit(1);
    const quote = String.fromCharCode(39);
    const rows = migrations.map(
      ({ tag, hash, when }) =>
        `(${quote}${tag}${quote},${quote}${hash}${quote},${when})`,
    );
    process.stdout.write(`${migrations.length}:${rows.join(",")}`);
  ' "${repository_root}/drizzle"
} 2>/dev/null || true)"

expected_migration_count="${migration_manifest%%:*}"
expected_migration_rows="${migration_manifest#*:}"
if [[ "$migration_manifest" != *:* \
  || ! "$expected_migration_count" =~ ^[0-9]+$ \
  || -z "$expected_migration_rows" ]]; then
  printf '%s\n' \
    "FAIL: preflight readiness — current migration journal is unreadable" \
    "Run: mise install --locked" >&2
  exit 1
fi

migration_status="$({
  psql "$database_url" -XqAt -v ON_ERROR_STOP=1 \
    -c "WITH expected(tag, hash, created_at) AS (VALUES ${expected_migration_rows}),
             applied(hash, created_at) AS (
               SELECT hash, created_at FROM drizzle.__drizzle_migrations
             )
        SELECT CASE
          WHEN EXISTS (
            SELECT 1 FROM applied a
            WHERE NOT EXISTS (
              SELECT 1 FROM expected e WHERE a.hash = e.hash OR a.hash = e.tag
            )
          ) THEN 'diverged'
          WHEN EXISTS (
            SELECT 1 FROM expected e
            WHERE (SELECT COUNT(*) FROM applied a WHERE a.hash = e.hash OR a.hash = e.tag) > 1
          ) THEN 'diverged'
          WHEN EXISTS (
            SELECT 1 FROM expected e
            WHERE NOT EXISTS (
              SELECT 1 FROM applied a WHERE a.hash = e.hash OR a.hash = e.tag
            )
              AND e.created_at <= COALESCE((SELECT MAX(created_at) FROM applied), 0)
          ) THEN 'diverged'
          WHEN EXISTS (
            SELECT 1 FROM expected e
            WHERE NOT EXISTS (
              SELECT 1 FROM applied a WHERE a.hash = e.hash OR a.hash = e.tag
            )
          ) THEN 'behind'
          WHEN (SELECT COUNT(*) FROM applied) <> ${expected_migration_count} THEN 'diverged'
          ELSE 'ready'
        END;"
} 2>/dev/null || true)"

if [[ "$migration_status" == "diverged" ]]; then
  printf '%s\n' \
    "FAIL: preflight readiness — Postgres at ${database_target} has a divergent migration history" \
    "Run: ${divergence_remediation}" >&2
  exit 1
fi

if [[ "$migration_status" != "ready" ]]; then
  printf '%s\n' \
    "FAIL: preflight readiness — Postgres at ${database_target} is not migrated" \
    "Run: ${remediation}" >&2
  exit 1
fi

if [[ "$quiet_success" == false ]]; then
  printf 'PASS: preflight readiness — Postgres ready at %s\n' "$database_target"
fi
