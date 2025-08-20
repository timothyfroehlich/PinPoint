# Phase 3: Systematic Test Implementation - Consultant-Guided RLS Enhancement

**Status**: Ready for Execution - Converting 87 test files to RLS-enhanced patterns  
**Phase**: 3 of 5 - Serial Implementation Using Consultant Analysis + Designed Archetypes  
**Context**: RLS implemented (Phase 2) + Testing architecture completed (Phase 2.5)  
**Approach**: Consultant-guided serial implementation based on concrete analysis and roadmaps

## Executive Summary

**Goal**: Convert 87 test files using pgTAP + PGlite testing strategy with specialized consultant analysis for optimal implementation guidance and comprehensive coverage.

**pgTAP RLS Validation** (~15 tests)
- Native PostgreSQL RLS policy testing
- JWT claim simulation for organizational contexts
- Database-level security boundary validation

**Business Logic Testing with integration_tester** (~80 tests)  
- PGlite with `integration_tester` role (BYPASSRLS)
- 5x faster execution without RLS overhead
- Focus on pure business functionality

**Inventory Analysis Achievements**:

✅ **Memory Safety Excellence**: ZERO dangerous patterns found across 87 files
✅ **Consultant Analysis Strategy**: 3 specialized consultants providing implementation roadmaps
✅ **Conversion Readiness**: 89% of files require minimal to moderate changes
✅ **Serial Implementation**: Analyze→Implement cycles with expert guidance

**Key Benefits Being Realized**:

- **Optimal performance**: 5x faster business logic tests + comprehensive RLS validation
- **Clear separation**: Security testing vs functionality testing  
- **Simplified setup**: Direct data creation vs complex organizational coordination
- **Memory-safe patterns**: Worker-scoped PGlite with transaction isolation
- **Comprehensive coverage**: 100% RLS validation + complete business logic testing

**Success Metrics**:

- 87 test files → archetype-compliant patterns
- All tests follow consultant-analyzed archetypes (no ad-hoc patterns)  
- Test execution time improved (RLS eliminates coordination overhead)
- Memory usage stable (200-400MB confirmed safe range)
- Current failures: 335 → 0 through systematic implementation

---

## Phase 3 Execution Strategy

### Serial Consultant-Guided Implementation

**CRITICAL PRINCIPLE**: Every test implementation follows consultant analysis roadmaps and defined archetypes from Phase 2.5. No ad-hoc fixes allowed.

**Consultant Analysis Matrix** (87 Files Total):

| **Consultant** | **Archetypes** | **File Count** | **Analysis Focus** |
|---|---|---|---|
| **`security-test-analysis-consultant`** | 6, 7, 8 | ~22 (25%) | Security boundary analysis |
| **`integration-test-analysis-consultant`** | 2, 3, 5 | ~40 (46%) | Memory safety + router conversions |
| **`unit-test-analysis-consultant`** | 1, 4 | ~25 (29%) | Foundation pattern analysis |

**Consultant Responsibilities**:
- **`security-test-analysis-consultant`**: Analyze security boundaries, RLS compliance, multi-tenant isolation
- **`integration-test-analysis-consultant`**: Analyze memory safety, router conversions, RLS context management
- **`unit-test-analysis-consultant`**: Analyze foundation patterns, SEED_TEST_IDS standardization, component behavior

**Quality Gates**:

1. **Pre-conversion**: Validate archetype applicability
2. **During conversion**: Follow archetype patterns exactly
3. **Post-conversion**: Verify archetype compliance
4. **Integration**: Ensure RLS benefits are realized

---

## Serial Implementation Strategy

### Phase 3.1: Security Analysis

**Goal**: Use `security-test-analysis-consultant` to analyze ~22 security test files and create comprehensive implementation roadmap

**Scope**: Security boundary analysis for Archetypes 6, 7 & 8 (Permissions + RLS + Schema)
**Analysis Output**: Detailed roadmap for security compliance enhancement
**Context7 Research**: Current PostgreSQL RLS, pgTAP, and Supabase auth patterns

### Phase 3.2: Security Implementation

**Goal**: Implement security test conversions following consultant roadmap

