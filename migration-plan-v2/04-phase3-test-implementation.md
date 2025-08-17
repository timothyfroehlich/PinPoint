# Phase 3: Systematic Test Implementation - RLS-Enhanced Testing

**Status**: Active - Converting 306 failing tests to RLS-enhanced patterns  
**Phase**: 3 of 5 - Test Implementation Using Designed Archetypes  
**Context**: RLS implemented (Phase 2) + Testing archetypes designed (Phase 2.5)  
**Approach**: Systematic archetype application, no ad-hoc fixes

## Executive Summary

**Goal**: Convert 306 failing tests to excellent RLS-based patterns that realize the full architectural benefits of database-level multi-tenancy in testing.

**Key Benefits Being Realized**:

- **Simplified test setup**: `SET app.current_organization_id = 'test-org'` replaces complex coordination
- **Automatic organizational scoping**: Database enforces boundaries, tests verify behavior
- **Elimination of "fake integration"**: Transform direct service calls to proper tRPC integration
- **Memory-safe PGlite patterns**: Worker-scoped databases with transaction isolation

**Success Metrics**:

- 306 failing tests → 0 failing tests
- All tests follow defined archetypes (no ad-hoc patterns)
- Test execution time improved (RLS eliminates coordination overhead)
- Memory usage stable (proper PGlite worker scoping)

---

## Phase 3 Execution Strategy

### Systematic Archetype Application

**CRITICAL PRINCIPLE**: Every test repair must follow a defined archetype from Phase 2.5. No ad-hoc fixes allowed.

**Archetype Assignment Matrix**:

| Test Category        | File Count | Primary Archetype                                     | Secondary Archetype            |
| -------------------- | ---------- | ----------------------------------------------------- | ------------------------------ |
| Integration Tests    | 10         | Archetype 3: PGlite Integration RLS-Enhanced          | -                              |
| Router Tests         | 12         | Archetype 5: tRPC Router RLS-Optimized                | Archetype 1: Component Testing |
| Service Tests        | 2          | Convert to Archetype 3 (eliminate "fake integration") | -                              |
| Infrastructure Tests | 5          | Various (based on purpose)                            | -                              |

**Quality Gates**:

1. **Pre-conversion**: Validate archetype applicability
2. **During conversion**: Follow archetype patterns exactly
3. **Post-conversion**: Verify archetype compliance
4. **Integration**: Ensure RLS benefits are realized

---

## Priority-Based Implementation Batches

### **Integration Test Batch (Priority 1) - CRITICAL PRIORITY**

**Target**: 10 integration test files - these are the foundation

**Files**:

- `admin.integration.test.ts`
- `issue.timeline.integration.test.ts`
- `location.aggregation.integration.test.ts`
- `location.integration.test.ts`
- `machine.location.integration.test.ts`
- `machine.owner.integration.test.ts`
- `model.core.integration.test.ts`
- `model.opdb.integration.test.ts`
- `role.integration.test.ts`
- `schema-data-integrity.integration.test.ts`

**Conversion Strategy**: Apply Archetype 3 (PGlite Integration RLS-Enhanced) consistently

### **Router Test Batch (Priority 2) - SECONDARY PRIORITY**

**Target**: 12 router test files

**Files**:

- `issue.comment.test.ts`
- `issue.confirmation.test.ts`
- `issue.notification.test.ts`
- `issue.status.test.ts`
- `issue.test.ts`
- `issue.timeline.test.ts`
- `machine.location.test.ts`
- `machine.owner.test.ts`
- `model.core.test.ts`
- `model.opdb.test.ts`
- `routers.integration.test.ts`
- `commentService.integration.test.ts`

**Conversion Strategy**: Apply Archetype 5 (tRPC Router RLS-Optimized) with mock updates

### **Infrastructure Test Batch (Priority 3) - LOW PRIORITY**

**Target**: 5 infrastructure test files

**Files**:

- `env-test-helpers.test.ts`
- `trpc.permission.test.ts`
- `permissions.test.ts`
- `drizzle-singleton.test.ts`
- `collectionService.test.ts`

**Conversion Strategy**: Apply appropriate archetype based on test purpose

---

## Integration Test Fixes (Archetype 3 Application)

### Root Cause Analysis

**Primary Issues**:

1. **createTestContext() coordination failures**: Users created without proper org memberships
2. **Manual organization scoping**: Tests manually adding `organizationId` filters
3. **Memory unsafe patterns**: Per-test PGlite instances causing system lockups

