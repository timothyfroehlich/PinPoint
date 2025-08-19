# Test Categorization Plan: 306 Tests → 3 Archetypes

**Purpose**: Systematic framework for categorizing and converting all existing tests to follow the 3 testing archetypes  
**Status**: Preparation phase - ready for systematic execution  
**Target**: 306 failing tests → 0 failures with archetype compliance

---

## 📊 Test Inventory Overview

### Current Test Distribution
- **306 total tests** requiring categorization and conversion
- **Mixed patterns**: Some follow good practices, others need complete restructuring
- **Memory safety issues**: Many use dangerous per-test PGlite patterns
- **Incomplete RLS adoption**: Tests still use manual organizational coordination

### Target Archetype Distribution
- **Unit Testing Archetype**: ~40% (Pure functions, React components, utilities)
- **Integration Testing Archetype**: ~50% (Database operations, tRPC routers, services)
- **Security Testing Archetype**: ~10% (RLS policies, permission boundaries, multi-tenant)

---

## 🎯 Categorization Methodology

### Step 1: Automated Classification

**Classification Script** (to be implemented):
```bash
# Analyze test files and suggest archetype classification
npm run classify-tests

# Output: test-classification-report.json with suggestions
```

**Classification Rules**:
```typescript
const classificationRules = {
  unitTesting: {
    patterns: [
      /^src\/lib\/.*\.test\.ts$/,           // Utility functions
      /^src\/components\/.*\.test\.tsx$/,   // React components  
      /^src\/hooks\/.*\.test\.ts$/,         // Custom hooks
      /^src\/utils\/.*\.test\.ts$/,         // Pure functions
    ],
    indicators: [
      'no database imports',
      'vi.mock database modules',
      'render() calls',
      'pure function exports',
    ],
  },
  integrationTesting: {
    patterns: [
      /^src\/server\/api\/routers\/.*\.test\.ts$/,  // tRPC routers
      /^src\/services\/.*\.test\.ts$/,              // Service layer
      /.*integration\.test\.ts$/,                   // Integration tests
    ],
    indicators: [
      'database queries',
      'createTRPCCaller',
      'real database operations',
      'multi-table operations',
    ],
  },
  securityTesting: {
    patterns: [
      /.*permission.*\.test\.ts$/,          // Permission tests
      /.*security.*\.test\.ts$/,            // Security tests
      /.*rls.*\.test\.ts$/,                 // RLS tests
    ],
    indicators: [
      'RLS policy testing',
      'cross-org isolation',
      'permission matrix',
      'auth boundaries',
    ],
  },
};
```

### Step 2: Manual Review and Validation

**Review Process**:
1. **Automated suggestions**: Review classification script output
2. **Edge case analysis**: Manually categorize complex/mixed tests
3. **Memory safety audit**: Identify dangerous patterns requiring immediate attention
4. **Priority assignment**: Determine conversion order based on risk and complexity

---

## 📋 Test File Inventory and Classification

### Integration Testing Archetype (High Priority)

**Critical Files** (Memory safety issues, system lockup risk):
```
src/integration-tests/admin.integration.test.ts              [15 failures] → CRITICAL
src/integration-tests/issue.timeline.integration.test.ts     [8 failures]  → HIGH
src/integration-tests/location.aggregation.integration.test.ts [12 failures] → HIGH
src/integration-tests/machine.location.integration.test.ts   [6 failures]  → MEDIUM
src/integration-tests/schema-data-integrity.integration.test.ts [4 failures] → MEDIUM
```

**Router Files** (Convert to integration archetype):
```
src/server/api/routers/__tests__/issue.comment.test.ts       [11 failures] → HIGH
src/server/api/routers/__tests__/issue.test.ts              [25 failures] → CRITICAL
src/server/api/routers/__tests__/machine.core.test.ts       [8 failures]  → MEDIUM
src/server/api/routers/__tests__/model.core.test.ts         [6 failures]  → MEDIUM
src/server/api/routers/__tests__/collection.test.ts         [5 failures]  → LOW
```

**Service Files** (Convert from "fake integration" to proper integration):
```
src/server/services/__tests__/commentService.test.ts        [30 failures] → HIGH
src/server/services/__tests__/notificationService.test.ts   [15 failures] → MEDIUM
src/server/services/__tests__/issueActivityService.test.ts  [8 failures]  → MEDIUM
```

