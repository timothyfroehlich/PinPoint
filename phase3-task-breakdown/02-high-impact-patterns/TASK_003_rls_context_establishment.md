# TASK 003: RLS Context Establishment Pattern

## ⚡ PRIORITY: HIGH - BLOCKS ALL DATABASE OPERATIONS

**Status**: HIGH IMPACT - 154 integration tests failing due to missing RLS session context  
**Impact**: All database operations blocked, integration testing non-functional  
**Agent Type**: integration-test-architect  
**Estimated Effort**: 2-3 days  
**Dependencies**: TASK_001, TASK_002 (critical security fixes should be completed first)

## Objective

Fix the systematic pattern where integration tests fail because they don't establish proper PostgreSQL session context for Row-Level Security (RLS). This affects 154 tests across multiple integration test files - the largest single fix pattern in the entire project.

## Scope

**Total Impact**: 154/371 failing tests (41.5% of all test failures)

### Primary Affected Files:

- `src/integration-tests/comment.integration.test.ts` - **12/13 tests failing**
- `src/integration-tests/machine.owner.integration.test.ts` - **19/19 tests failing**
- `src/integration-tests/machine.location.integration.test.ts` - **17/17 tests failing**
- `src/integration-tests/location.crud.integration.test.ts` - **14/14 tests failing**
- `src/integration-tests/admin.integration.test.ts` - **11/11 tests failing**
- `src/integration-tests/role.integration.test.ts` - **32/32 tests failing**
- `src/integration-tests/pinballMap.integration.test.ts` - **12/12 tests failing**
- `src/integration-tests/model.core.integration.test.ts` - **15/16 tests failing**
- `src/integration-tests/notification.schema.test.ts` - **3/5 tests failing**
- `src/integration-tests/location.integration.test.ts` - **5/6 tests failing**
- `src/integration-tests/location.services.integration.test.ts` - **5/5 tests failing**
- `src/integration-tests/issue.timeline.integration.test.ts` - **5/10 tests failing**
- `src/server/api/routers/__tests__/issue.test.ts` - **10+ tests with RLS context issues**

### Pattern Recognition Files:

- `src/test/helpers/worker-scoped-db.ts` - **Memory-safe database pattern (✅ working correctly)**
- `src/test/helpers/rls-test-context.ts` - **RLS context helper (needs fixes)**

## Error Patterns

### Pattern 1: Permission Denied (Most Common - 90%+ of failures)

```
❌ ERROR: You don't have permission to access this organization
Found in: comment.integration.test.ts, machine.owner.integration.test.ts,
         location.crud.integration.test.ts, admin.integration.test.ts, etc.
```

**Translation**: Database operations are being blocked because no organizational session context is established.

### Pattern 2: Empty Result Arrays (Data Access Blocked)

```
❌ ERROR: expected [] to have a length of 2 but got +0
❌ ERROR: expected [] to have a length of 1 but got +0
Found in: comment.integration.test.ts, machine.location.integration.test.ts
```

**Translation**: Queries return empty arrays because RLS policies block data access without proper context.

### Pattern 3: Missing Seeded Users

```
❌ ERROR: User not found in seeded data: test-user-tim
❌ ERROR: Seeded admin user not found
❌ ERROR: Missing seeded test users
Found in: location.crud.integration.test.ts, model.core.integration.test.ts
```

**Translation**: Tests can't find expected seeded users, likely because organizational context isn't set.

### Pattern 4: Mixed Mock/Integration Issues

```
❌ ERROR: vi.mocked(...).mockReturnValue is not a function
Found in: issue.timeline.integration.test.ts
```

**Translation**: Some tests are mixing integration patterns with mock patterns, causing confusion.

## Root Cause Analysis

### 1. **Missing Session Variable Setup**

Integration tests are not establishing the required PostgreSQL session context:

```sql
-- MISSING: These session variables must be set before database operations
SET app.current_organization_id = 'test-org-pinpoint';
SET app.current_user_id = 'test-user-tim';
SET app.current_user_role = 'admin';
```

### 2. **Inconsistent RLS Context Helper Usage**

The `withRLSContext` helper exists but is not being used consistently across integration tests, or is not working correctly.

### 3. **Test Pattern Confusion**

Some tests are mixing integration testing (real database) with unit testing (mocked database) approaches.

### 4. **Seeded Data Access Issues**

Tests expect to find seeded users and data, but without proper organizational context, the data is invisible.

## Requirements

### Phase 1: Fix RLS Context Helper (Day 1)

1. **Verify and enhance** `withRLSContext` helper functionality
2. **Create standardized pattern** for RLS context establishment in integration tests
3. **Test the helper** works correctly with worker-scoped database

### Phase 2: Apply Pattern Systematically (Days 2-3)

1. **Update all 154 integration tests** to use proper RLS context establishment
2. **Standardize organizational scoping** using SEED_TEST_IDS constants
3. **Fix seeded data access** by ensuring proper organizational context
4. **Separate mixed concerns** where tests combine mocking and integration

## Technical Specifications

### Fix 1: Enhanced RLS Context Helper

**File**: `src/test/helpers/rls-test-context.ts`