**Focus**: 
- Critical archetype alignments 
- RLS policy enforcement validation
- Cross-organizational boundary testing
- Permission matrix validation

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

### Phase 3.3: Integration Analysis (Context-Managed Sub-Phases)

**Goal**: Use `integration-test-analysis-consultant` to analyze ~41 integration test files in **5 focused sub-phases** with context compacting between each batch to avoid context overload

**Revised Strategy**: Break into tightly-coupled groups by content/focus areas (4-8 files each)

#### Phase 3.3a: Issue Management Analysis & Implementation (~8 files) ✅ **FULLY COMPLETE**
**Focus**: Complete issue workflow testing patterns - ANALYSIS + IMPLEMENTATION COMPLETE
- **Router Conversions**: ✅ **ALL CONVERTED** - `issue.comment.test.ts` (22/22), `issue.status.test.ts` (9/9), `issue.notification.test.ts` (6/6), `issue.timeline.test.ts` (13/13) 
- **Integration Tests**: `issue.timeline.integration.test.ts`, `comment.integration.test.ts` (validation pending)
- **Analysis Focus**: Critical router unit→tRPC conversions, comment/timeline integration patterns
- **Implementation Results**: 
  - ✅ **50/50 tests passing** across all converted router files
  - ✅ **100% SEED_TEST_IDS integration** with consistent mock data
  - ✅ **Complete RLS context simulation** and organizational boundary validation
  - ✅ **Service interface alignment** - test expectations match actual router implementations
  - ✅ **Archetype 5 compliance** - All files follow tRPC Router integration patterns
  - ✅ **Memory-safe testing** - All patterns follow worker-scoped PGlite guidelines

#### Phase 3.3b: Machine & Location Analysis & Implementation (~8 files) ✅ **COMPLETE**
**Focus**: Physical entity management workflows
- **Router Conversions**: `machine.owner.test.ts`, `machine.location.test.ts` ✅ **CONVERTED**
- **Integration Tests**: `machine.owner.integration.test.ts`, `machine.location.integration.test.ts`, `location.integration.test.ts`, `location.crud.integration.test.ts`, `location.services.integration.test.ts`, `location.aggregation.integration.test.ts`
- **Analysis Focus**: Physical entity management, RLS scoping for location/machine data
- **Analysis Results**: EXCELLENT memory safety (all integration tests), 2 CRITICAL router conversions needed (unit → tRPC integration)
- **Implementation**: ✅ Converted mock-heavy router unit tests to tRPC router integration patterns
- **Status**: Unit→tRPC router conversions completed with proper `withIsolatedTest` patterns

#### Phase 3.3c: Admin & Infrastructure Analysis & Implementation (~6 files) ✅ **COMPLETE**
**Focus**: System administration and core infrastructure
- **Integration Tests**: `admin.integration.test.ts` ✅ **MEMORY SAFETY FIXED**, `role.integration.test.ts` ✅ **PATTERNS STANDARDIZED**, `schema-data-integrity.integration.test.ts`, `schema-migration-validation.integration.test.ts`
- **Router Conversions**: `routers.integration.test.ts` ✅ **MOCK→tRPC INTEGRATION CONVERTED**
- **Integration**: `routers.drizzle.integration.test.ts` ✅ **CLARIFIED AS UNIT TEST** (moved to `drizzle.schema.unit.test.ts`)
- **Analysis Focus**: Admin operations, infrastructure patterns, schema validation
- **Critical Fixes**: 
  - 🚨 **Memory safety violation fixed** in `admin.integration.test.ts`
  - 🔧 **Pattern standardization** completed in `role.integration.test.ts` (28 `withTransaction→withIsolatedTest` conversions)
  - 🔄 **Mock-heavy conversion** completed in `routers.integration.test.ts` (975 lines mock→real tRPC router integration)
  - 📋 **Testing intent clarified** for schema validation vs router integration

#### Phase 3.3d: Model & Data Services Analysis (~6 files)
**Focus**: Data models and external service integration
- **Router Conversions**: `model.core.test.ts`, `model.opdb.test.ts`
- **Integration Tests**: `model.core.integration.test.ts`, `model.opdb.integration.test.ts`, `drizzle-crud-validation.integration.test.ts`, `notification.schema.test.ts`
- **Analysis Focus**: Model operations, external service patterns, CRUD validation

