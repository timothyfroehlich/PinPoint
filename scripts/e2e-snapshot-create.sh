#!/usr/bin/env bash
#
# Create E2E Database Snapshot
#
# Creates a PostgreSQL dump of the current Supabase local database state
# for fast restoration in E2E tests. Run this after database seeding is complete.
#
# Usage:
#   npm run e2e:snapshot:create
#   # or directly:
#   ./scripts/e2e-snapshot-create.sh

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

echo "🔄 Creating database snapshot..."
echo "   Host: ${PGHOST}:${PGPORT}"
echo "   Database: ${PGDATABASE}"
echo "   Output: ${SNAPSHOT_FILE}"

# Export password for pg_dump
export PGPASSWORD

# Create dump with custom format (-Fc) for fast restoration
# --no-owner: Don't set object ownership (avoids permission issues)
# --no-acl: Don't dump access privileges (avoids permission issues)
# --clean: Add commands to clean (drop) database objects before recreating
# --if-exists: Use IF EXISTS when dropping objects
pg_dump \
  -h "${PGHOST}" \
  -p "${PGPORT}" \
  -U "${PGUSER}" \
  -d "${PGDATABASE}" \
  -Fc \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  -f "${SNAPSHOT_FILE}"

# Get file size for reporting
SNAPSHOT_SIZE=$(du -h "${SNAPSHOT_FILE}" | cut -f1)

echo "✅ Database snapshot created successfully"
echo "   File: ${SNAPSHOT_FILE}"
echo "   Size: ${SNAPSHOT_SIZE}"
echo ""
echo "💡 Tip: This snapshot will be restored automatically before E2E tests run"
echo "   To recreate the snapshot after schema changes:"
echo "   1. npm run db:reset (seed fresh database)"
echo "   2. npm run e2e:snapshot:create (capture new state)"
