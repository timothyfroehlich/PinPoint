# Permission Testing Migration Guide

This guide shows how to migrate existing router tests to use the new permission testing utilities for reduced duplication and improved consistency.

## Migration Strategy

### Phase 1: Identify Duplication Patterns

Look for these patterns in existing router tests:

```typescript
// 🔍 IDENTIFY: Authentication requirement tests
it("should require authentication", async () => {
  const caller = appRouter.createCaller({ ...ctx, user: null } as any);
  await expect(caller.someRouter.someProcedure(input)).rejects.toThrow(
    "UNAUTHORIZED",
  );
});

// 🔍 IDENTIFY: Permission requirement tests
it("should require specific permission", async () => {
  const contextWithoutPermission = createAuthenticatedContext([
    "other:permission",
  ]);
  const caller = appRouter.createCaller(contextWithoutPermission as any);
  await expect(caller.someRouter.someProcedure(input)).rejects.toThrow(
    "FORBIDDEN",
  );
});

// 🔍 IDENTIFY: Repetitive context setup
beforeEach(() => {
  ctx.user = {
    /* 10+ lines of user setup */
  };
  ctx.organization = {
    /* organization setup */
  };
  const mockMembership = {
    /* membership setup */
  };
  // More boilerplate...
});

// 🔍 IDENTIFY: Service integration boilerplate
const mockService = {
  someMethod: vi.fn().mockResolvedValue(mockResult),
};
vi.mocked(ctx.services.createSomeService).mockReturnValue(mockService);
```

### Phase 2: Replace with Utilities

Replace identified patterns with new utilities:

```typescript
// ✅ REPLACE: Authentication tests (10+ lines → 3 lines)
it(
  "requires authentication",
  PermissionTests.requiresAuth(
    (caller) => caller.someRouter.someProcedure(input),
    appRouter,
  ),
);

// ✅ REPLACE: Permission tests (15+ lines → 3 lines)
it(
  "requires specific permission",
  PermissionTests.requiresPermission(
    (caller) => caller.someRouter.someProcedure(input),
    appRouter,
    "required:permission",
  ),
);

// ✅ REPLACE: Context setup (25+ lines → 0 lines)
// Use createAuthenticatedContext() instead of manual setup

// ✅ REPLACE: Service integration (10+ lines → 4 lines)
const { mockService, expectServiceCalled } = testServiceIntegration(
  "createSomeService",
  "someMethod",
  { mockReturnValue: mockResult },
)(context);
```

## File-by-File Migration

### 1. notification.test.ts

**Current Status:** ✅ Example refactored (see `/test/__examples__/notification.router.refactored.test.ts`)

**Key Improvements:**

- 250 lines → 180 lines (28% reduction)
- Eliminated authentication test boilerplate
- Standardized service integration patterns
- Simplified input validation testing

**Migration Steps:**

1. Replace authentication requirement tests with `PermissionTests.requiresAuth`
2. Use `testServiceIntegration` for service mocking
3. Apply `testInputValidation` for validation test cases
4. Use `testAuthenticatedProcedure` for business logic tests

### 2. issue.test.ts

**Current Complexity:** High - 900+ lines with extensive permission testing

**Recommended Approach:**

```typescript
// Before: 50+ lines of createAuthenticatedContext helper
const createAuthenticatedContext = (permissions: string[] = []) => {
  const mockContext = createVitestMockContext();
  // 40+ lines of setup...
  return mockContext;
};

// After: Use built-in utility
import { createAuthenticatedContext } from "~/test/permissionTestHelpers";
```

**Migration Steps:**

1. Remove custom `createAuthenticatedContext` helper (lines 118-200)
2. Replace with imported utility
3. Convert permission test cases to use `createPermissionTestCases`
4. Apply `testOrganizationScoping` for isolation tests
5. Use `PermissionTests.fullSuite` for comprehensive coverage

**Expected Savings:** 300+ lines, 35% reduction

### 3. collection.router.test.ts

**Current Complexity:** Medium - 600+ lines with role-based testing

**Recommended Approach:**

```typescript
// Before: Separate beforeEach blocks for different roles
describe("Protected Procedures", () => {
  beforeEach(() => {
    // 20+ lines of member setup
  });
});

describe("Admin Procedures", () => {
  beforeEach(() => {
    // 25+ lines of admin setup
  });
});

// After: Use role-based contexts
const { adminCaller, authenticatedCaller } = createRouterTestContext(appRouter);
```

**Migration Steps:**

