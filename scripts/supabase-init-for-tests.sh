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
for i in $(seq 1 60); do
  if curl -s --fail "http://localhost:54321/auth/v1/health" >/dev/null 2>&1; then
    echo "✅ Supabase Auth service is ready!"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "❌ Supabase Auth service failed to start after 120 seconds."
    supabase status || true
    exit 1
  fi
  echo "🔄 Auth service not ready yet, waiting... (attempt $i/60)"
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

echo "📬 Deriving Mailpit ports from Supabase config..."
MAILPIT_PORT_FROM_CONFIG="$(python3 - <<'PY'
import sys, tomllib
from pathlib import Path

print(f"DEBUG: Python version: {sys.version}", file=sys.stderr)

config_path = Path("supabase/config.toml")
try:
    print(f"DEBUG: Reading config from {config_path.absolute()}", file=sys.stderr)
    data = tomllib.loads(config_path.read_text())
    inbucket = data.get("inbucket", {})
    http_port = inbucket.get("port")
    smtp_port = inbucket.get("smtp_port")
    print(f"DEBUG: Found ports - HTTP: {http_port}, SMTP: {smtp_port}", file=sys.stderr)
    print(f"{http_port or ''},{smtp_port or ''}")
except Exception as exc:  # pragma: no cover - defensive fallback in bash
    print(",")
    sys.stderr.write(f"Warning: failed to parse mailpit ports from config.toml: {exc}\n")
PY
)"

MAILPIT_PORT="${MAILPIT_PORT_FROM_CONFIG%,*}"
MAILPIT_SMTP_PORT="${MAILPIT_PORT_FROM_CONFIG#*,}"

# Fall back to conventional defaults if parsing failed
MAILPIT_PORT="${MAILPIT_PORT:-54324}"
MAILPIT_SMTP_PORT="${MAILPIT_SMTP_PORT:-54325}"

export MAILPIT_PORT
export MAILPIT_SMTP_PORT
# Compatibility with legacy INBUCKET_* env names used by Supabase CLI output
export INBUCKET_PORT="${MAILPIT_PORT}"
export INBUCKET_SMTP_PORT="${MAILPIT_SMTP_PORT}"

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
MAILPIT_PORT=${MAILPIT_PORT}
MAILPIT_SMTP_PORT=${MAILPIT_SMTP_PORT}
EMAIL_TRANSPORT=smtp
EOF
fi

echo "📦 Applying database schema with Drizzle (db:_push)..."
pnpm run db:_push

echo "🧪 Generating test schema..."
pnpm run test:_generate-schema

echo "🌱 Seeding database tables..."
pnpm run db:_seed

echo "🌱 Seeding test users..."
pnpm run db:_seed-users

echo "✅ Supabase initialization for tests completed."
