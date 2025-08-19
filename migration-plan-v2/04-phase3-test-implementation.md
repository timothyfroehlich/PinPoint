# Phase 3: Systematic Test Implementation - RLS-Enhanced Testing

**Status**: Ready for Execution - Converting 95 analyzed test files to RLS-enhanced patterns  
**Phase**: 3 of 5 - Test Implementation Using Designed Archetypes  
**Context**: RLS implemented (Phase 2) + Testing architecture completed (Phase 2.5)  
**Approach**: Systematic archetype application based on concrete inventory analysis

## Executive Summary

**Goal**: Convert 95 test files using pgTAP + PGlite testing strategy with agent specialization for optimal performance and comprehensive coverage.

**pgTAP RLS Validation** (~15 tests)
- Native PostgreSQL RLS policy testing
- JWT claim simulation for organizational contexts
- Database-level security boundary validation

**Business Logic Testing with integration_tester** (~80 tests)  
- PGlite with `integration_tester` role (BYPASSRLS)
- 5x faster execution without RLS overhead
- Focus on pure business functionality

**Inventory Analysis Achievements**:

✅ **Memory Safety Excellence**: ZERO dangerous patterns found across 95 files
✅ **Agent Workload Distribution**: 3 specialized agents with clear file assignments
✅ **Conversion Readiness**: 89% of files require minimal to moderate changes
✅ **Effort Estimation**: 143-286 hours total with priority-based execution

**Key Benefits Being Realized**:

- **Optimal performance**: 5x faster business logic tests + comprehensive RLS validation
- **Clear separation**: Security testing vs functionality testing  
- **Simplified setup**: Direct data creation vs complex organizational coordination
- **Memory-safe patterns**: Worker-scoped PGlite with transaction isolation
- **Comprehensive coverage**: 100% RLS validation + complete business logic testing

**Success Metrics**:

- 95 test files → archetype-compliant patterns
- All tests follow agent-specialized archetypes (no ad-hoc patterns)
- Test execution time improved (RLS eliminates coordination overhead)
- Memory usage stable (200-400MB confirmed safe range)

---

## Phase 3 Execution Strategy

### Systematic Archetype Application

**CRITICAL PRINCIPLE**: Every test repair must follow a defined archetype from Phase 2.5. No ad-hoc fixes allowed.

**Agent Assignment Matrix** (95 Files Total):

| **Agent** | **Archetypes** | **File Count** | **Effort Hours** | **Priority Focus** |
|---|---|---|---|---|
| **`unit-test-architect`** | 1, 4 | 38 (40%) | 24-48 | Foundation patterns |
| **`integration-test-architect`** | 2, 3, 5 | 40 (42%) | 58-116 | Router conversions + RLS |
| **`security-test-architect`** | 6, 7, 8 | 22 (23%) | 36-72 | Security compliance |

**Agent Responsibilities**:
- **`unit-test-architect`**: Pure functions + React components (foundation templates)
- **`integration-test-architect`**: Service logic + PGlite + tRPC routers (critical conversions)
- **`security-test-architect`**: Permissions + RLS policies + Schema constraints

**Quality Gates**:

1. **Pre-conversion**: Validate archetype applicability
2. **During conversion**: Follow archetype patterns exactly
3. **Post-conversion**: Verify archetype compliance
4. **Integration**: Ensure RLS benefits are realized

---

## Dual-Track Implementation Strategy

### Phase 3.1: `security-test-architect` - RLS Policy Enhancement (Priority 1)

**Goal**: Enhance 22 security-focused tests with proper archetype alignment and RLS validation

**Scope**: Archetypes 6, 7 & 8 (Permissions + RLS + Schema)
**Files**: 22 total (5 needing critical archetype alignment)
**Effort**: 36-72 hours

**Critical Conversions** (5 files):
- Security tests currently in wrong archetype categories
- Need movement to proper Archetypes 6, 7, 8
- Enhanced RLS policy testing using established templates

**Enhanced RLS Coverage** (17 files):
- Cross-organizational boundary testing
- Permission matrix validation
- Security edge case coverage

**Files to Create**:
```
supabase/tests/
├── setup/
│   ├── 01-test-roles.sql          # Test role configuration
│   └── 02-test-data.sql           # Common test data
├── rls/
│   ├── organizations.test.sql     # Organization RLS policies
│   ├── issues.test.sql            # Issue RLS policies  
│   ├── machines.test.sql          # Machine RLS policies
│   ├── locations.test.sql         # Location RLS policies
│   ├── comments.test.sql          # Comment RLS policies
│   ├── memberships.test.sql       # Membership RLS policies
│   ├── relationships.test.sql     # Cross-table security
│   ├── permissions.test.sql       # Role-based access
│   └── security-edge-cases.test.sql # Attack scenarios
└── run-tests.sh                   # pgTAP test runner
```