### Archetype 3 Conversion Pattern

**Before (Problematic Pattern)**:

```typescript
// ❌ Memory unsafe + coordination complexity
beforeEach(async () => {
  const { db } = await createSeededTestDatabase(); // 50-100MB per test

  // Complex coordination
  const org = await db
    .insert(organizations)
    .values({
      id: "test-org",
      name: "Test Organization",
    })
    .returning();

  const user = await db
    .insert(users)
    .values({
      id: "test-user",
      email: "test@example.com",
    })
    .returning();

  // Manual membership coordination
  await db.insert(organizationMemberships).values({
    userId: user.id,
    organizationId: org.id,
    role: "admin",
  });
});

test("should scope data by organization", async () => {
  // Manual scoping in test
  const issues = await db.query.issues.findMany({
    where: eq(issues.organizationId, "test-org"), // Manual scoping
  });
  expect(issues).toHaveLength(0);
});
```

**After (Archetype 3 RLS-Enhanced)**:

```typescript
// ✅ Memory safe + RLS automatic scoping
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";

test("should scope data by organization", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Set RLS context once
    await db.execute(sql`SET app.current_organization_id = 'test-org'`);
    await db.execute(sql`SET app.current_user_id = 'test-user'`);

    // Create test data - RLS handles scoping automatically
    const [issue] = await db
      .insert(issues)
      .values({
        title: "Test Issue",
        description: "Test Description",
        // No manual organizationId needed - RLS handles it
      })
      .returning();

    // Query without manual scoping - RLS enforces boundaries
    const foundIssues = await db.query.issues.findMany();
    expect(foundIssues).toHaveLength(1);
    expect(foundIssues[0].organizationId).toBe("test-org"); // RLS inserted this

    // Automatic cleanup via withIsolatedTest transaction rollback
  });
});
```

### File-Specific Conversion Procedures

#### `admin.integration.test.ts`

**Current Issues**: Complex admin operations with manual org scoping  
**Conversion Steps**:

1. Replace per-test database with worker-scoped pattern
2. Add RLS context setup for admin operations
3. Remove manual `organizationId` filtering in queries
4. Verify bulk operations respect RLS boundaries

#### `location.aggregation.integration.test.ts`

**Current Issues**: Location data aggregation without proper scoping  
**Conversion Steps**:

1. Apply worker-scoped database pattern
2. Set RLS context for location data access
3. Verify aggregation queries respect organizational boundaries
4. Test cross-organization data isolation

#### `schema-data-integrity.integration.test.ts`

**Current Issues**: Schema constraints tested without RLS context  
**Conversion Steps**:

1. Add RLS context to constraint validation tests
2. Verify foreign key constraints respect organizational scoping
3. Test RLS policy enforcement in constraint scenarios

---

## Router Test Mock Updates (Archetype 5 Application)

### Root Cause Analysis

**Primary Issues**:

1. **Mock setup incompatibility**: tRPC context mocks use Prisma patterns vs required Drizzle patterns
2. **Missing RLS context**: Router tests don't establish proper organizational context
3. **Inconsistent auth patterns**: Mix of old auth-helpers vs new Supabase SSR patterns

### Archetype 5 Conversion Pattern

**Before (Problematic Mock Setup)**:

```typescript
// ❌ Prisma-style mocks + manual org coordination
const mockDb = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  issue: {
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

// Manual organization filtering in mocks
mockDb.issue.findMany.mockImplementation((args) => {
  if (args.where?.organizationId === "test-org") {
    return [{ id: "1", title: "Test", organizationId: "test-org" }];
  }
  return [];
});
```

**After (Archetype 5 RLS-Optimized)**:

```typescript
// ✅ Drizzle-style mocks + RLS context
import { createVitestMockContext } from "~/test/vitestMockContext";

const mockDb = vi.hoisted(() => ({
  query: {
    issues: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { id: "1", title: "Test Issue", organizationId: "test-org" },
        ]),
      findFirst: vi.fn(),
    },
  },
  insert: vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi
        .fn()
        .mockResolvedValue([
          { id: "1", title: "New Issue", organizationId: "test-org" },
        ]),
    }),
  }),
  // RLS context simulation
  execute: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

// Mock context with RLS-aware user
const mockCtx = createVitestMockContext({
  user: {
    id: "test-user",
    user_metadata: {
      organizationId: "test-org",
      role: "admin",
    },
  },
});

test("router respects RLS boundaries", async () => {
  const caller = appRouter.createCaller(mockCtx);

  // Mock simulates RLS behavior - only org-scoped data returned
  const result = await caller.issues.getAll();

  expect(result).toHaveLength(1);
  expect(result[0].organizationId).toBe("test-org");

  // Verify RLS context was set (in real implementation)
  expect(mockDb.execute).toHaveBeenCalledWith(
    expect.stringContaining("SET app.current_organization_id"),
  );
});
```

