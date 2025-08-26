#!/bin/bash

# pgTAP Test Runner for RLS Policy Validation
# Part of dual-track testing strategy - Track 1: RLS Security Testing
# See: docs/testing/dual-track-testing-strategy.md

set -euo pipefail

# Colors for output formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RLS_TEST_DIR="${SCRIPT_DIR}/rls"
SETUP_DIR="${SCRIPT_DIR}/setup"

# Database connection settings
# Use Supabase local development database by default
: "${DATABASE_URL:=postgresql://postgres:postgres@localhost:54322/postgres}"
: "${TEST_ENV:=test}"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if psql is available
check_psql() {
    if ! command -v psql &> /dev/null; then
        log_error "psql command not found. Please install PostgreSQL client tools."
        exit 1
    fi
}

# Check if pg_prove is available (for better test output)
check_pg_prove() {
    if command -v pg_prove &> /dev/null; then
        return 0
    else
        log_warning "pg_prove not found. Using basic psql execution instead."
        log_warning "For better test output, install pg_prove: cpan TAP::Parser::SourceHandler::pgTAP"
        return 1
    fi
}

# Test database connection
test_connection() {
    log_info "Testing database connection..."
    if psql "${DATABASE_URL}" -c "SELECT 1;" &> /dev/null; then
        log_success "Database connection successful"
        return 0
    else
        log_error "Failed to connect to database: ${DATABASE_URL}"
        log_error "Make sure Supabase is running: supabase start"
        return 1
    fi
}

# Install pgTAP extension if not present
setup_pgtap() {
    log_info "Checking pgTAP extension..."
    
    # Check if pgTAP is already installed
    if psql "${DATABASE_URL}" -c "SELECT 1 FROM pg_extension WHERE extname = 'pgtap';" -t | grep -q 1; then
        log_success "pgTAP extension already installed"
        return 0
    fi
    
    log_info "Installing pgTAP extension..."
    if psql "${DATABASE_URL}" -c "CREATE EXTENSION IF NOT EXISTS pgtap;" &> /dev/null; then
        log_success "pgTAP extension installed successfully"
        return 0
    else
        log_error "Failed to install pgTAP extension"
        log_error "Make sure you have superuser privileges or pgTAP is available"
        return 1
    fi
}

