# Integration Test Auth Context Failures - Use Seed Data Solution

## Issue Summary

Integration tests are failing with auth context errors due to incomplete test data setup. Tests create mock tRPC contexts but real tRPC middleware still validates against the database, finding incomplete/missing permission structures.

**Status:** 308 failing tests, ~95% auth-related  
**Impact:** Blocks test-driven development and CI validation  
**Root Cause:** Mismatch between mock contexts and real auth middleware expectations

## Problem Analysis

### Primary Issue: Missing Role Permissions Structure

The `organizationProcedure` middleware expects complete permission structures:

```typescript
// tRPC middleware expects this structure
const membership = await ctx.db.query.memberships.findFirst({
  with: {
    role: {
      with: {
        rolePermissions: {  // ← Integration tests missing this!
          with: {
            permission: true,
          },
        },
      },
    },
  },
});
```

**Current test setup creates:**
- ✅ Users, Organizations, Roles, Memberships  
- ❌ **Missing: permissions table records**
- ❌ **Missing: rolePermissions junction table records**

### Secondary Issue: Schema Bug

```typescript
// src/server/services/commentCleanupService.ts:106
await this.db.query.comments.findMany({
  where: and(
    isNotNull(comments.deletedAt),
    eq(issues.organizationId, organizationId), // ← BUG: issues table not joined!
  ),
```

Error: `column comments.organizationId does not exist`

### Core Architecture Mismatch

```typescript
// Tests create mock contexts
const context: TRPCContext = {
  user: { id: "fake-user-id" }, // ← Doesn't exist in DB
  organization: { id: "fake-org-id" },
  // ...
};

// But procedures run real middleware that queries DB
const membership = await ctx.db.query.memberships.findFirst({
  where: and(
    eq(memberships.organizationId, organization.id),
    eq(memberships.userId, ctx.user.id), // ← Fails: no such user
  ),
});
```

## Current Failure Patterns

### Auth Context Failures (95% of issues)
```
TRPCError: You don't have permission to access this organization
❯ src/server/api/trpc.base.ts:335:13
```

**Affects:** admin.integration.test.ts, issue.timeline.integration.test.ts, location.integration.test.ts, machine.*.integration.test.ts, etc.

### Schema Errors (Specific cases)
```
error: column comments.organizationId does not exist
❯ CommentCleanupService.getDeletedComments
```

**Affects:** comment.integration.test.ts procedures using CommentCleanupService

### Tests Using Seed Data Status

✅ **Working:** `role.integration.test.ts`, some in `comment.integration.test.ts`  
❌ **Failing:** Most other integration tests with manual setup

## Proposed Solution: Standardize on Seed Data

### Architecture Overview

**Current Broken Flow:**
```
Manual Test Setup → Mock Context → Real tRPC Middleware → Database Query Fails
```

**Proposed Working Flow:**
```
Seed Data Setup → Real User Context → Real tRPC Middleware → Database Query Succeeds
```

### Implementation Plan

#### 1. Use `createSeededTestDatabase()` for All Integration Tests

```typescript
// ✅ Replace manual setup with seed data
test("should work with auth", async ({ workerDb, organizationId }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Get real seeded data
    const testData = await getSeededTestData(db, organizationId);
    
    // Create context with REAL user ID that exists in DB
    const context = {
      user: {
        id: testData.user, // ← Real seeded user with membership + permissions
        email: "admin@dev.local",
        user_metadata: { name: "Dev Admin" },
        app_metadata: { organization_id: organizationId, role: "Admin" },
      },
      organization: { 
        id: organizationId, // ← Real seeded org
        name: "Test Organization",
        subdomain: "test-org",
      },
      db,
      // ... rest of context
    };
    
    const caller = router.createCaller(context);
    // ← Now middleware finds valid membership with complete permissions!
  });
});
```

#### 2. Seed Data Provides Complete Infrastructure

```typescript
// What createSeededTestDatabase() provides:
✅ organizations (with real IDs)
✅ permissions (ALL_PERMISSIONS from constants)  
✅ roles (ROLE_TEMPLATES with permission mappings)
✅ rolePermissions (junction table records)
✅ users (real users with proper IDs)
✅ memberships (linking users to orgs with roles)
✅ sample data (issues, machines, locations, etc.)
```

#### 3. Benefits of Seed Data Approach