### Router File Conversion Procedures

#### `issue.comment.test.ts`, `issue.timeline.test.ts`, etc.

**Current Issues**: Missing RLS context in issue-related operations  
**Conversion Steps**:

1. Update mock setup to Drizzle query patterns
2. Add RLS context establishment in test setup
3. Verify comment/timeline operations respect organizational boundaries
4. Update auth patterns to Supabase SSR

#### `machine.location.test.ts`, `machine.owner.test.ts`

**Current Issues**: Machine operations lack proper organizational scoping  
**Conversion Steps**:

1. Apply Archetype 5 mock patterns
2. Establish RLS context for machine operations
3. Verify location/ownership operations respect boundaries
4. Test cross-organization access denial

---

## "Fake Integration" Conversion

### Problematic Pattern Identification

**Files with "Fake Integration" Pattern**:

- `commentService.test.ts` (30 tests, 11 failing)
- `notificationService.test.ts` (similar pattern)

**Problem**: Direct service testing bypasses tRPC layer, losing organizational context and RLS benefits.

### Conversion Strategy

**Transform**: Direct service calls → tRPC integration tests using Archetype 3

**Before (Fake Integration)**:

```typescript
// ❌ Direct service testing - bypasses tRPC and RLS
describe("CommentService", () => {
  let commentService: CommentService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = createMockDatabase();
    commentService = new CommentService(mockDb);
  });

  test("creates comment", async () => {
    const result = await commentService.createComment({
      issueId: "issue-1",
      content: "Test comment",
      userId: "user-1",
      organizationId: "org-1", // Manual coordination
    });

    expect(result.content).toBe("Test comment");
  });
});
```

**After (Proper Integration with Archetype 3)**:

```typescript
// ✅ tRPC integration with RLS
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
import { createTRPCCaller } from "~/test/helpers/trpc-caller";

test("creates comment via tRPC with RLS", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Set RLS context
    await db.execute(sql`SET app.current_organization_id = 'test-org'`);
    await db.execute(sql`SET app.current_user_id = 'test-user'`);

    // Create test issue first
    const [issue] = await db
      .insert(issues)
      .values({
        title: "Test Issue",
        description: "Test Description",
      })
      .returning();

    // Test via tRPC caller - respects RLS
    const caller = createTRPCCaller(db, {
      user: {
        id: "test-user",
        user_metadata: { organizationId: "test-org", role: "admin" },
      },
    });

    const result = await caller.comments.create({
      issueId: issue.id,
      content: "Test comment",
      // No manual organizationId - RLS handles it
    });

    expect(result.content).toBe("Test comment");
    expect(result.organizationId).toBe("test-org"); // RLS enforced
  });
});
```

### Service Test Conversion Procedures

#### `commentService.test.ts`

**Conversion Steps**:

1. **Replace direct service tests** with tRPC integration tests
2. **Apply Archetype 3** (PGlite Integration RLS-Enhanced)
3. **Establish RLS context** for all comment operations
4. **Verify organizational scoping** in comment creation/retrieval
5. **Test soft delete patterns** with RLS enforcement

#### `notificationService.test.ts`

**Conversion Steps**:

1. **Convert to tRPC integration pattern**
2. **Add RLS context for notification operations**
3. **Verify cross-user notification boundaries**
4. **Test notification delivery respects organizational scoping**

---

## Infrastructure Test Cleanup

### File-Specific Archetype Applications

#### `env-test-helpers.test.ts`

**Apply**: Archetype 6 (Environment Configuration Testing)  
**Focus**: Validate RLS configuration in test environments

#### `trpc.permission.test.ts`

**Apply**: Archetype 5 (tRPC Router RLS-Optimized)  
**Focus**: Test permission middleware with RLS context

#### `permissions.test.ts`

**Apply**: Archetype 4 (Permission Testing with RLS)  
**Focus**: Validate RLS policy enforcement

#### `drizzle-singleton.test.ts`

