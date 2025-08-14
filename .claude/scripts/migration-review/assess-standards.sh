#!/bin/bash
# assess-standards.sh - Standards compliance assessment and recommendations

# Don't exit on errors, let assessment complete
# set -e

echo "📋 STANDARDS COMPLIANCE ASSESSMENT"
echo ""

# Load counts from previous scripts
source /tmp/migration-review-counts 2>/dev/null || {
  echo "⚠️ No previous analysis data found, running basic assessment"
  CRITICAL_ISSUES=0
  HIGH_ISSUES=0
  TEST_ISSUES=0
  QUALITY_STATUS="UNKNOWN"
  GATES_PASSED=0
  TOTAL_GATES=0
}

# Count additional medium-priority issues (focus on changed files if available)
if [[ -n "$1" ]]; then
  # Get changed files from command line argument
  CHANGED_FILES="$1"
  MEDIUM_COUNT=$(rg "findUnique\(|getServerSideProps" --type ts "$CHANGED_FILES" 2>/dev/null | wc -l || echo 0)
else
  # Fallback to all files
  MEDIUM_COUNT=$(rg "findUnique\(|getServerSideProps" --type ts . 2>/dev/null | wc -l || echo 0)
fi

# Calculate totals
TOTAL_ISSUES=$((CRITICAL_ISSUES + HIGH_ISSUES + TEST_ISSUES + MEDIUM_COUNT))

echo "Issues Found:"
echo "🔴 Critical: $CRITICAL_ISSUES (breaks functionality/security)"
echo "🟡 High: $HIGH_ISSUES (performance/maintenance)" 
echo "🟠 Test: $TEST_ISSUES (testing quality)"
echo "🟢 Medium: $MEDIUM_COUNT (code quality)"
echo "📊 Total: $TOTAL_ISSUES issues"

if [[ -n "$QUALITY_STATUS" && "$QUALITY_STATUS" != "UNKNOWN" ]]; then
  echo "⚙️ Quality Gates: $QUALITY_STATUS ($GATES_PASSED/$TOTAL_GATES passed)"
fi

echo ""

# Overall assessment
if [[ $CRITICAL_ISSUES -gt 0 ]]; then
  echo "🚨 ASSESSMENT: CRITICAL ISSUES - Must fix before merge"
  echo "Focus on: Supabase SSR migration, org scoping, deprecated patterns"
  ASSESSMENT="CRITICAL"
elif [[ "$QUALITY_STATUS" == "FAIL" ]]; then
  echo "🚨 ASSESSMENT: QUALITY GATES FAILED - Must fix before merge"
  echo "Focus on: TypeScript errors, linting issues, test failures"
  ASSESSMENT="QUALITY_FAIL"
elif [[ $HIGH_ISSUES -gt 5 ]]; then
  echo "⚠️ ASSESSMENT: HIGH PRIORITY FIXES NEEDED"
  echo "Focus on: Query patterns, manual joins, Prisma removal"
  ASSESSMENT="HIGH_PRIORITY"
elif [[ $TOTAL_ISSUES -gt 0 ]]; then
  echo "✅ ASSESSMENT: GOOD - Minor improvements available"
  echo "Consider addressing remaining modernization opportunities"
  ASSESSMENT="GOOD"
else
  echo "🎉 ASSESSMENT: EXCELLENT - August 2025 standards met"
  ASSESSMENT="EXCELLENT"
fi

echo ""
echo "🎯 RECOMMENDED ACTIONS:"

case "$ASSESSMENT" in
  "CRITICAL")
    echo "1. Fix critical security/functionality issues immediately"
    echo "2. Address deprecated auth packages and missing org scoping"
    echo "3. Run review again after fixes"
    echo "4. Do NOT merge until critical issues resolved"
    ;;
  "QUALITY_FAIL")
    echo "1. Fix TypeScript compilation errors"
    echo "2. Resolve ESLint issues"
    echo "3. Fix failing tests"
    echo "4. Re-run quality validation"
    ;;
  "HIGH_PRIORITY")
    echo "1. Address query anti-patterns and performance issues"
    echo "2. Verify organizational scoping in all routers"
    echo "3. Convert manual joins to relational queries"
    echo "4. Test manually after changes"
    ;;
  "GOOD")
    echo "1. Consider modernizing remaining patterns when convenient"
    echo "2. Update tests to use latest utilities"
    echo "3. Code is ready for merge if urgent"
    echo "4. Plan cleanup in future iteration"
    ;;
  "EXCELLENT")
    echo "1. Code ready for merge/deployment"
    echo "2. Consider running full test suite"
    echo "3. Review for final polish opportunities"
    echo "4. Great work following August 2025 standards!"
    ;;
esac

echo ""
echo "🔗 References:"
echo "- @docs/developer-guides/anti-patterns.md"
echo "- @docs/developer-guides/drizzle-migration-review-procedure.md"
echo "- @docs/latest-updates/quick-reference.md"

# Cleanup temp file
rm -f /tmp/migration-review-counts

echo ""
echo "📈 Standards assessment complete"

# Exit with appropriate code for automation
case "$ASSESSMENT" in
  "CRITICAL"|"QUALITY_FAIL")
    exit 1  # Failure - must fix
    ;;
  "HIGH_PRIORITY") 
    exit 2  # Warning - should fix
    ;;
  *)
    exit 0  # Success
    ;;
esac