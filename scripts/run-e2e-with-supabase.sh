#!/bin/bash

# ==============================================================================
# E2E Test Runner with Supabase
#
# Description:
#   This script automates the setup of a local Supabase environment for
#   end-to-end testing with Playwright. It starts Supabase, waits for it
#   to be healthy, applies schema changes, seeds the database, and then
#   runs the E2E smoke tests.
#
# CI/CD Synchronization:
#   IMPORTANT: This script is designed to be the single source of truth for
#   running E2E tests in a Supabase environment. The GitHub Actions workflow
#   in `.github/workflows/ci.yml` under the `test-e2e` job directly calls
#   this script.
#
#   If you modify this script, you MUST verify that the `test-e2e` job in
#   the CI workflow still functions correctly. The workflow depends on this
#   script's exit codes and environment variable management.
#
# ==============================================================================

set -e

# Stop any existing instances to ensure a clean slate
echo "🛑 Stopping any existing Supabase instances..."
supabase stop --no-backup

echo "🚀 Starting local Supabase stack..."
supabase start -x "studio,realtime,storage-api,edge-runtime,logflare,vector,imgproxy,supavisor,postgres-meta,mailpit"

echo "⏳ Waiting for Supabase Auth service to be ready..."
for i in $(seq 1 30);
do
  # Use curl to check the health of the auth service.
  # The --fail flag ensures curl returns a non-zero exit code on HTTP errors.
  if curl -s --fail "http://localhost:54321/auth/v1/health" > /dev/null 2>&1; then
    echo "✅ Supabase Auth service is ready!"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "❌ Supabase Auth service failed to start after 60 seconds."
    supabase status
    exit 1
  fi
  echo "🔄 Auth service not ready yet, waiting... (attempt $i/30)"
  sleep 2
done

echo "🔧 Exporting and mapping Supabase environment variables..."
# The `eval` command executes the output of `supabase status -o env`
# which exports the variables into the current shell session.
# The sed part is to correctly quote the values.
eval $(supabase status -o env | sed 's/=/="/;s/$/"/')