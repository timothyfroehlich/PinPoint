#!/bin/bash
set -e

# Reset and seed a remote database (typically preview/staging)
# Usage: ./scripts/db-reset-preview.sh [--yes] [env-file]
# Example: ./scripts/db-reset-preview.sh .env.preview.local
# Example: ./scripts/db-reset-preview.sh --yes .env.preview.local

# Parse flags
SKIP_CONFIRM=false
ENV_FILE=".env.preview.local"

while [[ $# -gt 0 ]]; do
  case $1 in
    --yes|-y)
      SKIP_CONFIRM=true
      shift
      ;;
    *)
      ENV_FILE="$1"
      shift
      ;;
  esac
done

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: Environment file '$ENV_FILE' not found"
  exit 1
fi

echo "🔥 Resetting database using $ENV_FILE"
echo ""

# Load all env vars from file (excluding comments and empty lines)
set -a
source "$ENV_FILE"
set +a

if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL not found in $ENV_FILE"
  exit 1
fi

# Confirm before proceeding
if [ "$SKIP_CONFIRM" = false ]; then
  echo "⚠️  WARNING: This will DESTROY all data in the database!"
  echo "Database: $(echo $DATABASE_URL | sed -E 's/(:\/\/[^:]+:)[^@]+(@)/\1***\2/')"
  echo ""
  read -p "Are you sure? (yes/no): " confirm

  if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 0
  fi
else
  echo "⚠️  Skipping confirmation (--yes flag provided)"
  echo "Database: $(echo $DATABASE_URL | sed -E 's/(:\/\/[^:]+:)[^@]+(@)/\1***\2/')"
fi

echo ""
echo "1️⃣  Dropping and recreating schema..."
# Use Session Mode pooler (already IPv4-compatible)
psql "$DATABASE_URL" -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;" 2>&1 | grep -v "^NOTICE:" | grep -v "^DETAIL:" || true

# Verify schema is empty
echo "   Verifying schema is empty..."
TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';" | tr -d ' ')
if [ "$TABLE_COUNT" -ne 0 ]; then
  echo "   ⚠️  Warning: Found $TABLE_COUNT tables after schema drop. Attempting to drop them individually..."
  psql "$DATABASE_URL" -c "
    DO \$\$
    DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public')
      LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END \$\$;
  " 2>&1 | grep -v "^NOTICE:" | grep -v "^DETAIL:" || true
fi
echo "✅ Schema reset"

echo ""
echo "2️⃣  Pushing schema with drizzle-kit..."
# Uses DIRECT_URL from env (Session Mode pooler, IPv4-compatible)
npx drizzle-kit push

# Verify tables were created
echo "   Verifying tables were created..."
TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';" | tr -d ' ')
echo "   Found $TABLE_COUNT tables in public schema"
if [ "$TABLE_COUNT" -eq 0 ]; then
  echo "   ❌ Error: No tables created by drizzle-kit push!"
  exit 1
fi
echo "✅ Schema pushed"

echo ""
echo "3️⃣  Running SQL seed..."
psql "$DATABASE_URL" -f supabase/seed.sql 2>&1 | grep -v "^NOTICE:" | grep -v "^DETAIL:" || true
echo "✅ SQL seed complete"

echo ""
echo "4️⃣  Seeding users..."
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "⚠️  Skipping user seeding (SUPABASE_SERVICE_ROLE_KEY not set in $ENV_FILE)"
else
  node supabase/seed-users.mjs
  echo "✅ Users seeded"
fi

echo ""
echo "🎉 Database reset complete!"