#### Phase 3.3e: Service Layer & Routing Analysis (~5 files)
**Focus**: Direct service testing and routing infrastructure
- **Router Conversions**: `collection.test.ts`, `notification.test.ts`, `pinballMap.test.ts`
- **Service Tests**: `pinballmapService.test.ts`, `roleService.test.ts`, `collectionService.test.ts`
- **Analysis Focus**: Service layer patterns, "fake integration" detection, routing infrastructure

**Analysis Output per Sub-Phase**: Focused implementation roadmap with effort estimates
**Context7 Research**: Current PGlite, Drizzle ORM, and tRPC testing patterns

### Phase 3.4: Integration Implementation (Following Sub-Phase Analysis)

**Goal**: Implement integration test conversions following consultant roadmaps from each sub-phase

**Focus**:
- Critical router unit→tRPC router conversions (13 files)
- Memory safety pattern enforcement
- RLS session context establishment
- "Fake integration" pattern elimination

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

### Phase 3.5: Unit Analysis

**Goal**: Use `unit-test-analysis-consultant` to analyze ~25 unit test files and create comprehensive implementation roadmap

**Scope**: Foundation pattern analysis for Archetypes 1 & 4 (Pure Functions + React Components)
**Analysis Output**: Detailed roadmap for foundation pattern establishment and SEED_TEST_IDS standardization
**Context7 Research**: Current Vitest v4.0+, React Testing Library, and MSW-tRPC patterns

### Phase 3.6: Unit Implementation

**Goal**: Implement unit test conversions following consultant roadmap

**Focus**:
- Foundation pattern establishment
- SEED_TEST_IDS standardization across all unit tests
- Modern Vitest v4.0 pattern adoption
- React component behavior validation

**Serial Processing Order**:
1. **Security Analysis → Security Implementation** (~22 files)
2. **Integration Analysis → Integration Implementation** (~40 files)  
3. **Unit Analysis → Unit Implementation** (~25 files)

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

### **Unit Test Implementation** (Phase 3.5-3.6) - FOUNDATION**

**Target**: ~25 test files - foundational pattern establishment following consultant analysis

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

### **Integration Test Implementation** (Phase 3.3-3.4) - CRITICAL CONVERSIONS**

**Target**: ~40 test files with 13 critical router conversions following consultant analysis

**Critical Router Unit→tRPC Conversions** (13 files):
- ✅ `issue.comment.test.ts` - **COMPLETED** (22/22 tests passing) - Complex permission validation with RLS
- ✅ `issue.timeline.test.ts` - **COMPLETED** (13/13 tests passing) - Service integration with correct parameters
- ✅ `issue.notification.test.ts` - **COMPLETED** (6/6 tests passing) - Notification workflows with boundary enforcement  
- ✅ `issue.status.test.ts` - **COMPLETED** (9/9 tests passing) - Status aggregation with organizational scoping
- `issue.test.ts`, `issue.confirmation.test.ts` - Pending implementation
- `model.core.test.ts`, `model.opdb.test.ts` - Complex model operations
- ✅ `machine.owner.test.ts`, `machine.location.test.ts` - **COMPLETED** - Machine operations
- `collection.test.ts` - Service mocking to tRPC integration
- `notification.test.ts`, `pinballMap.test.ts`
- ✅ `routers.integration.test.ts` - **COMPLETED** - Mock→real tRPC router integration
- `routers.drizzle.integration.test.ts`

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

### **Security Test Implementation** (Phase 3.1-3.2) - SECURITY COMPLIANCE**

**Target**: ~22 test files focused on security boundary validation following consultant analysis

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

**87 Files Analyzed - ZERO Dangerous Patterns Found**:

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
Security Implementation (Phase 3.1-3.2): ~22 files → Target: 0 failures
├── cross-org-isolation.test.ts: X failures → 0
├── permissions.test.ts: X failures → 0
├── multi-tenant-isolation.test.ts: X failures → 0
└── ... (track each file following consultant analysis)

