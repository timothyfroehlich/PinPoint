#!/bin/bash
set -euo pipefail

# Worktree-aware local service health check.
# Default output is compact for agents. --verbose retains per-service and periodic
# progress for a person actively troubleshooting.

WAIT_MODE=false
VERBOSE=false
TIMEOUT=90
POLL_INTERVAL=0.5
SUMMARY_INTERVAL=5

usage() {
  cat >&2 <<'EOF'
Usage: bash scripts/dev-status.sh [--wait] [--verbose] [--timeout=SECONDS]
EOF
  exit 2
}

for arg in "$@"; do
  case "$arg" in
    --wait) WAIT_MODE=true ;;
    --verbose) VERBOSE=true ;;
    --timeout=*)
      TIMEOUT="${arg#--timeout=}"
      [[ "$TIMEOUT" =~ ^[0-9]+$ ]] || usage
      ;;
    *) usage ;;
  esac
done

# shellcheck source=/dev/null
source .env.local 2>/dev/null || true

PORT="${PORT:-3000}"
SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-http://localhost:54321}"
POSTGRES_URL="${POSTGRES_URL_NON_POOLING:-${POSTGRES_URL:-}}"

nextjs_up=false
supabase_up=false
postgres_up=false
postgres_skip_reason=""

if [ -z "$POSTGRES_URL" ]; then
  postgres_up=true
  postgres_skip_reason="POSTGRES_URL not set"
elif ! command -v pg_isready &>/dev/null; then
  postgres_up=true
  postgres_skip_reason="pg_isready not installed"
fi

emit_postgres_skip() {
  if [ -z "$postgres_skip_reason" ]; then
    return 0
  fi
  if [ "$VERBOSE" = true ]; then
    printf '⚠️  Postgres       skipped (%s)\n' "$postgres_skip_reason"
  else
    printf 'SKIP: Postgres — %s\n' "$postgres_skip_reason"
  fi
}

probe_nextjs() {
  curl -sS --max-time 1 -o /dev/null "http://localhost:${PORT}" 2>/dev/null
}

probe_supabase() {
  curl -fsS --max-time 1 "${SUPABASE_URL}/auth/v1/health" >/dev/null 2>&1
}

probe_postgres() {
  pg_isready -d "$POSTGRES_URL" -t 1 >/dev/null 2>&1
}

compact_status() {
  local prefix="$1"
  local label="${2:-dev status}"
  local parts=()

  if [ "$nextjs_up" = true ]; then
    parts+=("Next.js=up")
  else
    parts+=("Next.js=down (start: pnpm run dev)")
  fi
  if [ "$supabase_up" = true ]; then
    parts+=("Supabase API=up")
  else
    parts+=("Supabase API=down (start: supabase start)")
  fi
  if [ -n "$postgres_skip_reason" ]; then
    parts+=("Postgres=skipped ($postgres_skip_reason)")
  elif [ "$postgres_up" = true ]; then
    parts+=("Postgres=up")
  else
    parts+=("Postgres=down (check POSTGRES_URL)")
  fi

  local joined="${parts[0]}"
  local part
  for part in "${parts[@]:1}"; do
    joined+="; $part"
  done
  printf '%s: %s — %s\n' "$prefix" "$label" "$joined"
}

if [ "$WAIT_MODE" = false ]; then
  probe_nextjs && nextjs_up=true
  probe_supabase && supabase_up=true
  if [ "$postgres_up" = false ] && probe_postgres; then
    postgres_up=true
  fi

  if [ "$VERBOSE" = true ]; then
    if [ "$nextjs_up" = true ]; then
      printf '✅ Next.js        http://localhost:%s\n' "$PORT"
    else
      printf '❌ Next.js        http://localhost:%s (start with: pnpm run dev)\n' "$PORT"
    fi
    if [ "$supabase_up" = true ]; then
      printf '✅ Supabase API   %s\n' "$SUPABASE_URL"
    else
      printf '❌ Supabase API   %s\n' "$SUPABASE_URL"
    fi
    if [ -n "$postgres_skip_reason" ]; then
      emit_postgres_skip
    elif [ "$postgres_up" = true ]; then
      printf '✅ Postgres\n'
    else
      printf '❌ Postgres       (check POSTGRES_URL)\n'
    fi
  elif [ "$nextjs_up" = true ] && [ "$supabase_up" = true ] && [ "$postgres_up" = true ]; then
    compact_status "PASS"
  else
    compact_status "FAIL"
  fi

  if [ "$nextjs_up" = true ] && [ "$supabase_up" = true ] && [ "$postgres_up" = true ]; then
    exit 0
  fi
  exit 1
fi

emit_postgres_skip
start_time=$SECONDS
last_summary=0

while true; do
  elapsed=$((SECONDS - start_time))

  if [ "$nextjs_up" = false ] && probe_nextjs; then
    nextjs_up=true
    printf 'READY: Next.js — http://localhost:%s [%ss]\n' "$PORT" "$elapsed"
  fi

  if [ "$supabase_up" = false ] && probe_supabase; then
    supabase_up=true
    printf 'READY: Supabase API — %s [%ss]\n' "$SUPABASE_URL" "$elapsed"
  fi

  if [ "$postgres_up" = false ] && probe_postgres; then
    postgres_up=true
    printf 'READY: Postgres [%ss]\n' "$elapsed"
  fi

  if [ "$nextjs_up" = true ] && [ "$supabase_up" = true ] && [ "$postgres_up" = true ]; then
    printf 'PASS: all configured dev services ready [%ss]\n' "$elapsed"
    exit 0
  fi

  if [ "$VERBOSE" = true ] && [ $((elapsed - last_summary)) -ge $SUMMARY_INTERVAL ]; then
    nj="down"
    sb="down"
    pg="down"
    [ "$nextjs_up" = true ] && nj="ready"
    [ "$supabase_up" = true ] && sb="ready"
    [ "$postgres_up" = true ] && pg="ready"
    printf 'WAIT: Next.js=%s; Supabase=%s; Postgres=%s [%ss]\n' "$nj" "$sb" "$pg" "$elapsed"
    last_summary=$elapsed
  fi

  if [ "$elapsed" -ge "$TIMEOUT" ]; then
    compact_status "FAIL" "dev status timeout after ${TIMEOUT}s"
    exit 1
  fi

  sleep "$POLL_INTERVAL"
done
