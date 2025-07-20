#!/bin/bash

# Debug script to compare local vs CI behavior
# This script helps identify why CI filtering might behave differently

set -e

echo "=== CI Debug Analysis ==="
echo ""

# Step 1: Generate fresh TypeScript output
echo "1. Generating fresh TypeScript output..."
npm run typecheck > typescript-output-fresh.log 2>&1 || true

# Step 2: Test our filtering script
echo "2. Testing local filtering logic..."
./scripts/ci-typecheck-filter.sh typescript-output-fresh.log

echo ""
echo "=== Environment Comparison ==="
echo "Local Node version: $(node --version)"
echo "Local npm version: $(npm --version)"
echo "Local TypeScript version: $(npx tsc --version)"
echo ""

# Step 3: Check if there are any differences in how errors are formatted
echo "3. Analyzing error format patterns..."
echo ""

echo "Sample error lines (first 5):"
head -5 typescript-output-fresh.log | grep "error TS" || echo "No error TS patterns in first 5 lines"

echo ""
echo "Error TS line count:"
grep -c "error TS" typescript-output-fresh.log 2>/dev/null || echo "0"

echo ""
echo "Test file pattern matches:"
grep "error TS" typescript-output-fresh.log 2>/dev/null | grep -E "(test\.|\.test\.|__tests__|\.spec\.|spec\.|/test/|/tests/|src/test/|mockContext)" | wc -l || echo "0"

echo ""
echo "Production error pattern matches:"
grep "error TS" typescript-output-fresh.log 2>/dev/null | grep -v -E "(test\.|\.test\.|__tests__|\.spec\.|spec\.|/test/|/tests/|src/test/|mockContext)" | wc -l || echo "0"

echo ""
echo "=== CI Simulation Test ==="

# Simulate exact CI logic step by step
TYPESCRIPT_OUTPUT="typescript-output-fresh.log"

# Count total TypeScript errors (exactly as in CI)
ERROR_COUNT=$(grep -c "error TS" "$TYPESCRIPT_OUTPUT" 2>/dev/null || echo "0")
echo "ERROR_COUNT=$ERROR_COUNT"

# Filter out test files (EXACT same regex as CI)
PRODUCTION_ERRORS=$(grep "error TS" "$TYPESCRIPT_OUTPUT" 2>/dev/null | grep -v -E "(test\.|\.test\.|__tests__|\.spec\.|spec\.|/test/|/tests/|src/test/|mockContext)" || true)
echo "PRODUCTION_ERRORS length: ${#PRODUCTION_ERRORS}"

# Count production errors with proper validation (exact CI logic)
if [ -z "$PRODUCTION_ERRORS" ] || [ "$PRODUCTION_ERRORS" = "" ]; then
    PRODUCTION_ERROR_COUNT=0
else
    PRODUCTION_ERROR_COUNT=$(echo "$PRODUCTION_ERRORS" | wc -l)
    # Ensure it's a valid number
    if ! [[ "$PRODUCTION_ERROR_COUNT" =~ ^[0-9]+$ ]]; then
        PRODUCTION_ERROR_COUNT=0
    fi
fi
echo "PRODUCTION_ERROR_COUNT=$PRODUCTION_ERROR_COUNT"

# Calculate test errors
TEST_ERROR_COUNT=$((ERROR_COUNT - PRODUCTION_ERROR_COUNT))
if [ "$TEST_ERROR_COUNT" -lt 0 ]; then
    TEST_ERROR_COUNT=0
fi
echo "TEST_ERROR_COUNT=$TEST_ERROR_COUNT"

echo ""
echo "=== Final CI Simulation Result ==="
if [ "$PRODUCTION_ERROR_COUNT" -gt 0 ]; then
    echo "❌ Would FAIL CI (production errors found)"
    exit 1
elif [ "$TEST_ERROR_COUNT" -gt 0 ]; then
    echo "✅ Would PASS CI (only test errors found)"
    exit 0
else
    echo "✅ Would PASS CI (no errors found)"
    exit 0
fi