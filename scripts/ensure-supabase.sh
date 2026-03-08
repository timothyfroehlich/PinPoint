#!/bin/bash
set -euo pipefail

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "Error: supabase CLI is not installed."
    exit 1
fi

# Check if supabase is running by checking the status
# We redirect both stdout and stderr because 'supabase status' can be noisy 
# or report errors when stopped.
if ! supabase status &> /dev/null; then
    echo "Supabase is not running. Starting..."
    if ! supabase start; then
        echo "Error: Failed to start Supabase."
        exit 1
    fi

    # Wait for Supabase Auth service to become healthy to avoid race conditions
    echo "Waiting for Supabase Auth service to become ready..."
    MAX_RETRIES=30
    SLEEP_SECONDS=2
    RETRY_COUNT=0

    # Derive Supabase API port from .env.local (worktree-aware), fall back to default
    if [ -f ".env.local" ]; then
        SUPABASE_API_PORT=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | sed 's/.*://;s/[^0-9].*//' || true)
    fi
    SUPABASE_API_PORT="${SUPABASE_API_PORT:-54321}"
    SUPABASE_AUTH_HEALTH_URL="http://localhost:${SUPABASE_API_PORT}/auth/v1/health"

    while true; do
        if curl -fsS --max-time 2 "${SUPABASE_AUTH_HEALTH_URL}" > /dev/null 2>&1; then
            echo "Supabase Auth service is ready."
            break
        fi

        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ "${RETRY_COUNT}" -ge "${MAX_RETRIES}" ]; then
            echo "Error: Supabase Auth service did not become ready after $((MAX_RETRIES * SLEEP_SECONDS)) seconds."
            exit 1
        fi

        sleep "${SLEEP_SECONDS}"
    done
else
    echo "Supabase is already running."
fi
