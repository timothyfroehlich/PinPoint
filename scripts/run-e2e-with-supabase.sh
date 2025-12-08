#!/bin/bash

# ==============================================================================
# E2E Test Runner with Supabase
#
# Description:
#   Delegates Supabase initialization to scripts/supabase-init-for-tests.sh
#   and then runs the Playwright smoke tests.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"${SCRIPT_DIR}/supabase-init-for-tests.sh"

echo "🎭 Running Playwright smoke tests..."
npx playwright test e2e/smoke --reporter=dot

echo "✅ E2E smoke tests completed successfully."
