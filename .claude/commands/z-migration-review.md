---
description: "Code review tool for drizzle-migration and test-architect agent work"
argument-hint: "[impl|tests|full|pr-number|file-path]"
allowed-tools: "Bash(gh pr view:*), Bash(gh pr diff:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(npm run typecheck:brief), Bash(npm run lint:brief), Bash(npm run test:brief), Bash(rg:*), Bash(wc:*), Bash(cat:*), Bash(echo:*), Bash(head:*), Bash(grep:*)"
---

# Migration Code Review

**Purpose:** Review work from drizzle-migration and test-architect agents using August 2025 best practices.

**Context:** Solo development, direct conversion approach, velocity-focused.

## Usage Modes

- `impl` → Review implementation work (routers, components, schema)
- `tests` → Review testing work (test files, mocks, PGlite)
- `full` → Comprehensive review (default)
- `123` → Review PR #123
- `path/file.ts` → Review specific file

## Detect Files to Review

```bash
# Determine what to review
if [[ "$ARGUMENTS" =~ ^[0-9]+$ ]]; then
  echo "🔍 PR Review Mode: #$ARGUMENTS"
  !gh pr view $ARGUMENTS
  !gh pr diff $ARGUMENTS --name-only
  FILES=$(gh pr diff $ARGUMENTS --name-only)
elif [[ "$ARGUMENTS" == *.* ]]; then
  echo "📄 Single File Review: $ARGUMENTS"
  FILES="$ARGUMENTS"
  !git log --oneline -3 -- "$ARGUMENTS"
else
  MODE="${ARGUMENTS:-full}"
  echo "🎯 ${MODE^} Review Mode - Current Changes"
  !git status --porcelain
  FILES=$(git diff --name-only HEAD)
  if [[ -z "$FILES" ]]; then
    FILES=$(git diff --name-only --staged)
  fi
  if [[ -z "$FILES" ]]; then
    echo "ℹ️ No changes detected"
    exit 0
  fi
fi

echo "📋 Files to review:"
echo "$FILES"
```

## File Categorization

```bash
# Categorize each file
for file in $FILES; do
  case "$file" in
    src/server/api/routers/*.ts)
      echo "🗄️ ROUTER: $file"
      ROUTERS+="$file "
      ;;
    src/server/db/schema/*.ts)
      echo "📊 SCHEMA: $file"
      SCHEMAS+="$file "
      ;;
    src/app/**/*.tsx)
      echo "⚡ SERVER_COMPONENT: $file"
      COMPONENTS+="$file "
      ;;
    src/app/actions/*.ts)
      echo "🎬 SERVER_ACTION: $file"
      ACTIONS+="$file "
      ;;
    **/*.test.ts|**/*.test.tsx)
      echo "🧪 TEST: $file"
      TESTS+="$file "
      ;;
    **/*.integration.test.ts)
      echo "🔗 INTEGRATION_TEST: $file"
      INTEGRATION_TESTS+="$file "
      ;;
    *)
      echo "📄 OTHER: $file"
      OTHERS+="$file "
      ;;
  esac
done
```

## Anti-Pattern Detection

Read comprehensive detection guide:

```bash
echo "🚨 Loading anti-pattern detection reference..."
!cat docs/developer-guides/anti-patterns.md | head -20
```

### Critical Anti-Patterns (All Modes)

```bash
echo "🔴 CRITICAL Security Issues:"

# Deprecated Supabase auth (BREAKS functionality)
!rg "@supabase/auth-helpers" --type ts . && echo "❌ CRITICAL: Deprecated auth package causes loops"

# Missing organization scoping (SECURITY BREACH)
if [[ -n "$ROUTERS" ]]; then
  for router in $ROUTERS; do
    !rg -L "organizationId" "$router" && echo "🚨 CRITICAL: $router missing org scoping"
  done
fi

# Individual cookie methods (BREAKS SSR)
!rg "cookies\.(get|set|remove)\(" --type ts . && echo "❌ CRITICAL: Use getAll()/setAll() only"
```

### Implementation Mode (`impl` or `full`)

```bash
if [[ "$MODE" == "impl" || "$MODE" == "full" ]]; then
  echo ""
  echo "🔧 IMPLEMENTATION REVIEW"

  # Schema anti-patterns
  if [[ -n "$SCHEMAS" ]]; then
    echo "📊 Schema Issues:"
    !rg "serial\(" --type ts $SCHEMAS && echo "❌ Use .generatedAlwaysAsIdentity() instead"
    !rg "\.on\(.*\)\.asc\(\)|\\.desc\(\)" --type ts $SCHEMAS && echo "❌ Use .on(col.asc()) syntax"
  fi

  # Query anti-patterns
  if [[ -n "$ROUTERS" ]]; then
    echo "🗄️ Router Issues:"
    !rg "\.from\(.*\)\..*Join\(" --type ts $ROUTERS && echo "❌ Use db.query.table.findMany({ with: {...} })"
    !rg "ctx\.(db|prisma)\." --type ts $ROUTERS && echo "❌ Use ctx.drizzle exclusively"
    !rg "findUnique\(" --type ts $ROUTERS && echo "❌ Use findFirst() in Drizzle"
  fi

  # Next.js anti-patterns
  if [[ -n "$COMPONENTS$ACTIONS" ]]; then
    echo "⚡ Next.js Issues:"
    !rg "getServerSideProps|getStaticProps" --type ts $COMPONENTS $ACTIONS && echo "❌ Use Server Components"
    !rg "useEffect.*auth|useState.*user" --type tsx $COMPONENTS && echo "❌ Use server-side auth"
  fi
fi
```

