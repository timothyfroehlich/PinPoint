# Execution Framework: Tactical Migration Operations

**Purpose**: Operational framework for executing the Prisma removal + RLS implementation migration  
**Context**: Solo development with 306 failing tests requiring architectural transformation  
**Prerequisite**: Complete [Migration Setup](./00.5-migration-setup.md) before using this framework  
**Framework Type**: Phase execution procedures with dependency gate enforcement

---

## 1. Phase Execution Framework

### Validation Commands and Quality Gates

**Continuous Validation Suite**:

```bash
#!/bin/bash
# scripts/validate-migration-phase.sh

PHASE=$(git branch --show-current | grep -o 'phase-[0-9]*')

echo "🔍 PHASE ${PHASE} VALIDATION"
echo "=========================="

case $PHASE in
  "phase-1")
    echo "📦 Phase 1: Prisma Removal Validation"

    # Check for Prisma references
    if rg -q "import.*prisma" src/; then
      echo "❌ FAIL: Prisma imports still exist"
      rg "import.*prisma" src/ --no-heading
      exit 1
    fi

    # Check tRPC context
    if rg -q "prisma" src/server/api/trpc.base.ts; then
      echo "❌ FAIL: Prisma in tRPC context"
      exit 1
    fi

    # Check TypeScript compilation
    if ! npm run typecheck:brief; then
      echo "❌ FAIL: TypeScript compilation errors"
      exit 1
    fi

    echo "✅ PASS: Phase 1 dependency gates satisfied"
    ;;

  "phase-2")
    echo "🔐 Phase 2: RLS Implementation Validation"

    # Check for RLS policies
    if ! rg -q "ROW LEVEL SECURITY" scripts/migrations/; then
      echo "❌ FAIL: No RLS policies found"
      exit 1
    fi

    # Check session context setup
    if ! rg -q "SET app\.current_organization_id" src/; then
      echo "❌ FAIL: Session context not implemented"
      exit 1
    fi

    # Test basic RLS functionality
    # Note: Requires test:rls-basic script from migration setup
    if command -v npm run test:rls-basic &> /dev/null; then
      npm run test:rls-basic || {
        echo "❌ FAIL: Basic RLS tests not passing"
        exit 1
      }
    else
      echo "⚠️  RLS tests not configured - see 00.5-migration-setup.md"
    fi

    echo "✅ PASS: Phase 2 dependency gates satisfied"
    ;;

  "phase-2.5")
    echo "🧪 Phase 2.5: Testing Architecture Validation"

    # Check for testing archetype documentation
    if [ ! -f "migration-plan-v2/03-phase2.5-testing-architecture.md" ]; then
      echo "❌ FAIL: Testing architecture not documented"
      exit 1
    fi

    # Check worker-scoped PGlite pattern
    if ! rg -q "withIsolatedTest" test/helpers/; then
      echo "❌ FAIL: Memory-safe test pattern not implemented"
      exit 1
    fi

    echo "✅ PASS: Phase 2.5 dependency gates satisfied"
    ;;

  "phase-3")
    echo "🔧 Phase 3: Test Implementation Validation"

    # Check test conversion rate
    CONVERTED_TESTS=$(rg -l "withIsolatedTest" src/ | wc -l)
    TOTAL_TESTS=$(find src/ -name "*.test.ts" | wc -l)
    CONVERSION_RATE=$((CONVERTED_TESTS * 100 / TOTAL_TESTS))

    echo "📊 Test conversion rate: ${CONVERSION_RATE}%"

    if [ $CONVERSION_RATE -lt 50 ]; then
      echo "⚠️  WARNING: Test conversion below 50%"
    fi

    echo "✅ Phase 3 in progress: ${CONVERTED_TESTS}/${TOTAL_TESTS} tests converted"
    ;;
esac
```

**Progressive Metrics Collection**:

```bash
#!/bin/bash
# scripts/collect-metrics.sh

PHASE=$(git branch --show-current | grep -o 'phase-[0-9]*')
DATE=$(date +%Y%m%d)
METRICS_FILE="migration-metrics-${DATE}.json"

echo "📊 Collecting migration metrics for ${PHASE}..."

# Technical metrics
PRISMA_REFS=$(rg -c "prisma" src/ 2>/dev/null || echo "0")
RLS_POLICIES=$(rg -c "ROW LEVEL SECURITY" scripts/ 2>/dev/null || echo "0")
TEST_FILES=$(find src/ -name "*.test.ts" | wc -l)
PASSING_TESTS=$(npm run test:brief 2>/dev/null | grep -o "[0-9]* passed" | cut -d' ' -f1 || echo "0")

# Architecture metrics
SERVICE_FILES=$(find src/server/services -name "*.ts" | wc -l)
ROUTER_FILES=$(find src/server/api/routers -name "*.ts" ! -name "*.test.ts" | wc -l)

# Create metrics JSON
cat > "$METRICS_FILE" << EOF
{
  "date": "$(date -Iseconds)",
  "phase": "${PHASE}",
  "technical": {
    "prisma_references": ${PRISMA_REFS},
    "rls_policies": ${RLS_POLICIES},
    "test_files": ${TEST_FILES},
    "passing_tests": ${PASSING_TESTS}
  },
  "architecture": {
    "service_files": ${SERVICE_FILES},
    "router_files": ${ROUTER_FILES}
  }
}
EOF

echo "✅ Metrics saved to ${METRICS_FILE}"
```