```typescript
import { sql } from "drizzle-orm";
import { TestDatabase } from "./worker-scoped-db";
import { SEED_TEST_IDS } from "../constants/seed-test-ids";

/**
 * Establishes RLS context for integration tests
 * CRITICAL: This must be called before any database operations in integration tests
 */
export async function withRLSContext<T>(
  db: TestDatabase,
  context: {
    organizationId: string;
    userId: string;
    userRole: "admin" | "member" | "guest";
  },
  callback: (db: TestDatabase) => Promise<T>,
): Promise<T> {
  try {
    // Set PostgreSQL session context for RLS
    await db.execute(
      sql`SET app.current_organization_id = ${context.organizationId}`,
    );
    await db.execute(sql`SET app.current_user_id = ${context.userId}`);
    await db.execute(sql`SET app.current_user_role = ${context.userRole}`);

    // Verify context was set (critical for debugging)
    const verification = await db.execute(sql`
      SELECT 
        current_setting('app.current_organization_id', true) as org_id,
        current_setting('app.current_user_id', true) as user_id,
        current_setting('app.current_user_role', true) as user_role
    `);

    const row = verification.rows[0];
    if (row?.org_id !== context.organizationId) {
      throw new Error(
        `Failed to set organizational context: expected ${context.organizationId}, got ${row?.org_id}`,
      );
    }

    // Execute the callback with proper context
    return await callback(db);
  } finally {
    // CRITICAL: Clean up context to prevent test interference
    await db.execute(sql`RESET app.current_organization_id`);
    await db.execute(sql`RESET app.current_user_id`);
    await db.execute(sql`RESET app.current_user_role`);
  }
}

/**
 * Convenience helper for admin context (most common pattern)
 */
export async function withAdminContext<T>(
  db: TestDatabase,
  callback: (db: TestDatabase) => Promise<T>,
): Promise<T> {
  return withRLSContext(
    db,
    {
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      userId: SEED_TEST_IDS.USERS.ADMIN,
      userRole: "admin",
    },
    callback,
  );
}

/**
 * Convenience helper for member context
 */
export async function withMemberContext<T>(
  db: TestDatabase,
  callback: (db: TestDatabase) => Promise<T>,
): Promise<T> {
  return withRLSContext(
    db,
    {
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      userId: SEED_TEST_IDS.USERS.MEMBER1,
      userRole: "member",
    },
    callback,
  );
}
```

### Fix 2: Standard Integration Test Pattern

**Pattern**: Apply this to ALL 154 failing integration tests

```typescript
import { test } from "~/test/helpers/worker-scoped-db";
import { withAdminContext } from "~/test/helpers/rls-test-context";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

// BEFORE (BROKEN PATTERN):
test("some database operation", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // ❌ NO RLS CONTEXT - Operation fails with "You don't have permission"
    const result = await db.query.issues.findMany();
    expect(result).toHaveLength(2);
  });
});

// AFTER (FIXED PATTERN):
test("some database operation", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // ✅ WITH RLS CONTEXT - Operation succeeds
    await withAdminContext(db, async (db) => {
      const result = await db.query.issues.findMany();
      expect(result).toHaveLength(2);
    });
  });
});
```

### Fix 3: Organizational Scoping Standardization

**Pattern**: Ensure all tests use SEED_TEST_IDS for predictable organizational context

```typescript
// APPLY to all integration tests
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

test("cross-organizational test", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Test with primary organization
    await withRLSContext(
      db,
      {
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary, // "test-org-pinpoint"
        userId: SEED_TEST_IDS.USERS.ADMIN, // "test-user-tim"
        userRole: "admin",
      },
      async (db) => {
        const primaryOrgData = await db.query.issues.findMany();
        // Should only see primary org data
      },
    );

    // Test with competitor organization
    await withRLSContext(
      db,
      {
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor, // "test-org-competitor"
        userId: SEED_TEST_IDS.USERS.COMPETITOR_ADMIN, // "test-user-competitor-admin"
        userRole: "admin",
      },
      async (db) => {
        const competitorOrgData = await db.query.issues.findMany();
        // Should only see competitor org data
      },
    );
  });
});
```

### Fix 4: Mixed Concerns Separation

**File**: `src/integration-tests/issue.timeline.integration.test.ts`

```typescript
// SEPARATE: Mock patterns from integration patterns

// IF testing router logic with mocks (Unit test):
test("timeline router logic", async () => {
  const mockService = vi.mocked(IssueActivityService);
  mockService.getIssueTimeline.mockResolvedValue(mockTimelineData);

  const result = await timelineRouter.getTimeline({ issueId: "test-issue" });
  expect(mockService.getIssueTimeline).toHaveBeenCalled();
});

// IF testing real database operations (Integration test):
test("timeline database operations", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    await withAdminContext(db, async (db) => {
      // Real database operation - no mocking
      const timeline = await getIssueTimelineFromDatabase(db, "test-issue");
      expect(timeline).toBeDefined();
    });
  });
});
```

### Fix 5: File-by-File Application

**Example**: `src/integration-tests/comment.integration.test.ts`

