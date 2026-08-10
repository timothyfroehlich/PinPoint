#!/bin/bash
# scripts/workflow/e2e-all-isolated.sh
# Run the full + smoke E2E suites in separate Playwright invocations.
#
# Each invocation re-runs e2e/global-setup.ts (which fast-resets the DB),
# so seeded state from one suite cannot contaminate the next. Replaces the
# dangerous `pnpm exec playwright test` (no --config=) which picks up every
# spec under e2e/ in a single process and shares DB state across them.
#
# There used to be a third "root" invocation for specs that lived directly at
# e2e/ root. The last of those was deleted in #1343 (2026-05-16) and the
# invocation kept pointing at it, so this script exited non-zero at the end of
# every run (Playwright fails when a path filter matches no tests). Every spec
# now lives under e2e/full/ or e2e/smoke/, so these two suites are the whole
# corpus and a third suite has no job. Keep it that way: a new spec goes in
# full/ or smoke/, never at e2e/ root or in a sibling directory. (PP-8oeq.)
#
# Both invocations pass --project=chromium, mirroring the required CI jobs
# (ci.yml: "E2E Full Tests (Chromium)" and "E2E Smoke Tests (Chromium)"). This
# is a correctness requirement, not a speed one: the configs declare four
# browser projects, Playwright runs them concurrently in one process, and
# several specs write singleton seeded rows (the member's own profile, machine
# owners, machine settings). Two projects then interleave on the same row and
# each asserts the other's value — measured, 9 such failures on firefox and
# Mobile Chrome. Cross-browser coverage is CI's job, where each browser gets
# its own job and its own database. (PP-stut.)
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

run_suite "full" pnpm exec playwright test --config=playwright.config.full.ts --project=chromium || exit $?
run_suite "smoke" pnpm exec playwright test --config=playwright.config.smoke.ts --project=chromium || exit $?

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "✅ All E2E suites passed (full + smoke, chromium)"
echo "═══════════════════════════════════════════════════════════════════"