### Security Testing Archetype (Medium Priority)

**Permission and Security Files**:
```
src/server/api/__tests__/trpc.permission.test.ts            [8 failures]  → HIGH
src/server/auth/__tests__/permissions.test.ts               [12 failures] → HIGH
src/security/__tests__/rls-policies.test.ts                 [NEW]          → HIGH
src/security/__tests__/multi-tenant-boundaries.test.ts     [NEW]          → MEDIUM
```

### Unit Testing Archetype (Lower Priority)

**Pure Function and Component Files**:
```
src/lib/utils/__tests__/formatting.test.ts                  [2 failures]  → LOW
src/lib/validators/__tests__/issue-validators.test.ts       [3 failures]  → LOW
src/components/issues/__tests__/IssueCard.test.tsx          [5 failures]  → MEDIUM
src/hooks/__tests__/useDebounce.test.ts                     [1 failure]   → LOW
```

---

## 🔧 Conversion Procedures by Archetype

### Integration Testing Archetype Conversion

**Memory Safety Conversion** (CRITICAL - prevents system lockups):

**Before** (Dangerous):
```typescript
// ❌ MEMORY BLOWOUT: 50-100MB per test
describe("Issue Router", () => {
  let db: TestDatabase;

  beforeEach(async () => {
    const setup = await createSeededTestDatabase(); // DANGEROUS
    db = setup.db;
  });
});
```

**After** (Memory-safe):
```typescript
// ✅ MEMORY SAFE: Worker-scoped with transaction isolation
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";

test("issue creation with RLS", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    await db.execute(sql`SET app.current_organization_id = 'test-org'`);
    // Memory-safe testing with automatic cleanup
  });
});
```

**RLS Context Conversion**:

**Before** (Manual coordination):
```typescript
// ❌ COMPLEX: Manual organizationId management
const org = await createTestOrganization("test-org");
const user = await createTestUser(org.id, "admin");
const ctx = await createTestContext(db, org.id, user);
```

**After** (RLS automatic):
```typescript
// ✅ SIMPLE: RLS session context
await db.execute(sql`SET app.current_organization_id = 'test-org'`);
await db.execute(sql`SET app.current_user_role = 'admin'`);
// RLS handles organizational scoping automatically
```

### Security Testing Archetype Conversion

**RLS Policy Testing** (NEW pattern):
```typescript
// NEW: Direct RLS policy validation
test("RLS policy blocks cross-org access", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Create data in org-1
    await db.execute(sql`SET app.current_organization_id = 'org-1'`);
    await db.insert(schema.issues).values({ title: "Org 1 Issue" });

    // Switch to org-2 context
    await db.execute(sql`SET app.current_organization_id = 'org-2'`);
    
    // Verify isolation
    const org2Issues = await db.query.issues.findMany();
    expect(org2Issues).toHaveLength(0); // RLS blocks access
  });
});
```

### Unit Testing Archetype Conversion

**Component Testing** (Simplification):
```typescript
// ✅ FOCUSED: UI behavior only
test('renders issue card correctly', () => {
  render(
    <VitestTestWrapper userPermissions={['issue:view']}>
      <IssueCard issue={mockIssue} />
    </VitestTestWrapper>
  );

  expect(screen.getByText('Test Issue')).toBeInTheDocument();
  // No database operations, fast execution
});
```

---

## 📊 Progress Tracking Framework

### Conversion Tracking Spreadsheet

| File | Current Status | Target Archetype | Agent | Priority | Memory Risk | Conversion Status |
|------|----------------|------------------|-------|----------|-------------|-------------------|
| `admin.integration.test.ts` | 15 failures | Integration | `integration-test-architect` | CRITICAL | HIGH | Not Started |
| `issue.comment.test.ts` | 11 failures | Integration | `integration-test-architect` | HIGH | MEDIUM | Not Started |
| `trpc.permission.test.ts` | 8 failures | Security | `security-test-architect` | HIGH | LOW | Not Started |

### Conversion Phases

**Phase A: Critical Memory Safety (Week 1)**
- Target: Files with HIGH memory risk
- Focus: Prevent system lockups
- Files: 5 critical integration test files
- Success: No more memory-related system crashes

