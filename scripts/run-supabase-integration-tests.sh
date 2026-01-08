#!/bin/bash

# ==============================================================================
# Supabase-Backed Integration Tests Runner (Vitest)
#
# Uses the shared Supabase initialization script and then runs the
# integration tests that depend on a real Supabase instance.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"${SCRIPT_DIR}/supabase-init-for-tests.sh"

echo "🧪 Running Supabase-backed integration tests with Vitest..."
pnpm run test:integration:supabase -- --reporter=verbose

echo "✅ Supabase-backed integration tests completed successfully."