```typescript
// CURRENT: 12/13 tests failing with "You don't have permission"
test("should get comments for an issue with author info", async ({
  workerDb,
}) => {
  await withIsolatedTest(workerDb, async (db) => {
    // ❌ BROKEN: No RLS context
    const comments = await db.query.comments.findMany({
      where: eq(comments.issueId, SEED_TEST_IDS.ISSUES.ISSUE_1),
    });
    expect(comments).toHaveLength(2); // FAILS: gets 0, expects 2
  });
});

// FIXED: Add RLS context establishment
test("should get comments for an issue with author info", async ({
  workerDb,
}) => {
  await withIsolatedTest(workerDb, async (db) => {
    // ✅ FIXED: With RLS context
    await withAdminContext(db, async (db) => {
      const comments = await db.query.comments.findMany({
        where: eq(comments.issueId, SEED_TEST_IDS.ISSUES.ISSUE_1),
      });
      expect(comments).toHaveLength(2); // PASSES: gets 2, expects 2
    });
  });
});
```

## Success Criteria

### Quantitative Success:

- [ ] **154/154 integration tests** pass with proper RLS context
- [ ] **"You don't have permission to access this organization"** errors eliminated
- [ ] **"expected [] to have a length of 2 but got +0"** errors fixed
- [ ] **"Seeded admin user not found"** errors resolved

### Qualitative Success:

- [ ] **Consistent pattern** applied across all integration tests
- [ ] **SEED_TEST_IDS standardization** for organizational context
- [ ] **Clear separation** between integration tests (real DB) and unit tests (mocked)
- [ ] **Memory-safe patterns maintained** (worker-scoped database preserved)

### Per-File Success Metrics:

- [ ] `comment.integration.test.ts`: 12/13 → 0/13 failures
- [ ] `machine.owner.integration.test.ts`: 19/19 → 0/19 failures
- [ ] `machine.location.integration.test.ts`: 17/17 → 0/17 failures
- [ ] `location.crud.integration.test.ts`: 14/14 → 0/14 failures
- [ ] `admin.integration.test.ts`: 11/11 → 0/11 failures
- [ ] `role.integration.test.ts`: 32/32 → 0/32 failures
- [ ] And all other affected files reaching 0 failures

## Implementation Strategy

### Day 1: Foundation

1. **Enhance RLS context helper** with verification and debugging
2. **Create convenience helpers** (withAdminContext, withMemberContext)
3. **Test the pattern** on 2-3 files to verify it works

### Day 2: High-Impact Files

1. **Apply pattern to largest failure counts**: role.integration.test.ts (32 failures), machine.owner.integration.test.ts (19 failures)
2. **Validate pattern is working** correctly
3. **Document any special cases** or adjustments needed

### Day 3: Systematic Application

1. **Apply pattern to remaining 12+ files** with RLS context issues
2. **Fix mixed concerns** in timeline integration tests
3. **Verify all 154 tests are now passing**

## Validation Commands

```bash
# Test specific integration files
npm run test src/integration-tests/comment.integration.test.ts
npm run test src/integration-tests/machine.owner.integration.test.ts
npm run test src/integration-tests/admin.integration.test.ts

# Test all integration tests
npm run test src/integration-tests/

# Test mixed pattern files
npm run test src/integration-tests/issue.timeline.integration.test.ts

# Verify memory safety maintained
npm run test -- --reporter=verbose | grep "Creating shared PGlite instance"
```

## Dependencies

**Depends on**:

- **TASK_001** (cross-org data leakage) - RLS policies must work correctly
- **TASK_002** (permission system) - Some tests may depend on functional permissions

**Blocks**:

- **TASK_004** (tRPC router mocks) - Some router integration tests need RLS context
- **TASK_006** (service layer mocks) - Service integration may depend on RLS context

## Unknown Areas Requiring Investigation

1. **RLS Policy Verification**: Which RLS policies are actually implemented and working?
2. **Seeded Data Verification**: Is the seeded test data actually present and correctly scoped?
3. **Performance Impact**: Does adding RLS context establishment impact test performance?
4. **Edge Cases**: Are there tests that legitimately should NOT have organizational context?

## Related Documentation

- **ARCHETYPE_3_PGLITE_INTEGRATION.md**: Complete analysis of integration test failures
- **worker-scoped-db.ts**: Memory-safe database pattern (working correctly)
- **SEED_TEST_IDS constants**: Hardcoded test data for organizational scoping
- **Phase 3.3 lessons learned**: RLS context establishment patterns

## Notes for Agent

This is the **highest-impact single fix pattern** in the entire project. Successfully applying RLS context establishment will resolve **41.5% of all test failures**.

**Key principles**:

1. **Every integration test** accessing the database needs RLS context
2. **Use SEED_TEST_IDS** for consistent organizational scoping
3. **Preserve memory-safe patterns** (worker-scoped database is working correctly)
4. **Separate concerns** clearly (integration vs unit tests)

**Testing strategy**: Fix a few files first to validate the pattern works, then apply systematically. The pattern should be consistent across all files once proven.

**Success metric**: When this task is complete, the majority of failing integration tests should pass, and the project should have a clear, consistent pattern for integration testing with RLS context.