### Testing Mode (`tests` or `full`)

```bash
if [[ "$MODE" == "tests" || "$MODE" == "full" ]]; then
  echo ""
  echo "🧪 TESTING REVIEW"

  # Test infrastructure anti-patterns
  if [[ -n "$TESTS$INTEGRATION_TESTS" ]]; then
    echo "Test Issues:"
    !rg "vi\.mock.*\)" --type ts $TESTS $INTEGRATION_TESTS | grep -v "importActual" && echo "❌ Use vi.importActual for type safety"
    !rg "docker.*postgres" --type yml . && echo "❌ Use PGlite in-memory testing"
    !rg "workspace:" vitest.config.ts && echo "❌ Use projects config not workspace"
  fi

  # Mock quality check
  if [[ -n "$TESTS" ]]; then
    echo "Mock Quality:"
    for test_file in $TESTS; do
      lines=$(wc -l < "$test_file")
      if [[ $lines -gt 300 ]]; then
        echo "⚠️ $test_file ($lines lines) - consider splitting by test type"
      fi
    done
  fi
fi
```

## Quality Gates

```bash
echo ""
echo "⚙️ QUALITY VALIDATION"

# TypeScript compilation
!npm run typecheck:brief && echo "✅ TypeScript" || echo "❌ TypeScript FAILED - fix before proceeding"

# Linting
!npm run lint:brief && echo "✅ ESLint" || echo "❌ ESLint FAILED"

# Test execution (if test files changed)
if [[ -n "$TESTS$INTEGRATION_TESTS" ]]; then
  !npm run test:brief && echo "✅ Tests" || echo "❌ Tests FAILED"
fi
```

## Review Standards Assessment

```bash
echo ""
echo "📋 STANDARDS COMPLIANCE"

# Count issues by severity
CRITICAL_COUNT=$(rg "@supabase/auth-helpers|serial\(|\.on\(.*\)\.asc\(\)" --type ts . | wc -l)
HIGH_COUNT=$(rg "\.from\(.*\)\..*Join\(|ctx\.(db|prisma)" --type ts . | wc -l)
MEDIUM_COUNT=$(rg "findUnique\(|getServerSideProps" --type ts . | wc -l)

echo "Issues Found:"
echo "🔴 Critical: $CRITICAL_COUNT (breaks functionality/security)"
echo "🟡 High: $HIGH_COUNT (performance/maintenance)"
echo "🟢 Medium: $MEDIUM_COUNT (code quality)"

# Overall assessment
TOTAL=$((CRITICAL_COUNT + HIGH_COUNT + MEDIUM_COUNT))
if [[ $CRITICAL_COUNT -gt 0 ]]; then
  echo ""
  echo "🚨 ASSESSMENT: CRITICAL ISSUES - Must fix before merge"
  echo "Focus on: Supabase SSR migration, org scoping, deprecated patterns"
elif [[ $HIGH_COUNT -gt 5 ]]; then
  echo ""
  echo "⚠️ ASSESSMENT: HIGH PRIORITY FIXES NEEDED"
  echo "Focus on: Query patterns, manual joins, Prisma removal"
elif [[ $TOTAL -gt 0 ]]; then
  echo ""
  echo "✅ ASSESSMENT: GOOD - Minor improvements available"
else
  echo ""
  echo "🎉 ASSESSMENT: EXCELLENT - August 2025 standards met"
fi
```

## Next Steps

```bash
echo ""
echo "🎯 RECOMMENDED ACTIONS:"

if [[ $CRITICAL_COUNT -gt 0 ]]; then
  echo "1. Fix critical security/functionality issues immediately"
  echo "2. Run review again after fixes"
elif [[ $HIGH_COUNT -gt 0 ]]; then
  echo "1. Address query anti-patterns and performance issues"
  echo "2. Verify organizational scoping in all routers"
  echo "3. Test manually after changes"
elif [[ $MEDIUM_COUNT -gt 0 ]]; then
  echo "1. Consider modernizing remaining patterns"
  echo "2. Update tests to use latest utilities"
else
  echo "1. Code ready for merge/deployment"
  echo "2. Consider running full test suite"
fi

echo ""
echo "🔗 References:"
echo "- @docs/developer-guides/anti-patterns.md"
echo "- @docs/developer-guides/drizzle-migration-review-procedure.md"
echo "- @docs/latest-updates/quick-reference.md"
```