**Apply**: Archetype 3 (PGlite Integration RLS-Enhanced)  
**Focus**: Test database singleton with RLS support

#### `collectionService.test.ts`

**Apply**: Convert to Archetype 3 (eliminate service testing anti-pattern)  
**Focus**: Transform to proper tRPC integration

---

## File-Specific Procedures

### High-Priority Integration Files

#### `admin.integration.test.ts`

**Current State**: Complex admin operations with coordination failures  
**Target State**: RLS-enhanced admin operations with automatic scoping

**Conversion Procedure**:

1. **Replace database setup**: Per-test → worker-scoped pattern
2. **Add RLS context**: Admin context with elevated permissions
3. **Update bulk operations**: Remove manual `organizationId` filtering
4. **Verify access control**: Test cross-organization access denial
5. **Performance check**: Ensure bulk operations remain efficient

**Key Code Changes**:

```typescript
// Before: Manual coordination
await createTestOrganization("test-org");
await createTestUser("admin-user", "test-org", "admin");

// After: RLS context
await db.execute(sql`SET app.current_organization_id = 'test-org'`);
await db.execute(sql`SET app.current_user_id = 'admin-user'`);
await db.execute(sql`SET app.current_user_role = 'admin'`);
```

#### `schema-data-integrity.integration.test.ts`

**Current State**: Schema constraints without organizational context  
**Target State**: RLS-aware constraint validation

**Conversion Procedure**:

1. **Add RLS context to all constraint tests**
2. **Verify foreign key constraints respect organizational boundaries**
3. **Test RLS policy enforcement in edge cases**
4. **Validate generated column behavior with RLS**

### Critical Router Files

#### `issue.comment.test.ts`

**Current State**: 30+ failing tests with mock incompatibilities  
**Target State**: Clean Archetype 5 implementation

**Conversion Procedure**:

1. **Update mock structure**: Prisma → Drizzle query patterns
2. **Add RLS context simulation**: Mock organizational boundaries
3. **Fix auth patterns**: Update to Supabase SSR
4. **Verify comment threading**: Ensure hierarchical operations work
5. **Test soft delete**: Verify RLS enforcement in comment deletion

#### `model.core.test.ts`, `model.opdb.test.ts`

**Current State**: Complex model operations with manual scoping  
**Target State**: RLS-optimized model operations

**Conversion Procedure**:

1. **Apply Archetype 5**: Update to tRPC Router RLS-Optimized pattern
2. **Establish model context**: Set appropriate RLS context for model operations
3. **Verify data isolation**: Test model operations respect boundaries
4. **Performance validation**: Ensure complex queries remain efficient

---

## Progress Tracking

### Metrics Dashboard

**Test Failure Tracking**:

```
Integration Test Batch (Priority 1): 10 files → Target: 0 failures
├── admin.integration.test.ts: 15 failures → 0
├── issue.timeline.integration.test.ts: 8 failures → 0
├── location.aggregation.integration.test.ts: 12 failures → 0
└── ... (track each file)

Router Test Batch (Priority 2): 12 files → Target: 0 failures
├── issue.comment.test.ts: 11 failures → 0
├── issue.test.ts: 25 failures → 0
└── ... (track each file)

Infrastructure Test Batch (Priority 3): 5 files → Target: 0 failures
├── permissions.test.ts: 8 failures → 0
└── ... (track each file)

TOTAL: 306 failures → 0 failures
```

### Progress Tracking Commands

```bash
# Check current test status
npm run test:brief 2>/dev/null | grep -E "(failing|passing)"

# Run specific batch tests
npm run test:brief:node                    # Integration Test Batch (if using node project)
npm run test src/server/api/routers/       # Router Test Batch

# Memory usage monitoring (critical for PGlite)
npm run test:verbose | grep -i "memory\|timeout"

# Archetype compliance check
# Note: Requires custom script from migration setup
npm run validate-test-patterns 2>/dev/null || echo "⚠️  Pattern validation not configured"
```

### Batch Completion Milestones

**Integration Test Batch (Priority 1)**:

- [ ] Convert critical integration files (high complexity)
- [ ] Convert remaining integration files (medium complexity)
- [ ] Validate all integration tests pass
- [ ] Target: 0 integration test failures

**Router Test Batch (Priority 2)**:

- [ ] Convert high-priority router files (issue.\*.test.ts)
- [ ] Convert machine and model router files
- [ ] Validate all router tests pass
- [ ] Target: 0 router test failures