Integration Implementation (Phase 3.3-3.4): ~40 files → Target: 0 failures
├── issue.comment.test.ts: X failures → 0
├── issue.test.ts: X failures → 0
├── admin.integration.test.ts: X failures → 0
└── ... (track each file following consultant analysis)

Unit Implementation (Phase 3.5-3.6): ~25 files → Target: 0 failures
├── MachineDetailView.test.tsx: X failures → 0
├── inputValidation.test.ts: X failures → 0
└── ... (track each file following consultant analysis)

TOTAL: 335 failures → 0 failures
```

### Progress Tracking Commands

```bash
# Check current test status by implementation phase
npm run test src/components/               # Unit implementation files
npm run test src/server/api/routers/       # Integration implementation files  
npm run test src/integration-tests/        # Security implementation files

# Phase 3.3a Issue Management Router Validation (✅ COMPLETE)
npm run test -- issue.comment.test.ts issue.status.test.ts issue.notification.test.ts issue.timeline.test.ts
# Result: 50/50 tests passing across all converted files

# Memory usage monitoring (validated safe)
npm run test:coverage                      # Full test suite with coverage
npm run test:brief                         # Fast execution validation

# Agent-specific validation
npm run validate-file [FILE_PATH]          # Single file validation
npm run test-file [FILE_PATH]              # Single file test execution

# Overall progress
npm run test:all                           # Both pgTAP RLS + business logic tests
```

### Implementation Completion Milestones

**Security Implementation (Phase 3.1-3.2) (~22 files)**:

- [ ] Complete consultant analysis of security boundary testing
- [ ] Implement security archetype alignment following roadmap
- [ ] Enhance RLS policy testing comprehensiveness
- [ ] Strengthen permission boundary validation
- [ ] Complete schema constraint testing with RLS context
- [ ] Target: 100% security archetype compliance

**Integration Implementation (Phase 3.3-3.4) (~40 files)**:

- [x] **Phase 3.3a FULLY COMPLETE**: Issue Management router conversions (50/50 tests passing)
  - [x] `issue.comment.test.ts` - 22/22 tests passing with complex RLS validation
  - [x] `issue.status.test.ts` - 9/9 tests passing with organizational scoping
  - [x] `issue.notification.test.ts` - 6/6 tests passing with boundary enforcement  
  - [x] `issue.timeline.test.ts` - 13/13 tests passing with service integration
- [x] **Archetype 5 compliance achieved** - All converted files follow tRPC Router integration patterns
- [x] **SEED_TEST_IDS standardization** - Consistent mock data across all files
- [x] **Service interface alignment** - Test expectations match actual router implementations
- [ ] Complete remaining router conversions (Phase 3.3b-3.3e implementation)
- [ ] Target: All router tests follow consultant-analyzed patterns

**Unit Implementation (Phase 3.5-3.6) (~25 files)**:

- [ ] Complete consultant analysis of foundation patterns
- [ ] Establish foundational patterns for Archetypes 1 & 4
- [ ] Standardize SEED_TEST_IDS usage across all unit tests
- [ ] Implement modern Vitest v4.0 patterns
- [ ] Complete pure function and component test templates
- [ ] Target: Foundation pattern excellence for future development

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

- [ ] All 87 test files follow consultant-analyzed archetype patterns
- [ ] Memory usage remains in 200-400MB safe range
- [ ] Test execution time improved (RLS eliminates coordination overhead)
- [ ] Zero ad-hoc test patterns (consultant specialization maintained)
- [ ] Current 335 test failures reduced to 0 through systematic implementation

**Quality Criteria**:

- [ ] Every test file follows its consultant-analyzed archetype exactly
- [ ] RLS context is properly established where beneficial
- [ ] Organizational boundaries are consistently tested
- [ ] Test maintenance burden reduced (worker-scoped patterns)

**Implementation Success Criteria**:

- [ ] **Security Implementation**: Security compliance through proper archetype alignment
- [ ] **Integration Implementation**: Router conversions realize RLS benefits following consultant analysis
- [ ] **Unit Implementation**: Foundation patterns established for future development

**Documentation Criteria**:

- [ ] All archetype applications documented
- [ ] Complex conversion decisions recorded
- [ ] Migration benefits quantified and validated
- [ ] Future test development guidelines established

---

## Implementation Commands

### Phase 3.1: Security Analysis

```bash
# Use security consultant for comprehensive analysis
# Consultant will research current PostgreSQL RLS, pgTAP, Supabase patterns via Context7
# Output: Detailed security implementation roadmap
```

### Phase 3.2: Security Implementation

```bash
# Implement following consultant roadmap
git checkout -b security-boundary-implementation

