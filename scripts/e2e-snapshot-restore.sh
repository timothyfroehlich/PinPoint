#!/usr/bin/env bash
#
# Restore E2E Database Snapshot
#
# Restores a PostgreSQL dump of the Supabase local database state for E2E tests.
# This is much faster (2-5s) than re-seeding (25-65s).
#
# Usage:
#   npm run e2e:snapshot:restore
#   # or directly:
#   ./scripts/e2e-snapshot-restore.sh

# Skip in remote environments (requires Supabase and pg_restore)
if [ -n "${IS_REMOTE_ENVIRONMENT:-}" ]; then
  echo "ℹ️  Skipping E2E snapshot restoration in remote environment - this operation requires Supabase CLI and PostgreSQL client tools and will run in CI instead"
  exit 0
fi

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SNAPSHOT_FILE="${PROJECT_ROOT}/e2e/fixtures/test-database.dump"

# Supabase local PostgreSQL connection details
PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-54322}"
PGUSER="${PGUSER:-postgres}"
PGDATABASE="${PGDATABASE:-postgres}"
PGPASSWORD="${PGPASSWORD:-postgres}"

# Check if snapshot exists
if [ ! -f "${SNAPSHOT_FILE}" ]; then
  echo "❌ Database snapshot not found: ${SNAPSHOT_FILE}"
  echo ""
  echo "Create a snapshot first:"
  echo "  1. npm run db:reset (seed fresh database)"
  echo "  2. npm run e2e:snapshot:create (capture state)"
  exit 1
fi

echo "🔄 Restoring database snapshot..."
echo "   Host: ${PGHOST}:${PGPORT}"
echo "   Database: ${PGDATABASE}"
echo "   Snapshot: ${SNAPSHOT_FILE}"

# Export password for pg_restore
export PGPASSWORD

set +e
RESTORE_OUTPUT="$(
  pg_restore \
    -h "${PGHOST}" \
    -p "${PGPORT}" \
    -U "${PGUSER}" \
    -d "${PGDATABASE}" \
    --no-owner \
    --no-acl \
    --single-transaction \
    --clean \
    --if-exists \
    "${SNAPSHOT_FILE}" 2>&1
)"
RESTORE_STATUS=$?
set -e

echo "${RESTORE_OUTPUT}" | grep -v "NOTICE:" || true

if [ "${RESTORE_STATUS}" -ne 0 ]; then
  if echo "${RESTORE_OUTPUT}" | grep -q "must be owner of event trigger pgrst_drop_watch"; then
    echo "⚠️  Ignoring known Supabase event trigger ownership warning (pgrst_drop_watch)."
  else
    echo "❌ pg_restore failed"
    exit "${RESTORE_STATUS}"
  fi
fi

echo "✅ Database snapshot restored successfully"
echo ""
echo "💡 Database is now ready for E2E tests"
