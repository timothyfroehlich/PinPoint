#!/bin/bash
# detect-anti-patterns.sh - Consolidated anti-pattern detection for migration review

# Don't exit on errors, let analysis complete
# set -e

ROUTERS="$1"
SCHEMAS="$2" 
COMPONENTS="$3"
ACTIONS="$4"
TESTS="$5"
INTEGRATION_TESTS="$6"
MODE="$7"

echo "🚨 ANTI-PATTERN DETECTION"
echo ""

# Critical Security Issues (Always Run)
echo "🔴 CRITICAL Security Issues:"

CRITICAL_ISSUES=0

# Deprecated Supabase auth (BREAKS functionality)
if rg "@supabase/auth-helpers" --type ts "$ROUTERS" "$SCHEMAS" "$COMPONENTS" "$ACTIONS" >/dev/null 2>&1; then
  echo "❌ CRITICAL: Deprecated auth package causes loops"
  rg "@supabase/auth-helpers" --type ts "$ROUTERS" "$SCHEMAS" "$COMPONENTS" "$ACTIONS" | head -3
  ((CRITICAL_ISSUES++))
fi

# Missing organization scoping (SECURITY BREACH) 
if [[ -n "$ROUTERS" ]]; then
  for router in $ROUTERS; do
    if [[ -f "$router" ]] && ! rg -q "organizationId" "$router"; then
      echo "🚨 CRITICAL: $router missing org scoping"
      ((CRITICAL_ISSUES++))
    fi
  done
fi

# Individual cookie methods (BREAKS SSR)
if rg "cookies\.(get|set|remove)\(" --type ts "$ROUTERS" "$SCHEMAS" "$COMPONENTS" "$ACTIONS" >/dev/null 2>&1; then
  echo "❌ CRITICAL: Use getAll()/setAll() only"
  rg "cookies\.(get|set|remove)\(" --type ts "$ROUTERS" "$SCHEMAS" "$COMPONENTS" "$ACTIONS" | head -3
  ((CRITICAL_ISSUES++))
fi

if [[ $CRITICAL_ISSUES -eq 0 ]]; then
  echo "✅ No critical security issues found"
fi

echo ""

# Implementation Mode Anti-Patterns
if [[ "$MODE" == "impl" || "$MODE" == "full" ]]; then
  echo "🔧 IMPLEMENTATION REVIEW"
  
  HIGH_ISSUES=0
  
  # Schema anti-patterns
  if [[ -n "$SCHEMAS" ]]; then
    echo "📊 Schema Issues:"
    
    if rg "serial\(" --type ts "$SCHEMAS" >/dev/null 2>&1; then
      echo "❌ Use .generatedAlwaysAsIdentity() instead of serial()"
      rg "serial\(" --type ts "$SCHEMAS" | head -2
      ((HIGH_ISSUES++))
    fi
    
    if rg "\.on\(.*\)\.asc\(\)|\.desc\(\)" --type ts "$SCHEMAS" >/dev/null 2>&1; then
      echo "❌ Use .on(col.asc()) syntax"
      rg "\.on\(.*\)\.asc\(\)|\.desc\(\)" --type ts "$SCHEMAS" | head -2
      ((HIGH_ISSUES++))
    fi
  fi

  # Query anti-patterns
  if [[ -n "$ROUTERS" ]]; then
    echo "🗄️ Router Issues:"
    
    if rg "\.from\(.*\)\..*Join\(" --type ts "$ROUTERS" >/dev/null 2>&1; then
      echo "❌ Use db.query.table.findMany({ with: {...} })"
      rg "\.from\(.*\)\..*Join\(" --type ts "$ROUTERS" | head -2
      ((HIGH_ISSUES++))
    fi
    
    if rg "ctx\.(db|prisma)\." --type ts "$ROUTERS" >/dev/null 2>&1; then
      echo "❌ Use ctx.drizzle exclusively"
      rg "ctx\.(db|prisma)\." --type ts "$ROUTERS" | head -3
      ((HIGH_ISSUES++))
    fi
    
    if rg "findUnique\(" --type ts "$ROUTERS" >/dev/null 2>&1; then
      echo "❌ Use findFirst() in Drizzle"
      rg "findUnique\(" --type ts "$ROUTERS" | head -2
      ((HIGH_ISSUES++))
    fi
  fi

  # Next.js anti-patterns
  if [[ -n "$COMPONENTS$ACTIONS" ]]; then
    echo "⚡ Next.js Issues:"
    
    if rg "getServerSideProps|getStaticProps" --type ts "$COMPONENTS" "$ACTIONS" >/dev/null 2>&1; then
      echo "❌ Use Server Components"
      rg "getServerSideProps|getStaticProps" --type ts "$COMPONENTS" "$ACTIONS" | head -2
      ((HIGH_ISSUES++))
    fi
    
    if rg "useEffect.*auth|useState.*user" --type tsx "$COMPONENTS" >/dev/null 2>&1; then
      echo "❌ Use server-side auth"
      rg "useEffect.*auth|useState.*user" --type tsx "$COMPONENTS" | head -2
      ((HIGH_ISSUES++))
    fi
  fi
  
  if [[ $HIGH_ISSUES -eq 0 ]]; then
    echo "✅ No implementation issues found"
  fi
  
  echo ""
fi

# Testing Mode Anti-Patterns
if [[ "$MODE" == "tests" || "$MODE" == "full" ]]; then
  echo "🧪 TESTING REVIEW"
  
  TEST_ISSUES=0
  
  # Test infrastructure anti-patterns
  if [[ -n "$TESTS$INTEGRATION_TESTS" ]]; then
    echo "Test Issues:"
    
    if rg "vi\.mock.*\)" --type ts "$TESTS" "$INTEGRATION_TESTS" | grep -v "importActual" >/dev/null 2>&1; then
      echo "❌ Use vi.importActual for type safety"
      rg "vi\.mock.*\)" --type ts "$TESTS" "$INTEGRATION_TESTS" | grep -v "importActual" | head -2
      ((TEST_ISSUES++))
    fi
    
    if rg "docker.*postgres" --type yml . >/dev/null 2>&1; then
      echo "❌ Use PGlite in-memory testing"
      ((TEST_ISSUES++))
    fi
    
    if rg "workspace:" vitest.config.ts >/dev/null 2>&1; then
      echo "❌ Use projects config not workspace"
      ((TEST_ISSUES++))
    fi
  fi

  # Mock quality check
  if [[ -n "$TESTS" ]]; then
    echo "Mock Quality:"
    for test_file in $TESTS; do
      if [[ -f "$test_file" ]]; then
        lines=$(wc -l < "$test_file" 2>/dev/null || echo 0)
        if [[ $lines -gt 300 ]]; then
          echo "⚠️ $test_file ($lines lines) - consider splitting by test type"
          ((TEST_ISSUES++))
        fi
      fi
    done
  fi
  
  if [[ $TEST_ISSUES -eq 0 ]]; then
    echo "✅ No testing issues found"
  fi
  
  echo ""
fi

# Export counts for assess-standards.sh
echo "CRITICAL_ISSUES=$CRITICAL_ISSUES" > /tmp/migration-review-counts
echo "HIGH_ISSUES=${HIGH_ISSUES:-0}" >> /tmp/migration-review-counts
echo "TEST_ISSUES=${TEST_ISSUES:-0}" >> /tmp/migration-review-counts

echo "🔍 Anti-pattern detection complete"