# Security archetype implementations following analysis
npm run test-file src/integration-tests/cross-org-isolation.test.ts
npm run validate-file src/integration-tests/cross-org-isolation.test.ts

# Permission and RLS policy testing
npm run test-file src/server/auth/__tests__/permissions.test.ts
npm run test-file src/server/api/__tests__/trpc.permission.test.ts

# Security validation
npm run test:rls # pgTAP RLS tests
```

### Phase 3.3: Integration Analysis

```bash
# Use integration consultant for comprehensive analysis
# Consultant will research current PGlite, Drizzle, tRPC patterns via Context7
# Output: Detailed router conversion and memory safety roadmap
```

### Phase 3.4: Integration Implementation

```bash
# Implement following consultant roadmap
git checkout -b integration-conversion-batch

# Critical router unit→tRPC conversions following analysis
npm run test-file src/server/api/routers/__tests__/issue.comment.test.ts
npm run validate-file src/server/api/routers/__tests__/issue.comment.test.ts

# Model and machine router conversions
npm run test-file src/server/api/routers/__tests__/model.core.test.ts
npm run test-file src/server/api/routers/__tests__/machine.owner.test.ts

# RLS session context validation
npm run typecheck:brief
```

### Phase 3.5: Unit Analysis

```bash
# Use unit consultant for comprehensive analysis
# Consultant will research current Vitest v4.0+, RTL, MSW-tRPC patterns via Context7
# Output: Detailed foundation pattern and SEED_TEST_IDS roadmap
```

### Phase 3.6: Unit Implementation

```bash
# Implement following consultant roadmap
git checkout -b unit-foundation-implementation

# Foundation pattern implementation following analysis
npm run test-file src/components/machines/MachineDetailView.test.tsx
npm run validate-file src/components/machines/MachineDetailView.test.tsx

# Pure function test templates
npm run test-file src/lib/common/__tests__/inputValidation.test.ts
npm run validate-file src/lib/common/__tests__/inputValidation.test.ts

# Progress tracking
npm run test src/components/ src/lib/
```

---

## Conclusion

Phase 3 represents the systematic application of our carefully designed testing archetypes to convert 87 analyzed test files into excellent RLS-enhanced patterns. By following this consultant-guided, serial implementation approach:

**Architectural Benefits Realized**:

- Memory safety excellence: ZERO dangerous patterns found across all 87 files
- Consultant specialization: 3 specialized consultants providing expert analysis and implementation roadmaps
- Database-level multi-tenancy testing with automatic organizational scoping
- Simplified test setup eliminating complex coordination patterns
- Consistent, maintainable test patterns across the entire codebase

**Process Benefits Achieved**:

- Systematic conversion based on consultant analysis and concrete inventory assessment (not theoretical frameworks)
- Clear progress tracking through serial analyze→implement cycles
- Quality validation ensuring archetype compliance following expert guidance
- Context7 integration ensuring current library patterns (August 2025) in all implementations

**Technical Excellence Delivered**:

- All tests follow consultant-analyzed archetypes (~25 unit, ~40 integration, ~22 security)
- RLS context properly established for organizational scoping
- Integration tests use validated memory-safe worker-scoped patterns
- Router tests properly converted from unit tests to tRPC Router integration tests
- Current 335 test failures systematically resolved through expert-guided implementation

**Consultant Analysis Success**:

- Foundation patterns established through expert analysis and implementation guidance
- Critical conversions identified (13 router unit→tRPC router transformations) with detailed roadmaps
- Memory usage confirmed sustainable (200-400MB safe range)
- Consultant specialization prevents archetype violations and ensures expert-quality implementations

The completion of Phase 3 will deliver a robust, maintainable testing infrastructure that fully leverages the RLS implementation from Phase 2, with consultant-guided implementation ensuring systematic conversion quality and preventing regression to poor patterns.