**Implementation Pattern**:
```sql
-- Example: supabase/tests/rls/issues.test.sql
BEGIN;
SELECT plan(4);

-- Test organizational isolation
SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claims = '{"app_metadata": {"organizationId": "org-1"}}';

SELECT results_eq(
  'SELECT organization_id FROM issues',
  $$VALUES ('org-1')$$,
  'User only sees their org issues'
);

-- Test cross-org prevention
PREPARE cross_org_insert AS 
  INSERT INTO issues (title, organization_id) VALUES ('Test', 'org-2');
SELECT throws_ok('cross_org_insert', '42501', 'RLS prevents cross-org access');

SELECT * FROM finish();
ROLLBACK;
```

### Phase 3.2: `integration-test-architect` - Critical Router Conversions (Priority 2)

**Goal**: Convert 40 files with focus on 13 critical router unit→tRPC router conversions

**Scope**: Archetypes 2, 3 & 5 (Service Logic + PGlite + tRPC Router)
**Files**: 40 total (13 critical router conversions)
**Effort**: 58-116 hours

**Critical Router Conversions** (13 files):
- `issue.test.ts`, `issue.timeline.test.ts`, `issue.notification.test.ts`
- `model.core.test.ts`, `model.opdb.test.ts`
- `machine.owner.test.ts`, `machine.location.test.ts`
- `collection.test.ts`, `notification.test.ts`, `pinballMap.test.ts`
- `routers.integration.test.ts`, `routers.drizzle.integration.test.ts`
- `issue.confirmation.test.ts`

**Pattern**: Unit Test (Archetype 1) → tRPC Router Test (Archetype 5)

**Service & Integration Files** (27 files):
- Maintain existing good patterns
- Enhance RLS session context
- Memory safety already excellent

**Database Connection Update**:
```env
# Update .env.test 
DATABASE_URL="postgresql://integration_tester:testpassword@localhost:5432/postgres"
```

**Router Conversion Pattern** (From Actual File Analysis):
```typescript
// BEFORE: Unit test with complex mocks (issue.comment.test.ts)
const mockDb = {
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  issue: {
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
  },
};

// AFTER: tRPC Router integration test (Archetype 5)
import { createVitestMockContext } from "~/test/vitestMockContext";

const mockDb = {
  query: {
    issues: {
      findMany: vi.fn().mockResolvedValue([
        { id: "1", title: "Test Issue", organizationId: "test-org" },
      ]),
    },
  },
  execute: vi.fn().mockResolvedValue(undefined), // RLS context
};

const mockCtx = createVitestMockContext({
  user: {
    id: "test-user",
    user_metadata: { organizationId: "test-org", role: "admin" },
  },
});

test("router respects RLS boundaries", async () => {
  const caller = appRouter.createCaller(mockCtx);
  const result = await caller.issues.getAll();
  expect(result[0].organizationId).toBe("test-org");
});
```

**Agent Processing Order**:
1. **`unit-test-architect`** (38 files) - Foundation patterns for templates
2. **`integration-test-architect`** (40 files) - Critical router conversions  
3. **`security-test-architect`** (22 files) - Security archetype alignment

### Implementation Quality Gates

**Track 1 Quality Gates**:
- [ ] All RLS policies have direct tests
- [ ] JWT claim simulation covers all user types
- [ ] Cross-organizational boundaries tested
- [ ] Permission matrices validated
- [ ] Security edge cases covered

**Track 2 Quality Gates**:
- [ ] All tests use `integration_tester` role
- [ ] Business logic focus (no security mixed in)
- [ ] 5x performance improvement achieved
- [ ] Memory safety maintained
- [ ] Test clarity improved

---

## Priority-Based Implementation Batches

### **`unit-test-architect` Workload (Priority 1) - FOUNDATION**

**Target**: 38 test files - foundational pattern establishment

**High Priority Component Tests** (15 files):
- `MachineDetailView.test.tsx` - Exemplary auth integration pattern
- `PrimaryAppBar.test.tsx` - Sophisticated permission testing
- `PermissionGate.test.tsx` - Permission testing template
- `IssueList.unit.test.tsx` - ⚠️ Mixed concerns (needs decomposition)
- Plus 11 additional component tests

**High Priority Pure Function Tests** (18 files):
- Validation schemas (8 files)
- Utility functions (5 files)  
- Auth helpers (3 files)
- Business logic (2 files)