1. Replace role-specific beforeEach blocks with `createRouterTestContext`
2. Use `testAdminOnlyProcedure` for admin procedures
3. Apply `testAuthenticatedProcedure` for member procedures
4. Use `testPublicProcedure` for public procedures

**Expected Savings:** 200+ lines, 30% reduction

### 4. Other Router Tests

**Similar patterns apply to:**

- `machine.owner.test.ts` - Permission boundary testing
- `issue.timeline.test.ts` - Authentication requirements
- `integration.test.ts` - Cross-procedure permission testing

**Common Migration Actions:**

1. Replace manual permission mocking with `PERMISSION_SCENARIOS`
2. Use `expectOrganizationIsolation` for scoping tests
3. Apply `createPermissionTestCases` for systematic permission testing
4. Use `setupPermissionMocks` for database mock setup

## Quick Wins Checklist

For each router test file, look for these quick wins:

### ✅ Authentication Tests

```typescript
// Find this pattern (5-10 occurrences per file)
it("should require authentication", async () => {
  const caller = appRouter.createCaller({ ...ctx, user: null } as any);
  // Replace with:
  it("requires authentication", PermissionTests.requiresAuth(procedureCall, appRouter));
```

### ✅ Permission Tests

```typescript
// Find this pattern (3-5 occurrences per file)
it("should require X permission", async () => {
  // 10+ lines of setup and testing
  // Replace with:
  it("requires X permission", PermissionTests.requiresPermission(procedureCall, appRouter, "x:permission"));
```

### ✅ Context Setup

```typescript
// Find repetitive beforeEach blocks (20+ lines)
beforeEach(() => {
  ctx.user = {
    /* setup */
  };
  ctx.organization = {
    /* setup */
  };
  // Replace with utility calls in individual tests
});
```

### ✅ Service Integration

```typescript
// Find repetitive service mocking (5+ lines per test)
const mockService = { method: vi.fn().mockResolvedValue(result) };
vi.mocked(ctx.services.createService).mockReturnValue(mockService);
// Replace with testServiceIntegration utility
```

## Validation Steps

After migrating each file:

### 1. Run Tests

```bash
npm run test -- --run src/server/api/routers/__tests__/filename.test.ts
```

### 2. Check Coverage

```bash
npm run test:coverage -- src/server/api/routers/__tests__/filename.test.ts
```

### 3. Validate TypeScript

```bash
npm run typecheck:brief
```

### 4. Measure Improvement

- Count lines before/after migration
- Verify all original tests still pass
- Confirm test organization is clearer
- Check that new patterns are consistent

## Expected Results

### Quantitative Improvements

- **25-35% fewer lines** across all router test files
- **70-80% less boilerplate** for permission testing
- **90% elimination** of context setup duplication
- **60% reduction** in service mocking code

### Qualitative Improvements

- **Consistent patterns** across all router tests
- **Faster test development** for new procedures
- **Better error message testing** with standardized expectations
- **Improved maintainability** with centralized utilities
- **Enhanced readability** with declarative test structure

### Test Quality Improvements

- **Complete permission coverage** with standardized test cases
- **Input validation testing** becomes routine instead of optional
- **Organization scoping validation** applied consistently
- **Service integration testing** follows consistent patterns
- **Error propagation testing** built into utilities

## Migration Priority

### High Priority (Immediate Impact)

1. **notification.test.ts** - Simple patterns, clear wins
2. **collection.router.test.ts** - Role-based testing consolidation
3. **issue.test.ts** - Large file with significant duplication

### Medium Priority (Steady Improvement)

4. **machine.owner.test.ts** - Permission boundary testing
5. **issue.timeline.test.ts** - Authentication patterns
6. **integration.test.ts** - Cross-procedure testing

### Low Priority (As Needed)

7. Other router tests as they're modified or new procedures added

## Support and Resources

### Documentation

- **`/test/README.md`** - Comprehensive guide to new utilities
- **`/test/__examples__/`** - Refactored examples for reference
- **`/test/MIGRATION_GUIDE.md`** - This migration guide

### Utilities

- **`/test/permissionTestHelpers.ts`** - Core permission testing utilities
- **`/test/routerTestPatterns.ts`** - Higher-level router testing patterns

### Examples

- **`notification.router.refactored.test.ts`** - Complete refactored example
- **`collection.router.comparison.test.ts`** - Before/after comparison

The migration can be done incrementally - each file migrated independently improves the codebase without breaking existing functionality.