**Fixes Auth Issues:**
- ✅ Real users exist in database
- ✅ Complete permission structures (rolePermissions)
- ✅ Valid memberships link users to organizations
- ✅ tRPC middleware finds expected data

**Improves Test Quality:**
- ✅ Production-identical data structure
- ✅ Tests realistic scenarios
- ✅ Reduced boilerplate (no manual user/role creation)
- ✅ Consistent across all tests

**Performance & Reliability:**
- ✅ PGlite in-memory (fast)
- ✅ Transaction isolation (clean)
- ✅ Worker-scoped (memory-safe)
- ✅ Mock Supabase (no external deps)

### Perfect Integration Stack

```
PGlite (in-memory PostgreSQL)
↓
Seed Data (production functions)
↓  
Real User Contexts (actual DB records)
↓
tRPC Middleware (finds valid memberships)
↓
Mock Supabase Auth (no external deps)
```

## Implementation Tasks

### Phase 1: Fix Schema Bugs
- [ ] Fix `CommentCleanupService.getDeletedComments()` query
- [ ] Audit other services for similar schema issues

### Phase 2: Convert High-Impact Tests
- [ ] `admin.integration.test.ts` → Use seed data
- [ ] `issue.timeline.integration.test.ts` → Use seed data  
- [ ] `location.integration.test.ts` → Use seed data
- [ ] `machine.*.integration.test.ts` → Use seed data

### Phase 3: Standardize Pattern
- [ ] Create helper function for seeded test contexts
- [ ] Document pattern in testing guide
- [ ] Convert remaining integration tests
- [ ] Add eslint rule to prefer seed data for integration tests

### Phase 4: Validation
- [ ] Run full test suite - target 0 auth failures
- [ ] Performance check - ensure no regression
- [ ] Update CI expectations

## Code Examples

### Helper Function Pattern

```typescript
// src/test/helpers/seeded-context.ts
export async function createSeededTestContext(
  db: TestDatabase, 
  organizationId: string,
  userType: "admin" | "member" = "admin"
) {
  const testData = await getSeededTestData(db, organizationId);
  
  const userId = userType === "admin" ? "test-user-admin" : "test-user-member";
  
  return {
    user: {
      id: userId,
      email: userType === "admin" ? "admin@dev.local" : "member@dev.local", 
      user_metadata: { name: userType === "admin" ? "Dev Admin" : "Dev Member" },
      app_metadata: { organization_id: organizationId, role: userType === "admin" ? "Admin" : "Member" },
    },
    organization: {
      id: organizationId,
      name: "Test Organization", 
      subdomain: "test-org",
    },
    db,
    supabase: {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as any,
    // ... other context properties
  };
}
```

### Usage Pattern

```typescript
// Integration test pattern
test("should work with proper auth", async ({ workerDb, organizationId }) => {
  await withIsolatedTest(workerDb, async (db) => {
    const context = await createSeededTestContext(db, organizationId, "admin");
    const caller = router.createCaller(context);
    
    // ← Now this works because middleware finds real user + permissions!
    const result = await caller.someProtectedProcedure();
    expect(result).toBeDefined();
  });
});
```

## Success Criteria

- [ ] **Zero auth context failures** in integration tests
- [ ] **Consistent seed data usage** across all integration tests  
- [ ] **Performance maintained** - no significant test slowdown
- [ ] **Documentation updated** - clear patterns for new tests

## Related Files

**Key Files to Update:**
- `src/integration-tests/admin.integration.test.ts`
- `src/integration-tests/issue.timeline.integration.test.ts` 
- `src/integration-tests/location.integration.test.ts`
- `src/integration-tests/machine.*.integration.test.ts`
- `src/server/services/commentCleanupService.ts`

**Reference Examples:**
- `src/integration-tests/role.integration.test.ts` (working with seed data)
- `src/integration-tests/comment.integration.test.ts` (mixed pattern)

**Infrastructure:**
- `src/test/helpers/pglite-test-setup.ts` (seed data functions)
- `src/test/helpers/worker-scoped-db.ts` (PGlite integration)
- `scripts/seed/shared/infrastructure.ts` (permission/role creation)

---

**Priority:** High - Blocking test development and CI validation  
**Effort:** Medium - Clear path with existing infrastructure  
**Risk:** Low - Seed data approach already working in some tests