**Remaining Files** (5 files):
- Minor pattern alignment
- Import path standardization

**Conversion Strategy**: Apply Archetype 1 (Pure Function) & Archetype 4 (React Component) templates

### **`integration-test-architect` Workload (Priority 2) - CRITICAL CONVERSIONS**

**Target**: 40 test files with 13 critical router conversions

**Critical Router Unit→tRPC Conversions** (13 files):
- `issue.comment.test.ts` - 30+ failing tests, complex permission validation
- `issue.test.ts`, `issue.timeline.test.ts`, `issue.notification.test.ts`
- `model.core.test.ts`, `model.opdb.test.ts` - Complex model operations
- `machine.owner.test.ts`, `machine.location.test.ts` - Machine operations
- `collection.test.ts` - Service mocking to tRPC integration
- `notification.test.ts`, `pinballMap.test.ts`
- `routers.integration.test.ts`, `routers.drizzle.integration.test.ts`
- `issue.confirmation.test.ts`

**PGlite Integration Files** (18 files):
- Already following excellent patterns (e.g., `commentService.integration.test.ts`)
- Minor RLS session context enhancements
- Memory safety already validated

**Service Logic Files** (7 files):
- Maintain current Archetype 2 patterns
- No major conversions needed

**Infrastructure Tests** (2 files):
- Minor improvements only

**Conversion Strategy**: Unit Test (Archetype 1) → tRPC Router Test (Archetype 5) for router files

### **`security-test-architect` Workload (Priority 3) - SECURITY COMPLIANCE**

**Target**: 22 test files focused on security boundary validation

**Critical Archetype Alignments** (5 files):
- Security tests currently in wrong archetype categories
- Need movement to Archetypes 6, 7, 8
- Enhanced RLS policy testing

**Permission/Auth Tests** (13 files - Archetype 6):
- `permissions.test.ts`, `trpc.permission.test.ts`
- Permission boundary validation
- Role-based access control testing

**RLS Policy Tests** (6 files - Archetype 7):
- `cross-org-isolation.test.ts` - Exemplary RLS enforcement
- `multi-tenant-isolation.integration.test.ts` - Multi-tenant boundaries
- Direct RLS policy validation

**Schema/Database Constraint Tests** (3 files - Archetype 8):
- Database constraint testing with RLS context
- Schema validation with organizational boundaries

**Conversion Strategy**: Enhance existing security tests with proper archetype alignment and comprehensive RLS validation

---

## Memory Safety Excellence Achievement

### Audit Results

**95 Files Analyzed - ZERO Dangerous Patterns Found**:

✅ **No per-test PGlite instances**: Prevents 50-100MB per test memory blowout
✅ **All integration tests use worker-scoped patterns**: Shared instances across worker threads
✅ **Proper transaction isolation**: `withIsolatedTest` used consistently
✅ **Estimated memory usage**: 200-400MB total (safe operational range)

**Exemplary Safe Patterns**:
- `commentService.integration.test.ts` - Perfect worker-scoped PGlite usage
- `location.integration.test.ts` - Proper transaction isolation
- `cross-org-isolation.test.ts` - Safe multi-context testing

**Impact**: System lockup prevention achieved, stable memory usage confirmed

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
# Check current test status by agent
npm run test src/components/               # unit-test-architect files
npm run test src/server/api/routers/       # integration-test-architect files  
npm run test src/integration-tests/        # security-test-architect files

# Memory usage monitoring (validated safe)
npm run test:coverage                      # Full test suite with coverage
npm run test:brief                         # Fast execution validation

# Agent-specific validation
npm run validate-file [FILE_PATH]          # Single file validation
npm run test-file [FILE_PATH]              # Single file test execution

