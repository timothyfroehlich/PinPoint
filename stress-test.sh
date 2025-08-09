#\!/bin/bash

# PinPoint Database + Testing Stress Test
# Tests various combinations of db operations and test suites to catch race conditions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((PASSED_TESTS++))
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
    ((FAILED_TESTS++))
}

log_info() {
    echo -e "${YELLOW}🧪 $1${NC}"
}

run_test() {
    local test_name="$1"
    local command="$2"
    
    ((TOTAL_TESTS++))
    log_info "Running: $test_name"
    
    if eval "$command" &>/dev/null; then
        log_success "$test_name"
    else
        log_error "$test_name"
        return 1
    fi
}

echo "🚀 Starting PinPoint Stress Test Suite"
echo "Testing database operations + test combinations for race conditions"
echo "=================================================="

# Test 1: Basic DB Reset + Seed Cycles (5 iterations)
log_info "Test 1: DB Reset + Seed Reliability (5 cycles)"
for i in {1..5}; do
    log_info "  Cycle $i/5: Reset → Seed"
    run_test "Reset + Seed Cycle $i" "npm run db:reset:local:sb"
done

# Test 2: Reset + Seed + Smoke Test Combinations (3 iterations)
log_info "Test 2: Full Pipeline Tests (3 cycles)"
for i in {1..3}; do
    log_info "  Cycle $i/3: Reset → Seed → Smoke Test"
    run_test "Full Pipeline Cycle $i - Reset" "npm run db:reset:local:sb"
    run_test "Full Pipeline Cycle $i - Smoke Test" "npm run smoke"
done

# Test 3: Seed-Only Stress Test (no reset, 5 iterations)
log_info "Test 3: Seed-Only Reliability (5 cycles)"
run_test "Initial Reset" "npm run db:reset:local:sb"
for i in {1..5}; do
    log_info "  Cycle $i/5: Seed Only (testing idempotency)"
    run_test "Seed-Only Cycle $i" "npm run db:seed:local:sb"
done

# Test 4: Mixed Test Scenarios
log_info "Test 4: Mixed Test Scenarios"
run_test "Fresh Reset" "npm run db:reset:local:sb"
run_test "TypeScript Check" "npm run typecheck"
run_test "Linting Check" "npm run lint"
run_test "Smoke Test After Lint" "npm run smoke"

# Test 5: Rapid Fire Reset + Seed (3 quick cycles)
log_info "Test 5: Rapid Fire Reset + Seed (3 cycles)"
for i in {1..3}; do
    log_info "  Rapid Cycle $i/3"
    run_test "Rapid Reset $i" "npm run db:reset:local:sb"
done

# Final Smoke Test
log_info "Final Validation"
run_test "Final Smoke Test" "npm run smoke"

echo ""
echo "=================================================="
echo "🏁 Stress Test Results"
echo "   Total Tests: $TOTAL_TESTS"
echo -e "   Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "   Failed: ${RED}$FAILED_TESTS${NC}"

if [ "$FAILED_TESTS" -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED - Database operations are solid\!${NC}"
    exit 0
else
    echo -e "${RED}💥 $FAILED_TESTS tests failed - Check for race conditions or timing issues${NC}"
    exit 1
fi
