#!/bin/bash
# quality-gates.sh - Consolidated quality validation for migration review

# Don't exit on errors, let script complete
# set -e

TESTS="$1"
INTEGRATION_TESTS="$2"

echo "⚙️ QUALITY VALIDATION"
echo ""

# Function to run command and capture result
run_check() {
  local name="$1"
  local command="$2"
  
  echo -n "Running $name... "
  if eval "$command" >/dev/null 2>&1; then
    echo "✅ $name PASSED"
    return 0
  else
    echo "❌ $name FAILED"
    return 1
  fi
}

# Track overall success
GATES_PASSED=0
TOTAL_GATES=0

# TypeScript compilation
((TOTAL_GATES++))
if run_check "TypeScript" "npm run typecheck:brief"; then
  ((GATES_PASSED++))
else
  echo "   Fix TypeScript errors before proceeding"
fi

# Linting
((TOTAL_GATES++))
if run_check "ESLint" "npm run lint:brief"; then
  ((GATES_PASSED++))
else
  echo "   Run 'npm run lint' to see detailed errors"
fi

# Test execution (if test files changed)
if [[ -n "$TESTS$INTEGRATION_TESTS" ]]; then
  ((TOTAL_GATES++))
  if run_check "Tests" "npm run test:brief"; then
    ((GATES_PASSED++))
  else
    echo "   Run 'npm run test' to see detailed test failures"
  fi
fi

echo ""

# Summary
if [[ $GATES_PASSED -eq $TOTAL_GATES ]]; then
  echo "🎉 ALL QUALITY GATES PASSED ($GATES_PASSED/$TOTAL_GATES)"
  QUALITY_STATUS="PASS"
else
  echo "🚨 QUALITY GATES FAILED ($GATES_PASSED/$TOTAL_GATES passed)"
  echo "   Must fix failing gates before merge"
  QUALITY_STATUS="FAIL"
fi

# Export status for assess-standards.sh
{
  echo "QUALITY_STATUS=$QUALITY_STATUS"
  echo "GATES_PASSED=$GATES_PASSED"
  echo "TOTAL_GATES=$TOTAL_GATES"
} >> /tmp/migration-review-counts

echo ""
echo "✅ Quality validation complete"