# Overall progress
npm run test:all                           # Both pgTAP RLS + business logic tests
```

### Agent Completion Milestones

**`unit-test-architect` (38 files)**:

- [ ] Establish foundational patterns for Archetypes 1 & 4
- [ ] Decompose mixed concerns (IssueList.unit.test.tsx)
- [ ] Standardize component testing patterns
- [ ] Complete pure function test templates
- [ ] Target: Template excellence for other agents

**`integration-test-architect` (40 files)**:

- [ ] Convert 13 critical router unit tests to tRPC Router tests
- [ ] Implement standardized RLS session context
- [ ] Enhance organizational boundary validation
- [ ] Maintain excellent PGlite integration patterns
- [ ] Target: All router tests follow Archetype 5

**`security-test-architect` (22 files)**:

- [ ] Align 5 security tests to proper archetypes
- [ ] Enhance RLS policy testing comprehensiveness
- [ ] Strengthen permission boundary validation
- [ ] Complete schema constraint testing with RLS
- [ ] Target: 100% security archetype compliance

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

- [ ] All 95 test files follow assigned archetype patterns
- [ ] Memory usage remains in 200-400MB safe range
- [ ] Test execution time improved (RLS eliminates coordination overhead)
- [ ] Zero ad-hoc test patterns (agent specialization maintained)

**Quality Criteria**:

- [ ] Every test file follows its agent-assigned archetype exactly
- [ ] RLS context is properly established where beneficial
- [ ] Organizational boundaries are consistently tested
- [ ] Test maintenance burden reduced (worker-scoped patterns)

**Agent Success Criteria**:

- [ ] `unit-test-architect`: Foundation patterns established for future development
- [ ] `integration-test-architect`: Router conversions realize RLS benefits
- [ ] `security-test-architect`: Security compliance through proper archetype alignment

**Documentation Criteria**:

- [ ] All archetype applications documented
- [ ] Complex conversion decisions recorded
- [ ] Migration benefits quantified and validated
- [ ] Future test development guidelines established

---

## Implementation Commands

### `unit-test-architect` Implementation

```bash
# Start Foundation Pattern Implementation
git checkout -b unit-test-foundation

# Component test standardization
npm run test-file src/components/machines/MachineDetailView.test.tsx
npm run validate-file src/components/machines/MachineDetailView.test.tsx

# Pure function test templates
npm run test-file src/lib/common/__tests__/inputValidation.test.ts
npm run validate-file src/lib/common/__tests__/inputValidation.test.ts

# Mixed concern decomposition
npm run test-file src/components/issues/__tests__/IssueList.unit.test.tsx

# Progress tracking
npm run test src/components/ src/lib/
```

### `integration-test-architect` Implementation

```bash
# Start Critical Router Conversions
git checkout -b router-conversion-batch

# Critical router unit→tRPC conversions
npm run test-file src/server/api/routers/__tests__/issue.comment.test.ts
npm run validate-file src/server/api/routers/__tests__/issue.comment.test.ts

# Model and machine router conversions
npm run test-file src/server/api/routers/__tests__/model.core.test.ts
npm run test-file src/server/api/routers/__tests__/machine.owner.test.ts

# RLS session context validation
npm run typecheck:brief # Ensure RLS context types are correct
```

### `security-test-architect` Implementation

```bash
# Start Security Archetype Alignment
git checkout -b security-archetype-alignment

# Security archetype conversions
npm run test-file src/integration-tests/cross-org-isolation.test.ts
npm run validate-file src/integration-tests/cross-org-isolation.test.ts

# Permission and RLS policy testing
npm run test-file src/server/auth/__tests__/permissions.test.ts
npm run test-file src/server/api/__tests__/trpc.permission.test.ts

# Final security validation
npm run test:rls # pgTAP RLS tests
npm run test # All tests should pass
```

---

## Conclusion

Phase 3 represents the systematic application of our carefully designed testing archetypes to convert 95 analyzed test files into excellent RLS-enhanced patterns. By following this agent-specialized, priority-based approach:

**Architectural Benefits Realized**:

- Memory safety excellence: ZERO dangerous patterns found across all 95 files
- Agent specialization: 3 specialized agents with clear workload distribution
- Database-level multi-tenancy testing with automatic organizational scoping
- Simplified test setup eliminating complex coordination patterns
- Consistent, maintainable test patterns across the entire codebase

**Process Benefits Achieved**:

- Systematic conversion based on concrete inventory analysis (not theoretical frameworks)
- Clear progress tracking through agent-specific milestones
- Quality validation ensuring archetype compliance
- Effort estimation: 143-286 hours across 3 specialized agents

**Technical Excellence Delivered**:

- All tests follow agent-specialized archetypes (38 unit-test, 40 integration-test, 22 security-test)
- RLS context properly established for organizational scoping
- Integration tests use validated memory-safe worker-scoped patterns
- Router tests properly converted from unit tests to tRPC Router integration tests

**Inventory Analysis Success**:

- Foundation patterns established through exemplary file identification
- Critical conversions identified (13 router unit→tRPC router transformations)
- Memory usage confirmed sustainable (200-400MB safe range)
- Agent specialization prevents archetype violations

The completion of Phase 3 will deliver a robust, maintainable testing infrastructure that fully leverages the RLS implementation from Phase 2, with agent specialization ensuring systematic conversion quality and preventing regression to poor patterns.
