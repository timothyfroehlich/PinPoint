#!/bin/bash

# Extract TypeScript error filtering logic from GitHub Actions CI
# This script mimics the exact filtering logic used in .github/workflows/ci.yml
# Usage: ./scripts/ci-typecheck-filter.sh [typescript-output-file]

set -e

# Default to typescript-output.log if no argument provided
TYPESCRIPT_OUTPUT="${1:-typescript-output.log}"

if [ ! -f "$TYPESCRIPT_OUTPUT" ]; then
    echo "Error: TypeScript output file '$TYPESCRIPT_OUTPUT' not found"
    echo "Usage: $0 [typescript-output-file]"
    echo "Run 'npm run typecheck > typescript-output.log 2>&1' first to generate the output"
    exit 1
fi

echo "=== CI TypeScript Filter Test ==="
echo "Analyzing file: $TYPESCRIPT_OUTPUT"
echo ""

# Count total TypeScript errors (exactly as in CI)
ERROR_COUNT=$(grep -c "error TS" "$TYPESCRIPT_OUTPUT" 2>/dev/null || echo "0")

# Filter out test files more comprehensively (EXACT same regex as CI)
PRODUCTION_ERRORS=$(grep "error TS" "$TYPESCRIPT_OUTPUT" 2>/dev/null | grep -v -E "(test\.|\.test\.|__tests__|\.spec\.|spec\.|/test/|/tests/|src/test/|mockContext)" || true)

# Debug: Show what errors we're seeing (same as CI debug section)
echo "=== ALL TYPESCRIPT ERRORS ==="
grep "error TS" "$TYPESCRIPT_OUTPUT" 2>/dev/null || echo "No TS errors found"
echo ""
echo "=== FILTERED PRODUCTION ERRORS ==="
echo "$PRODUCTION_ERRORS"
echo ""
echo "=== END DEBUG ==="
echo ""

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

# Calculate test errors
TEST_ERROR_COUNT=$((ERROR_COUNT - PRODUCTION_ERROR_COUNT))
if [ "$TEST_ERROR_COUNT" -lt 0 ]; then
    TEST_ERROR_COUNT=0
fi

# Output results (same format as CI)
echo "## TypeScript Check Results"
echo "- **Production Code Errors**: $PRODUCTION_ERROR_COUNT (❌ blocking)"
echo "- **Test File Errors**: $TEST_ERROR_COUNT (⚠️ non-blocking)"
echo "- **Total Errors**: $ERROR_COUNT"
echo ""

# Show what would happen in CI
if [ "$PRODUCTION_ERROR_COUNT" -gt 0 ]; then
    echo "### Production Code Errors (Would block CI):"
    echo "$PRODUCTION_ERRORS" | head -10
    echo ""
    echo "🚨 CI would FAIL with exit code 1"
    exit 1
elif [ "$TEST_ERROR_COUNT" -gt 0 ]; then
    echo "### Test File Errors (Non-blocking):"
    grep "error TS" "$TYPESCRIPT_OUTPUT" | grep -E "(test\.|\.test\.|__tests__|\.spec\.|spec\.|/test/|/tests/|src/test/|mockContext)" | head -5 || true
    echo ""
    echo "✅ Test errors don't block CI during TypeScript migration"
    echo "📋 These will be addressed in separate cleanup tasks"
    echo ""
    echo "✅ CI would PASS with exit code 0 (only test errors found)"
    exit 0
else
    echo "✅ No TypeScript errors found!"
    echo "✅ CI would PASS with exit code 0 (no errors found)"
    exit 0
fi