**Infrastructure Test Batch (Priority 3)**:

- [ ] Convert infrastructure test files
- [ ] Final validation and optimization
- [ ] Complete Phase 3 documentation
- [ ] Target: 0 total test failures

---

## Quality Validation

### Archetype Compliance Checks

**Automated Validation**:

```typescript
// Custom validation script
const ARCHETYPE_PATTERNS = {
  integration: /import.*worker-scoped-db.*withIsolatedTest/,
  router: /createVitestMockContext.*user_metadata/,
  "rls-context": /SET app\.current_organization_id/,
  "memory-safe": /test.*async.*\(\{.*workerDb.*\}\)/,
};

function validateTestArchetype(filePath: string, expectedArchetype: string) {
  const content = fs.readFileSync(filePath, "utf-8");
  const pattern = ARCHETYPE_PATTERNS[expectedArchetype];

  if (!pattern.test(content)) {
    throw new Error(
      `${filePath} does not follow ${expectedArchetype} archetype`,
    );
  }
}
```

**Manual Quality Gates**:

1. **RLS Context Establishment**: Every test must establish proper RLS context
2. **Memory Safety**: All integration tests must use worker-scoped pattern
3. **Organizational Scoping**: Tests must verify organizational boundaries
4. **Performance**: Test execution time should improve with RLS simplification
5. **Maintainability**: Tests follow consistent archetype patterns

### Success Criteria

**Technical Criteria**:

- [ ] All 306 tests pass consistently
- [ ] Memory usage remains stable during test execution
- [ ] Test execution time improved by 20%+ (RLS efficiency gains)
- [ ] Zero ad-hoc test patterns (all follow defined archetypes)

**Quality Criteria**:

- [ ] Every test file follows its assigned archetype exactly
- [ ] RLS context is properly established in all relevant tests
- [ ] Organizational boundaries are consistently tested
- [ ] Test maintenance burden reduced (simpler patterns)

**Documentation Criteria**:

- [ ] All archetype applications documented
- [ ] Complex conversion decisions recorded
- [ ] Migration benefits quantified and validated
- [ ] Future test development guidelines established

---

## Implementation Commands

### Integration Test Batch (Priority 1)

```bash
# Start Integration Test Batch
git checkout -b integration-test-batch

# Convert integration tests one by one
npm run test-file src/integration-tests/admin.integration.test.ts
npm run validate-file src/integration-tests/admin.integration.test.ts

# Progress tracking
npm run test:verbose src/integration-tests/

# Completion validation
npm run test src/integration-tests/
```

### Router Test Batch (Priority 2)

```bash
# Start Router Test Batch
git checkout -b router-test-batch

# Convert router tests by priority
npm run test-file src/server/api/routers/__tests__/issue.comment.test.ts
npm run validate-file src/server/api/routers/__tests__/issue.comment.test.ts

# Mock validation
npm run typecheck:brief # Ensure mock types are correct
```

### Infrastructure Test Batch (Priority 3)

```bash
# Start Infrastructure Test Batch
git checkout -b infrastructure-test-batch

# Convert infrastructure tests
npm run test-file src/test/__tests__/permissions.test.ts
npm run validate-file src/test/__tests__/permissions.test.ts

# Final validation
npm run test # All tests should pass
npm run validate # Full project validation
```

---

## Conclusion

Phase 3 represents the systematic application of our carefully designed testing archetypes to convert 306 failing tests into excellent RLS-enhanced patterns. By following this structured, priority-based approach:

**Architectural Benefits Realized**:

- Database-level multi-tenancy testing with automatic organizational scoping
- Simplified test setup eliminating complex coordination patterns
- Memory-safe integration testing with worker-scoped PGlite
- Consistent, maintainable test patterns across the entire codebase

**Process Benefits Achieved**:

- Systematic conversion ensuring no ad-hoc fixes
- Clear progress tracking from 306 failures to 0 failures
- Quality validation ensuring archetype compliance
- Reduced maintenance burden through simplified patterns

**Technical Excellence Delivered**:

- All tests follow proven, designed archetypes
- RLS context properly established for organizational scoping
- Integration tests use memory-safe worker-scoped patterns
- Router tests properly mock Drizzle patterns with RLS simulation

The completion of Phase 3 will deliver a robust, maintainable testing infrastructure that fully leverages the RLS implementation from Phase 2, setting the foundation for confident ongoing development in subsequent phases.
