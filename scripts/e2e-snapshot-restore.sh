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

# Restore dump
# --clean: Drop database objects before restoring (handled by dump's --clean)
# --if-exists: Don't error if objects don't exist (handled by dump's --if-exists)
# --no-owner: Don't set object ownership
# --no-acl: Don't restore access privileges
# -d: Database to restore into
# --single-transaction: Restore as a single transaction (atomic, faster)
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
  "${SNAPSHOT_FILE}" 2>&1 | grep -v "NOTICE:" || true

echo "✅ Database snapshot restored successfully"
echo ""
echo "💡 Database is now ready for E2E tests"
