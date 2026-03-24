#!/bin/bash
set -euo pipefail

# Health check for the local development environment.
# Polls every 0.5s until all services are up, with progressive output.
# Times out after 60s.

# shellcheck source=/dev/null
source .env.local 2>/dev/null || true

PORT="${PORT:-3000}"
SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-http://localhost:54321}"
POSTGRES_URL="${POSTGRES_URL_NON_POOLING:-${POSTGRES_URL:-}}"

TIMEOUT=60
POLL_INTERVAL=0.5
SUMMARY_INTERVAL=5

nextjs_up=false
supabase_up=false
postgres_up=false

# Skip Postgres check if URL is not set or pg_isready is not installed
if [ -z "$POSTGRES_URL" ]; then
  postgres_up=true
  echo "⚠️  Postgres       skipped (POSTGRES_URL not set)"
elif ! command -v pg_isready &>/dev/null; then
  postgres_up=true
  echo "⚠️  Postgres       skipped (pg_isready not installed)"
fi

start_time=$SECONDS
last_summary=0

while true; do
  elapsed=$(( SECONDS - start_time ))

  # Check Next.js
  if [ "$nextjs_up" = false ]; then
    if curl -fsS --max-time 1 "http://localhost:${PORT}" >/dev/null 2>&1; then
      nextjs_up=true
      echo "✅ Next.js        http://localhost:${PORT} [${elapsed}s]"
    fi
  fi

  # Check Supabase API
  if [ "$supabase_up" = false ]; then
    if curl -fsS --max-time 1 "${SUPABASE_URL}/auth/v1/health" >/dev/null 2>&1; then
      supabase_up=true
      echo "✅ Supabase API   ${SUPABASE_URL} [${elapsed}s]"
    fi
  fi

  # Check Postgres
  if [ "$postgres_up" = false ]; then
    if pg_isready -d "$POSTGRES_URL" -t 1 >/dev/null 2>&1; then
      postgres_up=true
      echo "✅ Postgres       [${elapsed}s]"
    fi
  fi

  # All up?
  if [ "$nextjs_up" = true ] && [ "$supabase_up" = true ] && [ "$postgres_up" = true ]; then
    echo ""
    echo "All services running."
    exit 0
  fi

  # Summary every 5s
  if [ $(( elapsed - last_summary )) -ge $SUMMARY_INTERVAL ]; then
    nj="❌"; [ "$nextjs_up" = true ] && nj="✅"
    sb="❌"; [ "$supabase_up" = true ] && sb="✅"
    pg="❌"; [ "$postgres_up" = true ] && pg="✅"
    echo "⏳ Waiting... Next.js $nj | Supabase $sb | Postgres $pg [${elapsed}s]"
    last_summary=$elapsed
  fi

  # Timeout
  if [ "$elapsed" -ge $TIMEOUT ]; then
    echo ""
    echo "❌ Timeout after ${TIMEOUT}s. Still waiting on:"
    [ "$nextjs_up" = false ] && echo "  - Next.js (start with: pnpm run dev)"
    [ "$supabase_up" = false ] && echo "  - Supabase API (start with: supabase start)"
    [ "$postgres_up" = false ] && echo "  - Postgres (check POSTGRES_URL)"
    exit 1
  fi

  sleep "$POLL_INTERVAL"
done
