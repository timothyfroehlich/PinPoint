#!/bin/bash

# ==============================================================================
# Shared Supabase Initialization for CI Tests
#
# Starts local Supabase, waits for it to be healthy, maps Supabase CLI env
# variables into the app's expected env names, applies the database schema,
# and seeds both tables and test users.
#
# Used by:
#   - scripts/run-e2e-with-supabase.sh
#   - scripts/run-supabase-integration-tests.sh
# ==============================================================================

set -euo pipefail

echo "🛑 Stopping any existing Supabase instances..."
supabase stop --no-backup || true

echo "🚀 Starting local Supabase stack..."
supabase start -x "studio,realtime,storage-api,edge-runtime,logflare,vector,imgproxy,supavisor,postgres-meta"

echo "⏳ Waiting for Supabase Auth service to be ready..."
for i in $(seq 1 30); do
  if curl -s --fail "http://localhost:54321/auth/v1/health" >/dev/null 2>&1; then
    echo "✅ Supabase Auth service is ready!"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "❌ Supabase Auth service failed to start after 60 seconds."
    supabase status || true
    exit 1
  fi
  echo "🔄 Auth service not ready yet, waiting... (attempt $i/30)"
  sleep 2
done

echo "🔧 Exporting Supabase CLI environment variables..."
# This sets ANON_KEY, API_URL, DB_URL, PUBLISHABLE_KEY, SECRET_KEY, etc.
eval "$(supabase status -o env | sed 's/=/="/;s/$/"/')"

echo "🔧 Mapping Supabase env vars into application env names..."
export NEXT_PUBLIC_SUPABASE_URL="${API_URL}"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="${PUBLISHABLE_KEY}"
export SUPABASE_SERVICE_ROLE_KEY="${SECRET_KEY}"
export DATABASE_URL="${DB_URL}"
export DIRECT_URL="${DB_URL}"
export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-http://localhost:3000}"
export PORT="${PORT:-3000}"

if [ ! -f .env.local ]; then
  echo "📝 Creating temporary .env.local for test scripts..."
  cat > .env.local <<EOF
NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
DATABASE_URL=${DATABASE_URL}
DIRECT_URL=${DIRECT_URL}
NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
PORT=${PORT}
EOF
fi

echo "📦 Applying database schema with Drizzle (db:push)..."
npm run db:push

echo "🌱 Seeding database tables..."
npm run db:seed

echo "🌱 Seeding test users..."
npm run db:seed-users

echo "✅ Supabase initialization for tests completed."
