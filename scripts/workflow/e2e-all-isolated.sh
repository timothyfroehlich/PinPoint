#!/bin/bash
# scripts/workflow/e2e-all-isolated.sh
# Run full + smoke + root E2E suites in separate Playwright invocations.
#
# Each invocation re-runs e2e/global-setup.ts (which fast-resets the DB),
# so seeded state from one suite cannot contaminate the next. Replaces the
# dangerous `pnpm exec playwright test` (no --config=) which picks up every
# spec under e2e/ in a single process and shares DB state across them.
#
# Usage:
#   bash scripts/workflow/e2e-all-isolated.sh
#   pnpm run e2e:all
#
# On failure, exits with the failing suite's non-zero code and prints
# which suite failed. Stops at the first failure.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT_DIR" || exit 1

run_suite() {
    local label="$1"
    shift
    echo ""
    echo "═══════════════════════════════════════════════════════════════════"
    echo "▶ [$label] $*"
    echo "═══════════════════════════════════════════════════════════════════"
    "$@"
    local rc=$?
    if [ $rc -ne 0 ]; then
        echo ""
        echo "❌ [$label] suite failed (exit $rc)"
        return $rc
    fi
}

run_suite "full" pnpm exec playwright test --config=playwright.config.full.ts || exit $?
run_suite "smoke" pnpm exec playwright test --config=playwright.config.smoke.ts || exit $?
run_suite "root" pnpm exec playwright test --config=playwright.config.ts e2e/machines-filtering.spec.ts || exit $?

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "✅ All E2E suites passed (full + smoke + root)"
echo "═══════════════════════════════════════════════════════════════════"