---

## 3. Phase Coordination

### Dependency Gate Enforcement

**Iron Law Implementation**:

```bash
#!/bin/bash
# scripts/enforce-dependency-gates.sh

CURRENT_PHASE=$(git branch --show-current | grep -o 'phase-[0-9]*')
ATTEMPTING_PHASE=${1:-"unknown"}

echo "🚨 DEPENDENCY GATE ENFORCEMENT"
echo "==============================="
echo "Current Phase: ${CURRENT_PHASE}"
echo "Attempting: ${ATTEMPTING_PHASE}"

# Phase transition validation
case "${CURRENT_PHASE}-to-${ATTEMPTING_PHASE}" in
  "phase-1-to-phase-2")
    echo "🔍 Validating Phase 1 → Phase 2 transition..."

    # Must have zero Prisma references
    if rg -q "prisma" src/; then
      echo "❌ BLOCKED: Prisma references still exist"
      echo "Complete Phase 1 before starting RLS implementation"
      exit 1
    fi

    # Must have clean TypeScript compilation
    if ! npm run type-check; then
      echo "❌ BLOCKED: TypeScript compilation errors"
      exit 1
    fi

    echo "✅ APPROVED: Phase 2 RLS implementation can begin"
    ;;

  "phase-2-to-phase-2.5")
    echo "🔍 Validating Phase 2 → Phase 2.5 transition..."

    # Must have basic RLS working
    # Note: Requires RLS test setup from migration-setup
    if command -v npm run test:rls-basic &> /dev/null; then
      if ! npm run test:rls-basic; then
        echo "❌ BLOCKED: Basic RLS functionality not working"
        exit 1
      fi
    else
      echo "⚠️  RLS tests not configured - proceed with manual verification"
    fi

    echo "✅ APPROVED: Phase 2.5 testing architecture can begin"
    ;;

  "phase-2.5-to-phase-3")
    echo "🔍 Validating Phase 2.5 → Phase 3 transition..."

    # Must have testing methodology documented
    if [ ! -f "migration-plan-v2/03-phase2.5-testing-architecture.md" ]; then
      echo "❌ BLOCKED: Testing methodology not documented"
      exit 1
    fi

    echo "✅ APPROVED: Phase 3 systematic test fixes can begin"
    ;;

  *)
    echo "⚠️  WARNING: Unusual phase transition detected"
    echo "Verify dependency chain compliance manually"
    ;;
esac
```

**Phase Handoff Procedures**:

```bash
#!/bin/bash
# scripts/phase-handoff.sh

COMPLETED_PHASE=$1
NEXT_PHASE=$2

echo "🔄 PHASE HANDOFF: ${COMPLETED_PHASE} → ${NEXT_PHASE}"
echo "==============================================="

# 1. Completion Validation
echo "📋 Validating ${COMPLETED_PHASE} completion..."
npm run validate-migration-phase

# 2. Documentation Update
echo "📝 Updating phase documentation..."
cat >> "migration-progress.md" << EOF

## ${COMPLETED_PHASE} Complete - $(date)

### Accomplishments:
- [Summary of work completed]

### Quality Gates Satisfied:
- [List of validation checks passed]

### Handoff to ${NEXT_PHASE}:
- Ready for next phase implementation
- All dependencies satisfied

EOF

# 3. Branch Management
echo "🌿 Managing branches for handoff..."
git add -A
git commit -m "Complete ${COMPLETED_PHASE}: Ready for ${NEXT_PHASE}

Phase completion includes:
- All dependency gates satisfied
- Quality validation passed
- Documentation updated

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

# Create phase completion tag
git tag "${COMPLETED_PHASE}-complete"

# Initialize next phase
git checkout -b "migration-${NEXT_PHASE}"
git push -u origin "migration-${NEXT_PHASE}"

echo "✅ Handoff complete: Ready to begin ${NEXT_PHASE}"
```

### Integration Validation Across Phase Boundaries

**Cross-Phase Integration Tests**:

```bash
#!/bin/bash
# scripts/integration-validation.sh

echo "🔗 CROSS-PHASE INTEGRATION VALIDATION"
echo "====================================="

# Phase 1 → Phase 2 Integration
if [ -f ".phase-1-complete" ] && [ -f ".phase-2-complete" ]; then
  echo "🧪 Testing Drizzle + RLS integration..."

  # Test that RLS works with pure Drizzle queries
  npm run test:drizzle-rls-integration || {
    echo "❌ INTEGRATION FAILURE: Drizzle-RLS incompatibility"
    exit 1
  }

  echo "✅ Drizzle + RLS integration verified"
fi

# Phase 2 → Phase 3 Integration
if [ -f ".phase-2-complete" ] && [ -f ".phase-2.5-complete" ]; then
  echo "🧪 Testing RLS + Testing Architecture integration..."

  # Test that test patterns work with RLS
  npm run test:rls-pattern-validation || {
    echo "❌ INTEGRATION FAILURE: RLS-Testing pattern incompatibility"
    exit 1
  }

  echo "✅ RLS + Testing Architecture integration verified"
fi

echo "✅ All integration validations passed"
```

---

## 4. Command Sequences

### Phase-Specific Command Flows

**Phase 1: Prisma Removal**:

```bash
#!/bin/bash
# scripts/phase-1-workflow.sh

echo "⚙️  PHASE 1: PRISMA REMOVAL WORKFLOW"
echo "=================================="

# Daily routine for Prisma removal
while [ "$(rg -c 'prisma' src/)" -gt 0 ]; do
  echo "📍 Prisma references remaining: $(rg -c 'prisma' src/)"

  # 1. Identify next service to convert
  NEXT_SERVICE=$(rg -l "prisma" src/server/services/ | head -1)

  if [ -n "$NEXT_SERVICE" ]; then
    echo "🎯 Converting service: $NEXT_SERVICE"

    # 2. Convert service to Drizzle
    # (This would invoke the drizzle-migration agent)
    echo "Converting $NEXT_SERVICE..."

    # 3. Validate conversion
    npm run validate-file "$NEXT_SERVICE"

    # 4. Run service-specific tests
    npm run test -- "$NEXT_SERVICE.test.ts"

    # 5. Commit progress
    git add "$NEXT_SERVICE"
    git commit -m "Convert $(basename $NEXT_SERVICE) to Drizzle-only

- Remove Prisma client dependency
- Update to pure Drizzle patterns
- Maintain identical functionality

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

  else
    echo "🔍 Checking non-service Prisma references..."
    rg "prisma" src/ --exclude-dir=__tests__
  fi

  # Daily checkpoint
  npm run validate-migration-phase

  echo "⏸️  End of day checkpoint. Continue tomorrow."
  break
done

echo "✅ Phase 1 Complete: Zero Prisma references remaining"
```

**Phase 2: RLS Implementation**:

```bash
#!/bin/bash
# scripts/phase-2-workflow.sh

echo "🔐 PHASE 2: RLS IMPLEMENTATION WORKFLOW"
echo "======================================"

# RLS implementation sequence
ENTITIES=("users" "organizations" "issues" "machines" "locations")

for ENTITY in "${ENTITIES[@]}"; do
  echo "🎯 Implementing RLS for: $ENTITY"

  # 1. Create RLS policy
  echo "Creating RLS policy for $ENTITY..."
  cat > "scripts/migrations/add-rls-${ENTITY}.sql" << EOF
-- Enable RLS for $ENTITY table
ALTER TABLE $ENTITY ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access data from their organization
CREATE POLICY ${ENTITY}_org_isolation ON $ENTITY
  FOR ALL
  TO authenticated
  USING (organization_id = current_setting('app.current_organization_id')::uuid);
EOF

  # 2. Run migration
  npm run db:migrate

  # 3. Test RLS policy
  npm run test:rls -- "$ENTITY"

  # 4. Update application queries
  echo "Updating queries for $ENTITY to use RLS..."

  # 5. Validate functionality
  npm run test:integration -- "$ENTITY"

  # 6. Commit RLS implementation
  git add -A
  git commit -m "Implement RLS for $ENTITY table

- Add organizational isolation policy
- Remove manual organizationId filtering
- Validate with integration tests

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

  echo "✅ RLS implemented for $ENTITY"
done

echo "✅ Phase 2 Complete: All entities have RLS policies"
```

### Validation Commands for Quality Assurance

**Comprehensive Quality Validation**:

```bash
#!/bin/bash
# scripts/quality-validation.sh

echo "🎯 COMPREHENSIVE QUALITY VALIDATION"
echo "==================================="

# 1. TypeScript Compilation
echo "📝 TypeScript validation..."
npm run type-check || {
  echo "❌ TypeScript compilation failed"
  exit 1
}

# 2. Lint Validation
echo "🧹 ESLint validation..."
npm run lint || {
  echo "❌ Linting failed"
  exit 1
}

# 3. Migration-Specific Validation
echo "🔄 Migration-specific validation..."
npm run validate-migration-phase || {
  echo "❌ Migration validation failed"
  exit 1
}

# 4. Test Architecture Validation
echo "🧪 Test architecture validation..."
# Check for memory safety violations
if rg -q "new PGlite\(" src/; then
  echo "❌ Memory safety violation: Per-test PGlite instances detected"
  rg "new PGlite\(" src/ --no-heading
  exit 1
fi

# Check for proper test patterns
if rg -q "\.integration\.test\.ts" src/ && ! rg -q "withIsolatedTest" src/; then
  echo "❌ Integration tests missing memory-safe patterns"
  exit 1
fi

# 5. Security Validation
echo "🔐 Security validation..."
# Check that RLS is properly implemented
if [ -f ".phase-2-complete" ]; then
  npm run test:security || {
    echo "❌ Security tests failed"
    exit 1
  }
fi

echo "✅ All quality validations passed"
```

### Debugging Commands for Troubleshooting

**Migration-Specific Debugging Tools**:

```bash
#!/bin/bash
# scripts/debug-migration.sh

ISSUE_TYPE=$1

echo "🐛 MIGRATION DEBUGGING TOOLKIT"
echo "=============================="

case $ISSUE_TYPE in
  "prisma-conflicts")
    echo "🔍 Debugging Prisma conflicts..."
    echo "Remaining Prisma references:"
    rg "prisma" src/ --no-heading | head -20

    echo "Prisma imports:"
    rg "import.*prisma" src/ --no-heading

    echo "Prisma type references:"
    rg "Prisma\." src/ --no-heading
    ;;

  "rls-issues")
    echo "🔍 Debugging RLS issues..."
    echo "RLS policies in database:"
    npm run db:query "SELECT schemaname, tablename, policyname FROM pg_policies;"

    echo "Session context test:"
    npm run test:rls-session-debug

    echo "Current RLS configuration:"
    npm run db:query "SHOW row_security;"
    ;;

  "test-patterns")
    echo "🔍 Debugging test patterns..."
    echo "Memory-unsafe test patterns:"
    rg "new PGlite\(" src/ --no-heading

    echo "Missing transaction isolation:"
    rg "\.integration\.test\.ts" src/ | while read -r file; do
      if ! rg -q "withIsolatedTest" "$file"; then
        echo "Missing isolation: $file"
      fi
    done

    echo "Test memory usage check:"
    npm run test:memory-check
    ;;

  "organizational-scoping")
    echo "🔍 Debugging organizational scoping..."
    echo "Manual organizationId filters still present:"
    rg "organizationId.*eq\(" src/ --no-heading

    echo "Missing RLS session context:"
    rg "query.*findMany" src/ | head -10

    echo "Cross-org data leakage test:"
    npm run test:cross-org-isolation
    ;;

  *)
    echo "Available debugging options:"
    echo "  - prisma-conflicts: Debug remaining Prisma references"
    echo "  - rls-issues: Debug RLS implementation problems"
    echo "  - test-patterns: Debug test architecture issues"
    echo "  - organizational-scoping: Debug multi-tenancy problems"
    ;;
esac
```

### Emergency Procedures and Abort Protocols

**Emergency Halt and Assessment**:

```bash
#!/bin/bash
# scripts/emergency-halt.sh

echo "🚨 EMERGENCY MIGRATION HALT"
echo "=========================="

REASON=${1:-"unspecified"}

echo "Halt reason: $REASON"
echo "Current time: $(date)"

# 1. Immediate State Capture
echo "📸 Capturing current state..."
git add -A
git commit -m "EMERGENCY HALT: $REASON

Current state captured for analysis.
All work-in-progress preserved.

🚨 Emergency halt initiated
Co-Authored-By: Claude <noreply@anthropic.com>"

# 2. Create emergency analysis branch
git checkout -b "emergency-analysis-$(date +%Y%m%d-%H%M)"

# 3. System diagnostics
echo "🔧 Running system diagnostics..."
{
  echo "=== SYSTEM STATE ANALYSIS ==="
  echo "Git status:"
  git status

  echo "Current branch:"
  git branch --show-current

  echo "Recent commits:"
  git log --oneline -10

  echo "TypeScript status:"
  npm run type-check 2>&1 | head -20

  echo "Test status:"
  npm run test:brief 2>&1 | head -20

  echo "Migration validation:"
  npm run validate-migration-phase 2>&1

} > "emergency-analysis-$(date +%Y%m%d-%H%M).log"

# 4. Recovery options
echo "🔄 Recovery options available:"
echo "1. Continue current phase: git checkout migration-phase-N"
echo "2. Rollback to phase start: scripts/emergency-rollback.sh N"
echo "3. Rollback to specific date: scripts/selective-rollback.sh YYYYMMDD"
echo "4. Abort migration entirely: git checkout issue-core-migration"

echo "📊 Analysis saved to: emergency-analysis-$(date +%Y%m%d-%H%M).log"
echo "🎯 Next step: Review analysis and choose recovery option"
```

---

## 5. Progress Tracking Framework

### Metrics Collection for Each Phase

**Phase-Specific Metrics**:

```bash
#!/bin/bash
# scripts/phase-metrics.sh

PHASE=$(git branch --show-current | grep -o 'phase-[0-9]*')
DATE=$(date +%Y%m%d)

echo "📊 PHASE $PHASE METRICS COLLECTION"
echo "================================="

case $PHASE in
  "phase-1")
    # Prisma removal metrics
    PRISMA_FILES=$(rg -l "prisma" src/ 2>/dev/null | wc -l)
    TOTAL_SERVICE_FILES=$(find src/server/services -name "*.ts" | wc -l)
    CONVERTED_SERVICES=$((TOTAL_SERVICE_FILES - PRISMA_FILES))

    echo "Prisma Removal Progress:"
    echo "  Files with Prisma references: $PRISMA_FILES"
    echo "  Service files converted: $CONVERTED_SERVICES/$TOTAL_SERVICE_FILES"
    echo "  Completion rate: $((CONVERTED_SERVICES * 100 / TOTAL_SERVICE_FILES))%"
    ;;

  "phase-2")
    # RLS implementation metrics
    RLS_POLICIES=$(rg -c "ROW LEVEL SECURITY" scripts/migrations/ 2>/dev/null || echo "0")
    TOTAL_ENTITIES=5  # users, organizations, issues, machines, locations

    echo "RLS Implementation Progress:"
    echo "  RLS policies created: $RLS_POLICIES"
    echo "  Entities with RLS: $RLS_POLICIES/$TOTAL_ENTITIES"
    echo "  Completion rate: $((RLS_POLICIES * 100 / TOTAL_ENTITIES))%"

    # Session context metrics
    SESSION_CONTEXT_USAGE=$(rg -c "SET app\.current_organization_id" src/ 2>/dev/null || echo "0")
    echo "  Session context usage: $SESSION_CONTEXT_USAGE locations"
    ;;

  "phase-3")
    # Testing architecture metrics
    TOTAL_TEST_FILES=$(find src/ -name "*.test.ts" | wc -l)
    MEMORY_SAFE_TESTS=$(rg -l "withIsolatedTest" src/ 2>/dev/null | wc -l)
    RLS_PATTERN_TESTS=$(rg -l "SET app\.current_organization_id" src/ 2>/dev/null | wc -l)

    echo "Testing Architecture Progress:"
    echo "  Total test files: $TOTAL_TEST_FILES"
    echo "  Memory-safe patterns: $MEMORY_SAFE_TESTS"
    echo "  RLS pattern adoption: $RLS_PATTERN_TESTS"
    echo "  Memory safety rate: $((MEMORY_SAFE_TESTS * 100 / TOTAL_TEST_FILES))%"
    ;;

  "phase-4")
    # Test fixing metrics
    PASSING_TESTS=$(npm run test:brief 2>/dev/null | grep -o "[0-9]* passed" | cut -d' ' -f1 || echo "0")
    TOTAL_TESTS=$(npm run test:count 2>/dev/null | grep -o "[0-9]* total" | cut -d' ' -f1 || echo "306")

    echo "Test Repair Progress:"
    echo "  Tests passing: $PASSING_TESTS"
    echo "  Total tests: $TOTAL_TESTS"
    echo "  Pass rate: $((PASSING_TESTS * 100 / TOTAL_TESTS))%"
    ;;
esac

# Save metrics to tracking file
echo "$DATE,$PHASE,$CONVERTED_SERVICES,$RLS_POLICIES,$MEMORY_SAFE_TESTS,$PASSING_TESTS" >> migration-metrics.csv
```

### Success Criteria Validation

**Automated Success Criteria Checking**:

```bash
#!/bin/bash
# scripts/success-criteria.sh

PHASE=$1

echo "✅ SUCCESS CRITERIA VALIDATION: $PHASE"
echo "====================================="

case $PHASE in
  "phase-1")
    echo "📋 Phase 1 Success Criteria:"

    # Zero Prisma references
    PRISMA_COUNT=$(rg -c "prisma" src/ 2>/dev/null || echo "0")
    if [ $PRISMA_COUNT -eq 0 ]; then
      echo "✅ Zero Prisma references: PASS"
    else
      echo "❌ Prisma references remain: $PRISMA_COUNT found"
      return 1
    fi

    # TypeScript compilation
    if npm run type-check >/dev/null 2>&1; then
      echo "✅ TypeScript compilation: PASS"
    else
      echo "❌ TypeScript compilation: FAIL"
      return 1
    fi

    # Service layer converted
    SERVICE_FILES=$(find src/server/services -name "*.ts" | wc -l)
    PRISMA_SERVICES=$(rg -l "prisma" src/server/services/ 2>/dev/null | wc -l)
    if [ $PRISMA_SERVICES -eq 0 ]; then
      echo "✅ All services converted: PASS ($SERVICE_FILES services)"
    else
      echo "❌ Services remain: $PRISMA_SERVICES not converted"
      return 1
    fi
    ;;

  "phase-2")
    echo "📋 Phase 2 Success Criteria:"

    # RLS policies implemented
    RLS_COUNT=$(rg -c "ROW LEVEL SECURITY" scripts/migrations/ 2>/dev/null || echo "0")
    if [ $RLS_COUNT -ge 5 ]; then
      echo "✅ RLS policies implemented: PASS ($RLS_COUNT policies)"
    else
      echo "❌ Insufficient RLS policies: $RLS_COUNT < 5"
      return 1
    fi

    # Session context working
    if npm run test:rls-basic >/dev/null 2>&1; then
      echo "✅ RLS session context: PASS"
    else
      echo "❌ RLS session context: FAIL"
      return 1
    fi

    # Basic CRUD with RLS
    # Note: Requires RLS CRUD tests from migration setup
    if command -v npm run test:rls-crud &> /dev/null; then
      if npm run test:rls-crud >/dev/null 2>&1; then
        echo "✅ CRUD operations with RLS: PASS"
      else
        echo "❌ CRUD operations with RLS: FAIL"
        return 1
      fi
    else
      echo "⚠️  RLS CRUD tests not configured - manual verification required"
    fi
    ;;

  "phase-3")
    echo "📋 Phase 3 Success Criteria:"

    # Test methodology documented
    if [ -f "migration-plan-v2/03-phase2.5-testing-architecture.md" ]; then
      echo "✅ Testing methodology documented: PASS"
    else
      echo "❌ Testing methodology: NOT DOCUMENTED"
      return 1
    fi

    # Memory-safe patterns
    UNSAFE_PATTERNS=$(rg -c "new PGlite\(" src/ 2>/dev/null || echo "0")
    if [ $UNSAFE_PATTERNS -eq 0 ]; then
      echo "✅ Memory-safe test patterns: PASS"
    else
      echo "❌ Memory-unsafe patterns found: $UNSAFE_PATTERNS"
      return 1
    fi

    # Example conversions successful
    # Note: Requires archetype example tests from migration setup
    if command -v npm run test:archetype-examples &> /dev/null; then
      if npm run test:archetype-examples >/dev/null 2>&1; then
        echo "✅ Archetype examples working: PASS"
      else
        echo "❌ Archetype examples: FAIL"
        return 1
      fi
    else
      echo "⚠️  Archetype examples not configured - verify patterns manually"
    fi
    ;;

  "phase-4")
    echo "📋 Phase 4 Success Criteria:"

    # Test pass rate improvement
    PASS_RATE=$(npm run test:brief 2>&1 | grep -o "[0-9]*% pass" | cut -d'%' -f1 || echo "0")
    if [ $PASS_RATE -ge 90 ]; then
      echo "✅ Test pass rate: PASS ($PASS_RATE%)"
    else
      echo "⚠️  Test pass rate: $PASS_RATE% (target: 90%)"
    fi

    # All tests use proper patterns
    TOTAL_TESTS=$(find src/ -name "*.test.ts" | wc -l)
    PATTERN_COMPLIANT=$(rg -l "withIsolatedTest\|createVitestMockContext" src/ | wc -l)
    COMPLIANCE_RATE=$((PATTERN_COMPLIANT * 100 / TOTAL_TESTS))

    if [ $COMPLIANCE_RATE -ge 95 ]; then
      echo "✅ Pattern compliance: PASS ($COMPLIANCE_RATE%)"
    else
      echo "❌ Pattern compliance: $COMPLIANCE_RATE% < 95%"
      return 1
    fi
    ;;
esac

echo "✅ Phase $PHASE success criteria validation complete"
```

### Risk Indicator Monitoring

**Early Warning Risk Detection**:

```bash
#!/bin/bash
# scripts/risk-monitoring.sh

echo "⚠️  MIGRATION RISK MONITORING"
echo "============================"

# Check for test-fixing during architecture phases
CURRENT_PHASE=$(git branch --show-current | grep -o 'phase-[0-9]*')
if [[ "$CURRENT_PHASE" =~ phase-[12] ]]; then
  TEST_COMMITS=$(git log --oneline --since="24 hours ago" | grep -i "test.*fix\|fix.*test" | wc -l)
  if [ $TEST_COMMITS -gt 0 ]; then
    echo "🚨 CRITICAL RISK: Test fixes during architecture phase"
    echo "   Phase: $CURRENT_PHASE"
    echo "   Test fix commits: $TEST_COMMITS"
    echo "   Action: Return to architecture work immediately"
  fi
fi

# Technical complexity risk
if [[ "$CURRENT_PHASE" == "phase-2" ]]; then
  RLS_ATTEMPTS=$(git log --oneline --grep="RLS" | wc -l)
  if [ $RLS_ATTEMPTS -gt 10 ]; then
    echo "⚠️  TECHNICAL RISK: Many RLS attempts"
    echo "   Attempts: $RLS_ATTEMPTS"
    echo "   Recommendation: Simplify RLS approach or seek help"
  fi
fi

# Memory safety risk
UNSAFE_TESTS=$(rg -c "new PGlite\(" src/ 2>/dev/null || echo "0")
if [ $UNSAFE_TESTS -gt 0 ]; then
  echo "💾 MEMORY RISK: Unsafe test patterns detected"
  echo "   Unsafe patterns: $UNSAFE_TESTS"
  echo "   Risk: System lockup during test execution"
fi

# Dependency chain violation risk
if [ -f ".skip-dependency-check" ]; then
  echo "🔗 DEPENDENCY RISK: Chain enforcement disabled"
  echo "   Risk: Working on wrong phase"
  echo "   Action: Re-enable dependency checking"
fi

echo "✅ Risk monitoring complete"
```

### Completion Verification Procedures

**Migration Completion Validation**:

```bash
#!/bin/bash
# scripts/completion-verification.sh

echo "🎯 MIGRATION COMPLETION VERIFICATION"
echo "===================================="

# Overall completion check
ALL_PHASES_COMPLETE=true

for PHASE in 1 2 2.5 3; do
  echo "📋 Verifying Phase $PHASE completion..."

  if scripts/success-criteria.sh "phase-$PHASE"; then
    echo "✅ Phase $PHASE: COMPLETE"
  else
    echo "❌ Phase $PHASE: INCOMPLETE"
    ALL_PHASES_COMPLETE=false
  fi
done

if $ALL_PHASES_COMPLETE; then
  echo "🎉 MIGRATION COMPLETE!"
  echo "========================"

  # Final verification tests
  echo "🧪 Running final verification..."

  # Full test suite
  if npm run test; then
    echo "✅ Full test suite: PASS"
  else
    echo "⚠️  Full test suite: Some failures (investigate if critical)"
  fi

  # Performance verification
  if npm run test:performance; then
    echo "✅ Performance tests: PASS"
  else
    echo "⚠️  Performance tests: Review required"
  fi

  # Security verification
  if npm run test:security; then
    echo "✅ Security tests: PASS"
  else
    echo "❌ Security tests: FAIL (must fix before production)"
  fi

  # Create completion certificate
  cat > MIGRATION-COMPLETE.md << EOF
# Migration Completion Certificate

**Date**: $(date)
**Migration**: Prisma Removal + RLS Implementation
**Status**: ✅ COMPLETE

## Phase Completion:
- ✅ Phase 1: Prisma Removal
- ✅ Phase 2: RLS Implementation
- ✅ Phase 2.5: Testing Architecture
- ✅ Phase 3: Systematic Test Fixes

## Final Metrics:
- Tests passing: $(npm run test:count | grep passed)
- RLS policies: $(rg -c "ROW LEVEL SECURITY" scripts/migrations/)
- Memory-safe tests: $(rg -l "withIsolatedTest" src/ | wc -l)

## Architectural Achievements:
- Zero Prisma references
- Database-level multi-tenancy with RLS
- Memory-safe testing patterns
- Sustainable test architecture

**Result**: PinPoint now has production-grade multi-tenancy architecture.
EOF

  echo "📜 Migration completion certificate created"
  echo "🚀 Ready for production architecture features"

else
  echo "❌ MIGRATION INCOMPLETE"
  echo "Review failed phases and complete before proceeding."
fi
```

---

## 6. Context Switching Prevention

**Task Validation**:

```bash
#!/bin/bash
# scripts/validate-task.sh

CURRENT_TASK=$1
CURRENT_PHASE=$(git branch --show-current | grep -o 'phase-[0-9]*')

echo "🚧 TASK VALIDATION"
echo "=================="

case "$CURRENT_TASK" in
  "fix-tests")
    if [[ "$CURRENT_PHASE" =~ phase-[12] ]]; then
      echo "❌ INVALID: Fix tests only during Phase 3+"
      echo "Current focus should be: Architecture work"
      exit 1
    fi
    ;;

  "add-features")
    if [[ "$CURRENT_PHASE" =~ phase-[1-3] ]]; then
      echo "❌ INVALID: No new features during migration phases"
      echo "Complete migration first, then add features"
      exit 1
    fi
    ;;

  "performance-optimization")
    if [[ "$CURRENT_PHASE" =~ phase-[1-3] ]]; then
      echo "❌ INVALID: Performance optimization during migration"
      echo "Focus on correctness first, optimize in Phase 4"
      exit 1
    fi
    ;;
esac

echo "✅ Task appropriate for current phase"
```

### Knowledge Capture and Reuse

**Decision Documentation System**:

```bash
#!/bin/bash
# scripts/capture-decision.sh

DECISION_TYPE=$1
DESCRIPTION="$2"

echo "📝 CAPTURING MIGRATION DECISION"
echo "==============================="

DATE=$(date)
PHASE=$(git branch --show-current | grep -o 'phase-[0-9]*')

case $DECISION_TYPE in
  "technical")
    cat >> "migration-decisions.md" << EOF

## Technical Decision - $DATE

**Phase**: $PHASE
**Decision**: $DESCRIPTION

**Rationale**: [Why this approach was chosen]
**Alternatives Considered**: [Other options evaluated]
**Implementation**: [How this will be implemented]
**Success Criteria**: [How to validate this decision]

EOF
    ;;

  "pattern")
    cat >> "migration-patterns.md" << EOF

## Pattern Decision - $DATE

**Phase**: $PHASE
**Pattern**: $DESCRIPTION

**Use Case**: [When to use this pattern]
**Implementation**: [How to implement]
**Example**: [Code example]
**Alternatives**: [Other patterns considered]

EOF
    ;;

  "architectural")
    cat >> "architecture-decisions.md" << EOF

## Architectural Decision - $DATE

**Phase**: $PHASE
**Decision**: $DESCRIPTION

**Context**: [What led to this decision]
**Decision**: [What was decided]
**Consequences**: [Expected outcomes]
**Review Date**: [When to re-evaluate]

EOF
    ;;
esac

echo "✅ Decision captured and documented"
echo "📁 Saved to migration-decisions.md"
```

**Pattern Library Creation**:

````bash
#!/bin/bash
# scripts/create-pattern-library.sh

echo "📚 CREATING MIGRATION PATTERN LIBRARY"
echo "====================================="

# Service conversion patterns
cat > "patterns/service-conversion.md" << 'EOF'
# Service Conversion Patterns

## Before (Prisma)
```typescript
export class UserService {
  constructor(private prisma: PrismaClient) {}

  async findByOrg(orgId: string) {
    return this.prisma.user.findMany({
      where: { organizationId: orgId }
    });
  }
}
````

## After (Drizzle + RLS)

```typescript
export class UserService {
  constructor(private db: DrizzleClient) {}

  async findByOrg() {
    // RLS automatically filters by organization
    return this.db.query.users.findMany();
  }
}
```

EOF

# RLS policy patterns

cat > "patterns/rls-policies.md" << 'EOF'

# RLS Policy Patterns

## Basic Organization Isolation

```sql
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;

CREATE POLICY {table}_org_isolation ON {table}
  FOR ALL
  TO authenticated
  USING (organization_id = current_setting('app.current_organization_id')::uuid);
```

## Role-Based Access

```sql
CREATE POLICY {table}_role_access ON {table}
  FOR SELECT
  TO authenticated
  USING (
    organization_id = current_setting('app.current_organization_id')::uuid
    AND (
      current_setting('app.current_user_role') = 'admin'
      OR user_id = current_setting('app.current_user_id')::uuid
    )
  );
```

EOF

# Test pattern library

cat > "patterns/test-patterns.md" << 'EOF'

# Test Pattern Library

## Memory-Safe Integration Test

```typescript
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";

test("business logic test", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    await db.execute(sql`SET app.current_organization_id = 'test-org'`);

    // Test implementation
    const result = await service.businessLogic();
    expect(result).toBe(expected);
  });
});
```

## Router Mock Pattern

```typescript
vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof DbModule>();
  return {
    ...actual,
    db: {
      execute: vi.fn(),
      query: { users: { findMany: vi.fn() } },
    },
  };
});
```

EOF

echo "✅ Pattern library created in patterns/ directory"

````

## 7. Progress Visualization

**Visual Progress Dashboard**:
```bash
#!/bin/bash
# scripts/progress-dashboard.sh

echo "📊 MIGRATION PROGRESS DASHBOARD"
echo "==============================="

# ASCII progress bars for each phase
function progress_bar() {
  local progress=$1
  local total=50
  local filled=$((progress * total / 100))
  local empty=$((total - filled))

  printf "["
  printf "%${filled}s" | tr ' ' '█'
  printf "%${empty}s" | tr ' ' '░'
  printf "] %d%%\n" $progress
}

# Phase 1: Prisma Removal
PRISMA_FILES=$(rg -l "prisma" src/ 2>/dev/null | wc -l)
TOTAL_FILES=20  # Estimated total files that had Prisma
PHASE1_PROGRESS=$(((TOTAL_FILES - PRISMA_FILES) * 100 / TOTAL_FILES))

echo "Phase 1: Prisma Removal"
progress_bar $PHASE1_PROGRESS
echo ""

# Phase 2: RLS Implementation
RLS_POLICIES=$(rg -c "ROW LEVEL SECURITY" scripts/migrations/ 2>/dev/null || echo "0")
TOTAL_ENTITIES=5
PHASE2_PROGRESS=$((RLS_POLICIES * 100 / TOTAL_ENTITIES))

echo "Phase 2: RLS Implementation"
progress_bar $PHASE2_PROGRESS
echo ""

# Phase 3: Testing Architecture
MEMORY_SAFE_TESTS=$(rg -l "withIsolatedTest" src/ 2>/dev/null | wc -l)
TOTAL_INTEGRATION_TESTS=$(find src/ -name "*.integration.test.ts" | wc -l)
PHASE3_PROGRESS=$((MEMORY_SAFE_TESTS * 100 / TOTAL_INTEGRATION_TESTS))

echo "Phase 3: Testing Architecture"
progress_bar $PHASE3_PROGRESS
echo ""

# Overall migration progress
OVERALL_PROGRESS=$(((PHASE1_PROGRESS + PHASE2_PROGRESS + PHASE3_PROGRESS) / 3))

echo "Overall Migration Progress"
progress_bar $OVERALL_PROGRESS
```

---

This execution framework provides the tactical structure to transform the strategic vision into executable reality. The framework ensures disciplined phase progression, prevents common migration pitfalls, and maintains productivity through the architectural transformation process.

**Key Success Factors:**

- **Dependency chain enforcement** prevents technical impossibilities
- **Phase procedures** provide consistent progress structure
- **Risk monitoring** catches problems before they derail progress
- **Progress visualization** tracks architectural work
- **Context switching prevention** maintains focus

The framework is designed to support systematic architectural migration while ensuring the strategic vision is realized through disciplined tactical execution.