**Phase B: High-Impact Integration (Week 2-3)**
- Target: Router and service files with many failures
- Focus: Convert to proper integration testing patterns
- Files: 12 router test files, 3 service test files  
- Success: 80% of integration test failures resolved

**Phase C: Security Boundary Testing (Week 4)**
- Target: Permission and RLS policy files
- Focus: Comprehensive security validation
- Files: Permission tests + new RLS policy tests
- Success: Complete security boundary coverage

**Phase D: Unit Test Cleanup (Week 5)**
- Target: Component and utility test files
- Focus: Fast execution and proper isolation
- Files: Component, hook, and utility tests
- Success: All unit tests execute in <100ms

---

## 🔍 Quality Validation Framework

### Archetype Compliance Checklist

**Integration Testing Archetype**:
- [ ] Uses worker-scoped PGlite pattern (no per-test instances)
- [ ] Establishes RLS context with `SET app.current_organization_id`
- [ ] Uses `withIsolatedTest` for transaction isolation  
- [ ] Tests real database constraints and relationships
- [ ] Memory usage remains stable during execution

**Security Testing Archetype**:
- [ ] Tests RLS policies directly at database level
- [ ] Validates cross-organizational isolation
- [ ] Includes permission matrix validation
- [ ] Tests security boundaries under edge conditions
- [ ] Covers compliance requirements (GDPR, etc.)

**Unit Testing Archetype**:
- [ ] No database dependencies or imports
- [ ] Executes in <100ms per test
- [ ] Uses type-safe mocking patterns
- [ ] Focuses on behavior, not implementation
- [ ] Tests single responsibility per test

### Automated Validation

**Pre-commit Hooks**:
```bash
# Validate archetype compliance
npm run validate-test-archetypes

# Check memory safety patterns
npm run check-memory-safety

# Verify performance targets
npm run test-performance-check
```

**CI/CD Validation**:
```yaml
# Memory safety validation
- name: Check Memory Usage
  run: |
    npm run test -- --reporter=verbose | grep -i "memory\|timeout"
    if [[ $? -eq 0 ]]; then
      echo "Memory issues detected"
      exit 1
    fi

# Archetype compliance
- name: Validate Archetypes
  run: npm run validate-test-archetypes
```

---

## 🚀 Implementation Commands

### Analysis Phase
```bash
# Generate test classification report
npm run analyze-tests

# Identify memory safety issues
npm run audit-memory-patterns

# Create conversion plan
npm run generate-conversion-plan
```

### Conversion Phase
```bash
# Convert specific file to archetype
npm run convert-test src/path/to/test.ts --archetype=integration

# Validate conversion
npm run validate-archetype src/path/to/test.ts

# Test memory safety
npm run test-memory-safety src/path/to/test.ts
```

### Progress Tracking
```bash
# Check conversion progress
npm run conversion-status

# Generate progress report
npm run conversion-report

# Validate all conversions
npm run validate-all-archetypes
```

---

## 📈 Success Metrics

### Technical Metrics
- **306 failing tests → 0 failing tests**
- **Memory usage: 1-2GB+ → <500MB** during test execution
- **Test execution time improved** due to RLS simplification
- **100% archetype compliance** - no ad-hoc patterns

### Quality Metrics
- **Memory safety**: Zero system lockups during test execution
- **RLS integration**: All database tests use proper session context
- **Security coverage**: Complete organizational boundary validation
- **Performance**: Unit tests <100ms, integration tests <5s per file

### Process Metrics
- **Systematic approach**: No ad-hoc test fixes
- **Agent specialization**: Each test handled by appropriate expert agent
- **Documentation**: Complete archetype patterns for future development
- **Maintainability**: Clear, consistent patterns across all tests

---

## 🎯 Next Steps

1. **Execute classification analysis** to generate initial test categorization
2. **Start with critical memory safety conversions** to prevent system issues
3. **Work through integration archetype** systematically by priority
4. **Add comprehensive security testing** with new RLS policy tests  
5. **Complete unit test optimizations** for fast feedback loops

This systematic approach ensures that all 306 tests are converted to excellent archetype patterns while maximizing the benefits of RLS and preventing dangerous memory usage patterns.