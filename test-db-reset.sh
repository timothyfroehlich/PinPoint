#!/bin/bash

# Focus on DB Reset Reliability Testing

set -e

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

run_reset_test() {
    local test_name="$1"
    local cycle="$2"
    
    ((TOTAL_TESTS++))
    log_info "$test_name - Cycle $cycle"
    
    echo "  Running: npm run db:reset:local:sb"
    
    if npm run db:reset:local:sb &>/tmp/reset-output-"$cycle".log; then
        log_success "$test_name - Cycle $cycle"
        
        # Check if auth sync worked by looking for the success message
        if grep -q "All required users found in database after 1 attempts" /tmp/reset-output-"$cycle".log; then
            log_success "  Auth sync worked immediately (cycle $cycle)"
        elif grep -q "All required users found in database after [2-9] attempts" /tmp/reset-output-"$cycle".log; then
            echo -e "${YELLOW}  ⚠️  Auth sync took multiple attempts (cycle $cycle)${NC}"
        else
            echo -e "${YELLOW}  ⚠️  Auth sync status unclear (cycle $cycle)${NC}"
        fi
        
        # Quick verification: check if we can connect to DB
        if npm run db:seed:local:sb &>/dev/null; then
            log_success "  Database is functional after reset (cycle $cycle)"
        else
            log_error "  Database not functional after reset (cycle $cycle)"
        fi
        
    else
        log_error "$test_name - Cycle $cycle"
        echo "  Error output saved to /tmp/reset-output-$cycle.log"
        echo "  Last few lines of error:"
        tail -5 /tmp/reset-output-"$cycle".log | sed 's/^/    /'
        return 1
    fi
}

echo "🔄 Database Reset Reliability Test"
echo "=================================="

# Test 1: Basic reset reliability (10 cycles)
log_info "Testing DB Reset Reliability (10 cycles)"
for i in {1..10}; do
    run_reset_test "DB Reset Test" "$i"
    sleep 1  # Brief pause between cycles
done

echo ""
echo "=================================="
echo "🏁 DB Reset Test Results"
echo "   Total Tests: $TOTAL_TESTS"
echo -e "   Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "   Failed: ${RED}$FAILED_TESTS${NC}"

if [ "$FAILED_TESTS" -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL RESET TESTS PASSED - Database reset is solid\!${NC}"
    
    # Final smoke test
    log_info "Running final smoke test to verify end-to-end functionality"
    if npm run smoke &>/dev/null; then
        log_success "Final smoke test PASSED"
        echo -e "${GREEN}🚀 Complete system is working perfectly\!${NC}"
    else
        echo -e "${YELLOW}⚠️  Reset works but smoke test failed - may be application issue${NC}"
    fi
    exit 0
else
    echo -e "${RED}💥 $FAILED_TESTS reset tests failed - Check logs in /tmp/reset-output-*.log${NC}"
    exit 1
fi