# Setup test environment (roles, etc.)
setup_test_environment() {
    log_info "Setting up test environment..."
    
    # Set environment variable for role creation safety
    export PGPASSWORD="${PGPASSWORD:-postgres}"
    
    # Run setup scripts
    for setup_file in "${SETUP_DIR}"/*.sql; do
        if [[ -f "$setup_file" ]]; then
            log_info "Running setup: $(basename "$setup_file")"
            if psql "${DATABASE_URL}" -f "$setup_file"; then
                log_success "Setup completed: $(basename "$setup_file")"
            else
                log_error "Setup failed: $(basename "$setup_file")"
                return 1
            fi
        fi
    done
    
    log_success "Test environment setup completed"
}

# Run pgTAP tests using pg_prove
run_tests_with_pg_prove() {
    log_info "Running pgTAP tests with pg_prove..."
    
    cd "${RLS_TEST_DIR}"
    
    # Run tests with pg_prove for better output
    if pg_prove --ext=.sql --recurse --verbose "${DATABASE_URL}" .; then
        log_success "All pgTAP tests passed!"
        return 0
    else
        log_error "Some pgTAP tests failed"
        return 1
    fi
}

# Run pgTAP tests using basic psql execution
run_tests_with_psql() {
    log_info "Running pgTAP tests with psql..."
    
    # Change to test directory for consistent working directory with pg_prove
    cd "${RLS_TEST_DIR}"
    
    local test_count=0
    local passed_count=0
    local failed_tests=()
    
    # Find and run all test files (use ./* since we're in the directory now)
    for test_file in ./*.test.sql; do
        if [[ -f "$test_file" ]]; then
            test_count=$((test_count + 1))
            test_name=$(basename "$test_file")
            
            log_info "Running test: ${test_name}"
            
            # Create a temporary file for test output
            local temp_output
            temp_output=$(mktemp)
            
            # Run the test and capture output
            if psql "${DATABASE_URL}" -f "$test_file" > "$temp_output" 2>&1; then
                # Check if test actually passed by analyzing TAP output
                local plan_line=$(grep "1\.\." "$temp_output" | head -1)
                local planned_tests=0
                if [[ -n "$plan_line" ]]; then
                    planned_tests=$(echo "$plan_line" | sed 's/.*1\.\.//')
                fi
                
                local ok_count=0
                local not_ok_count=0
                
                # Safely count ok and not ok tests (TAP output format has leading spaces)
                if grep -q "ok [0-9]" "$temp_output" 2>/dev/null; then
                    ok_count=$(grep "ok [0-9]" "$temp_output" | wc -l | tr -d ' ')
                fi
                
                if grep -q "not ok [0-9]" "$temp_output" 2>/dev/null; then
                    not_ok_count=$(grep "not ok [0-9]" "$temp_output" | wc -l | tr -d ' ')
                fi
                
                # Test passes if: no "not ok" and ok_count matches planned_tests (or has at least 1 ok if no plan)
                if [[ $not_ok_count -eq 0 ]] && [[ $ok_count -gt 0 ]] && ([[ $planned_tests -eq 0 ]] || [[ $ok_count -eq $planned_tests ]]); then
                    passed_count=$((passed_count + 1))
                    log_success "✓ ${test_name} (${ok_count}/${planned_tests} tests passed)"
                else
                    failed_tests+=("${test_name}")
                    log_error "✗ ${test_name} (${ok_count}/${planned_tests} passed, ${not_ok_count} failed)"
                    echo "Test output:"
                    cat "$temp_output"
                fi
            else
                failed_tests+=("${test_name}")
                log_error "✗ ${test_name} (execution failed)"
                echo "Error output:"
                cat "$temp_output"
            fi
            
            rm -f "$temp_output"
        fi
    done
    
    # Print summary
    echo
    log_info "Test Summary:"
    echo "  Total tests: ${test_count}"
    echo "  Passed: ${passed_count}"
    echo "  Failed: ${#failed_tests[@]}"
    
    if [[ ${#failed_tests[@]} -eq 0 ]]; then
        log_success "All pgTAP tests passed!"
        return 0
    else
        log_error "Failed tests:"
        for test in "${failed_tests[@]}"; do
            echo "  - ${test}"
        done
        return 1
    fi
}

# Run all tests
run_tests() {
    if check_pg_prove; then
        run_tests_with_pg_prove
    else
        run_tests_with_psql
    fi
}

# Main execution
main() {
    echo "pgTAP RLS Policy Test Runner"
    echo "============================"
    echo
    
    # Verify prerequisites
    check_psql || exit 1
    test_connection || exit 1
    
    # Setup environment
    setup_pgtap || exit 1
    setup_test_environment || exit 1
    
    # Run tests
    echo
    log_info "Starting RLS policy tests..."
    echo
    
    if run_tests; then
        echo
        log_success "🎉 All RLS policy tests completed successfully!"
        log_success "Track 1 (pgTAP RLS Validation) is working correctly"
        echo
        echo "Next steps:"
        echo "  - Run integration tests: npm run test"
        echo "  - Run full test suite: npm run test:all"
        exit 0
    else
        echo
        log_error "❌ Some RLS policy tests failed"
        log_error "Please review the test output above and fix any issues"
        echo
        echo "Debugging steps:"
        echo "  1. Check RLS policies are implemented in database"
        echo "  2. Verify test data setup in test files"
        echo "  3. Ensure JWT claim simulation is working"
        echo "  4. Check database connection and permissions"
        exit 1
    fi
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [options]"
        echo
        echo "Options:"
        echo "  --help, -h    Show this help message"
        echo "  --setup-only  Only run setup, don't execute tests"
        echo "  --tests-only  Only run tests, skip setup"
        echo
        echo "Environment variables:"
        echo "  DATABASE_URL  PostgreSQL connection string (default: local Supabase)"
        echo "  TEST_ENV      Test environment name (default: test)"
        echo
        echo "Examples:"
        echo "  $0                           # Run full test suite"
        echo "  $0 --setup-only              # Only setup test environment"
        echo "  $0 --tests-only              # Only run tests"
        echo "  DATABASE_URL=... $0          # Use custom database"
        exit 0
        ;;
    --setup-only)
        check_psql || exit 1
        test_connection || exit 1
        setup_pgtap || exit 1
        setup_test_environment || exit 1
        log_success "Setup completed"
        exit 0
        ;;
    --tests-only)
        check_psql || exit 1
        test_connection || exit 1
        run_tests
        exit $?
        ;;
    "")
        main
        ;;
    *)
        log_error "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac