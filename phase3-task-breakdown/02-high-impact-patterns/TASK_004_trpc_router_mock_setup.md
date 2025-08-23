# TASK 004: tRPC Router Mock Setup Pattern

## ⚡ PRIORITY: HIGH - BLOCKS API DEVELOPMENT & TESTING

**Status**: HIGH IMPACT - 126 router tests failing due to missing mock database setup  
**Impact**: API development blocked, router testing non-functional  
**Agent Type**: integration-test-architect  
**Estimated Effort**: 2-3 days  
**Dependencies**: TASK_002 (permission system), TASK_003 (RLS context patterns)

## Objective

Fix the systematic pattern where tRPC router tests fail because they don't have properly mocked database contexts. This affects 126 tests across all router test files - the second-largest fix pattern affecting API development and testing capabilities.

## Scope

**Total Impact**: 126/371 failing tests (34.0% of all test failures)

### Primary Affected Files:

- `src/server/api/routers/__tests__/issue.test.ts` - **23/27 tests failing**
- `src/server/api/routers/__tests__/issue.confirmation.test.ts` - **18/18 tests failing**
- `src/server/api/routers/__tests__/issue.comment.test.ts` - **14/22 tests failing**
- `src/server/api/routers/__tests__/issue.timeline.test.ts` - **7/13 tests failing**
- `src/server/api/routers/__tests__/model.core.test.ts` - **11/11 tests failing**
- `src/server/api/routers/__tests__/issue.comment.router.integration.test.ts` - **8/8 tests failing**
- `src/server/api/routers/__tests__/issue.integration.test.ts` - **7/7 tests failing**
- `src/server/api/routers/__tests__/issue.timeline.router.integration.test.ts` - **3/5 tests failing**
- `src/server/api/routers/utils/__tests__/commentService.integration.test.ts` - **10/10 tests failing**
- `src/server/api/routers/__tests__/collection.test.ts` - **2/16 tests failing**

### Related Files:

- `src/test/vitestMockContext.ts` - Mock context factory (needs creation/enhancement)
- `src/test/mocks/database-mocks.ts` - Mock database utilities (needs creation)
- All router test files using tRPC callers

## Error Patterns

### Pattern 1: Mock Database Undefined (Most Critical - 80%+ of failures)

```
❌ ERROR: Cannot read properties of undefined (reading 'create')
❌ ERROR: Cannot read properties of undefined (reading 'findMany')
❌ ERROR: Cannot read properties of undefined (reading 'update')
❌ ERROR: Cannot read properties of undefined (reading 'count')
Found in: issue.test.ts, issue.confirmation.test.ts, issue.comment.test.ts
```

**Translation**: Router tests have no mock database configured, so all database operations fail.

### Pattern 2: Router Integration vs Unit Test Confusion

```
❌ ERROR: "You don't have permission to access this organization"
Found in: issue.comment.router.integration.test.ts, commentService.integration.test.ts
```

**Translation**: Tests mixing router testing (should use mocks) with integration testing (needs RLS context).

### Pattern 3: Mock Setup and Spy Issues

```
❌ ERROR: expected spy to be called with arguments: [ ObjectContaining{…} ] but got 0 calls
❌ ERROR: vi.mocked(...).mockReturnValue is not a function
Found in: issue.timeline.test.ts, issue.timeline.router.integration.test.ts
```

**Translation**: Mock setup is incomplete or using wrong mocking patterns.

### Pattern 4: Missing Test Data References

```
❌ ERROR: seededData is not defined
❌ ERROR: setupPublicTestData is not defined
Found in: issue.test.ts (public procedures)
```

**Translation**: Tests reference undefined test data setup functions.

## Root Cause Analysis

### 1. **No Mock Database Context Factory**

Router tests need a `createMockTRPCContext` factory that provides mocked database operations with organizational scoping.

### 2. **Mixed Testing Concerns**

Files named "router.integration.test.ts" are mixing router testing (should use mocks) with integration testing (needs real DB + RLS context).

### 3. **Incomplete Mock Setup**

Where mocks exist, they're not comprehensive enough - missing database methods like `create`, `update`, `count`, etc.

### 4. **Missing Organizational Context**

Mock database operations don't simulate organizational scoping that the routers expect.

## Requirements

### Phase 1: Create Mock Infrastructure (Day 1)

1. **Create `createMockTRPCContext` factory** with organizational scoping
2. **Create comprehensive database mocks** for all CRUD operations
3. **Test the pattern** on a few router files to validate approach

### Phase 2: Apply Systematic Pattern (Days 2-3)

1. **Update all 126 router tests** to use proper mock context
2. **Clarify testing boundaries** (router tests vs integration tests)
3. **Fix mixed concerns** in "router.integration.test.ts" files
4. **Standardize mock data** using SEED_TEST_IDS

## Technical Specifications

### Fix 1: Mock tRPC Context Factory

**File**: `src/test/vitestMockContext.ts`

```typescript
import { vi } from "vitest";
import { SEED_TEST_IDS } from "./constants/seed-test-ids";
import { createMockDatabase } from "./mocks/database-mocks";

export type MockTRPCContext = {
  user: {
    id: string;
    user_metadata: {
      organizationId: string;
      role: string;
    };
  };
  session: {
    user: {
      id: string;
    };
  };
  db: ReturnType<typeof createMockDatabase>;
  organizationId: string; // For convenience
};

/**
 * Creates a mock tRPC context with organizational scoping
 * Use this for all router unit tests
 */
export function createMockTRPCContext(
  options: {
    organizationId?: string;
    userId?: string;
    userRole?: "admin" | "member" | "guest";
  } = {},
): MockTRPCContext {
  const {
    organizationId = SEED_TEST_IDS.ORGANIZATIONS.primary,
    userId = SEED_TEST_IDS.USERS.ADMIN,
    userRole = "admin",
  } = options;

  const mockDb = createMockDatabase(organizationId);

  return {
    user: {
      id: userId,
      user_metadata: {
        organizationId,
        role: userRole,
      },
    },
    session: {
      user: {
        id: userId,
      },
    },
    db: mockDb,
    organizationId, // Convenience property
  };
}

/**
 * Pre-configured contexts for common scenarios
 */
export const VITEST_CONTEXT_SCENARIOS = {
  ADMIN: () =>
    createMockTRPCContext({
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      userId: SEED_TEST_IDS.USERS.ADMIN,
      userRole: "admin",
    }),

  MEMBER: () =>
    createMockTRPCContext({
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      userId: SEED_TEST_IDS.USERS.MEMBER1,
      userRole: "member",
    }),

  COMPETITOR: () =>
    createMockTRPCContext({
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor,
      userId: SEED_TEST_IDS.USERS.COMPETITOR_ADMIN,
      userRole: "admin",
    }),
} as const;
```

### Fix 2: Mock Database Factory

**File**: `src/test/mocks/database-mocks.ts`

```typescript
import { vi } from "vitest";
import { SEED_TEST_IDS } from "../constants/seed-test-ids";

/**
 * Creates a mock database with organizational scoping
 * Returns mock data filtered by organizationId
 */
export function createMockDatabase(organizationId: string) {
  // Mock data scoped to organization
  const mockIssues = [
    {
      id: SEED_TEST_IDS.ISSUES.ISSUE_1,
      title: "Test Issue 1",
      organizationId,
      machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: SEED_TEST_IDS.ISSUES.ISSUE_2,
      title: "Test Issue 2",
      organizationId,
      machineId: SEED_TEST_IDS.MACHINES.ATTACK_FROM_MARS_1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockMachines = [
    {
      id: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      name: "Medieval Madness #001",
      organizationId,
      locationId: SEED_TEST_IDS.LOCATIONS.LOCATION_1,
      modelId: SEED_TEST_IDS.MODELS.MEDIEVAL_MADNESS,
    },
  ];

  return {
    query: {
      issues: {
        findMany: vi.fn().mockImplementation(async (options = {}) => {
          let results = [...mockIssues];

          // Apply where filters
          if (options.where) {
            // Simulate organizational scoping
            if (options.where.organizationId) {
              results = results.filter(
                (item) => item.organizationId === options.where.organizationId,
              );
            }
          }

          return results;
        }),

        findFirst: vi.fn().mockImplementation(async (options = {}) => {
          const results = await this.query.issues.findMany(options);
          return results[0] || null;
        }),

        count: vi.fn().mockImplementation(async (options = {}) => {
          const results = await this.query.issues.findMany(options);
          return results.length;
        }),
      },

      machines: {
        findMany: vi.fn().mockResolvedValue(mockMachines),
        findFirst: vi.fn().mockResolvedValue(mockMachines[0]),
        count: vi.fn().mockResolvedValue(mockMachines.length),
      },

      // Add other tables as needed...
    },

    insert: vi.fn().mockImplementation((table) => ({
      values: vi.fn().mockImplementation((data) => ({
        returning: vi.fn().mockImplementation(() => {
          // Return mock created data with IDs
          if (Array.isArray(data)) {
            return data.map((item, index) => ({
              ...item,
              id: `mock-${table.name}-${index}`,
              createdAt: new Date(),
              updatedAt: new Date(),
            }));
          }
          return [
            {
              ...data,
              id: `mock-${table.name}-1`,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ];
        }),
      })),
    })),

    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => ({
          returning: vi.fn().mockResolvedValue([
            {
              id: "mock-updated",
              updatedAt: new Date(),
            },
          ]),
        })),
      })),
    })),

    delete: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation(() => ({
        returning: vi.fn().mockResolvedValue([
          {
            id: "mock-deleted",
          },
        ]),
      })),
    })),
  };
}
```

### Fix 3: Standard Router Test Pattern

**Pattern**: Apply this to ALL 126 failing router tests

```typescript
import { describe, test, expect, beforeEach } from "vitest";
import { createMockTRPCContext } from "~/test/vitestMockContext";
import { appRouter } from "~/server/api/root";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

describe("Issue Router", () => {
  let mockContext: ReturnType<typeof createMockTRPCContext>;
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    // Create fresh mock context for each test
    mockContext = createMockTRPCContext({
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      userId: SEED_TEST_IDS.USERS.ADMIN,
      userRole: "admin",
    });

    // Create tRPC caller with mock context
    caller = appRouter.createCaller(mockContext);
  });

  test("getAll procedure returns org-scoped issues", async () => {
    // Setup specific mock response for this test
    mockContext.db.query.issues.findMany.mockResolvedValueOnce([
      {
        id: SEED_TEST_IDS.ISSUES.ISSUE_1,
        title: "Test Issue",
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      },
    ]);

    const result = await caller.issues.getAll();

    expect(result).toHaveLength(1);
    expect(result[0].organizationId).toBe(SEED_TEST_IDS.ORGANIZATIONS.primary);
    expect(mockContext.db.query.issues.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      }),
    });
  });

  test("create procedure validates permissions", async () => {
    const issueData = {
      title: "New Issue",
      machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      description: "Test description",
    };

    await caller.issues.create(issueData);

    expect(mockContext.db.insert).toHaveBeenCalled();
    // Verify organizational context is added
    const insertCall = mockContext.db.insert.mock.calls[0];
    const valuesCall = insertCall[0].values.mock.calls[0];
    expect(valuesCall[0]).toMatchObject({
      ...issueData,
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      createdBy: SEED_TEST_IDS.USERS.ADMIN,
    });
  });
});
```

### Fix 4: Testing Boundary Clarification

**Decision Matrix**: Clarify which files should be router tests vs integration tests

```typescript
// ✅ ROUTER TEST (use mocks): src/server/api/routers/__tests__/issue.test.ts
describe("Issue Router Unit Tests", () => {
  // Tests router logic with mocked database
  // Validates input/output, permissions, organizational scoping
  // Fast execution, no real database
});

// ✅ INTEGRATION TEST: src/integration-tests/issue.router.integration.test.ts
describe("Issue Router Integration Tests", () => {
  // Tests router + real database with RLS context
  // Uses withIsolatedTest + withRLSContext patterns
  // Validates end-to-end workflow
});

// ❌ MIXED CONCERNS (needs separation):
// src/server/api/routers/__tests__/issue.comment.router.integration.test.ts
// Either move to integration-tests/ or convert to pure router test
```

### Fix 5: File-Specific Fixes

**Example**: `src/server/api/routers/__tests__/issue.confirmation.test.ts`

```typescript
// BEFORE: 18/18 tests failing with "Cannot read properties of undefined (reading 'create')"

describe("Issue Confirmation Workflow (RLS-Enhanced)", () => {
  let mockContext: ReturnType<typeof createMockTRPCContext>;
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    mockContext = createMockTRPCContext();
    caller = appRouter.createCaller(mockContext);
  });

  test("should create unconfirmed issues with basic form", async () => {
    // ✅ NOW HAS MOCK DATABASE
    const issueData = {
      title: "Unconfirmed Issue",
      machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      confirmed: false,
    };

    await caller.issues.createBasicForm(issueData);

    expect(mockContext.db.insert).toHaveBeenCalled();
    expect(
      mockContext.db.insert.mock.calls[0][0].values.mock.calls[0][0],
    ).toMatchObject({
      ...issueData,
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    });
  });
});
```

## Success Criteria

### Quantitative Success:

- [ ] **126/126 router tests** pass with proper mock context
- [ ] **"Cannot read properties of undefined (reading 'create')"** errors eliminated
- [ ] **All CRUD operations** (create, read, update, delete, count) mocked correctly
- [ ] **No mixing of integration and router test concerns**

### Qualitative Success:

- [ ] **Consistent mocking pattern** across all router tests
- [ ] **Organizational scoping** simulated in mock database
- [ ] **SEED_TEST_IDS standardization** for all mock data
- [ ] **Clear separation** between router tests (mocked) and integration tests (real DB)

### Per-File Success Metrics:

- [ ] `issue.test.ts`: 23/27 → 0/27 failures
- [ ] `issue.confirmation.test.ts`: 18/18 → 0/18 failures
- [ ] `issue.comment.test.ts`: 14/22 → 0/22 failures
- [ ] `issue.timeline.test.ts`: 7/13 → 0/13 failures
- [ ] `model.core.test.ts`: 11/11 → 0/11 failures
- [ ] All other router test files reaching 0 failures

## Implementation Strategy

### Day 1: Mock Infrastructure

1. **Create `createMockTRPCContext` factory** with organizational scoping
2. **Create `createMockDatabase` utility** with CRUD operations
3. **Test pattern on 2-3 router files** to validate approach

### Day 2: High-Impact Files

1. **Apply pattern to highest failure counts**: issue.confirmation.test.ts (18 failures), model.core.test.ts (11 failures)
2. **Validate organizational scoping** works correctly in mocks
3. **Document any edge cases** or special requirements

### Day 3: Systematic Application & Cleanup

1. **Apply pattern to remaining router test files**
2. **Resolve testing boundary confusion** (router.integration.test.ts files)
3. **Verify all 126 router tests passing**

## Validation Commands

```bash
# Test specific router files
npm run test src/server/api/routers/__tests__/issue.test.ts
npm run test src/server/api/routers/__tests__/issue.confirmation.test.ts
npm run test src/server/api/routers/__tests__/model.core.test.ts

# Test all router tests
npm run test src/server/api/routers/__tests__/

# Verify no integration test mixing
npm run test -- --reporter=verbose | grep "router.integration"
```

## Dependencies

**Depends on**:

- **TASK_002** (permission system) - Mock context needs functional permission checks
- **TASK_003** (RLS context) - Understanding RLS patterns helps design proper mocks

**Blocks**:

- **API development** - Router tests must work for API development
- **Feature development** - New features need testable router patterns

## Unknown Areas Requiring Investigation

1. **Permission System Integration**: How should mock context simulate hasPermission/requirePermission?
2. **Complex Query Mocking**: How to mock relational queries with `with` clauses?
3. **Error Simulation**: How should mocks simulate database errors and edge cases?
4. **Performance**: Do comprehensive mocks impact test performance significantly?

## Related Documentation

- **ARCHETYPE_5_TRPC_ROUTER.md**: Complete analysis of router test failures
- **TASK_003**: RLS context patterns that inform mock design
- **SEED_TEST_IDS**: Consistent test data constants for mocking
- **Testing architecture**: Integration vs unit test separation principles

## Notes for Agent

This is the **second-highest impact fix pattern** after RLS context establishment. tRPC router tests are essential for:

- **API development workflow** - Developers need fast feedback on router logic
- **Business logic validation** - Routers contain critical business rules
- **Permission testing** - API-level security depends on router tests
- **Regression prevention** - Router tests catch breaking changes

**Key principles**:

1. **Router tests should be fast** - Use mocks, not real database
2. **Mock organizational scoping** - Simulate multi-tenant behavior
3. **Test business logic, not database** - Focus on router-specific concerns
4. **Separate from integration tests** - Clear boundary between unit and integration

**Success metric**: When complete, all API routes will have fast, reliable unit tests that catch business logic errors without database dependencies.

**Testing philosophy**: Router tests validate that the right database operations are called with the right parameters. Integration tests validate that those operations work correctly with the real database.
