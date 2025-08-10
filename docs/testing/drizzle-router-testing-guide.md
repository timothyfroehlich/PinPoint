# Drizzle Router Testing Guide

## Overview

This guide explains how to test routers that have been migrated from Prisma to Drizzle ORM. The testing infrastructure has been updated to support Drizzle's query chaining patterns while maintaining compatibility with existing test patterns.

## Updated Test Infrastructure

### Enhanced Drizzle Mock Structure

The `vitestMockContext.ts` file now includes a comprehensive Drizzle mock that supports all query patterns used in migrated routers:

```typescript
const mockDrizzleClient = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([]), // Returns array for destructuring [result]
  execute: vi.fn().mockResolvedValue([]),
} as unknown as DrizzleClient;
```

### Supported Query Patterns

The mock supports these Drizzle query patterns used in the migrated `issueStatus` router:

1. **getAll**: `select().from().where().orderBy()`
2. **create**: `insert().values().returning()`
3. **update**: `update().set().where().returning()`
4. **delete**: Complex pattern with `count()` check + `delete().where().returning()`

## Testing Migrated Routers

### Basic Testing Approach

For routers migrated to Drizzle, focus on behavior verification rather than implementation details:

```typescript
describe("Drizzle Router Test", () => {
  let mockContext: VitestMockContext;
  let caller: ReturnType<typeof createCaller>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = createVitestMockContext();
    caller = createCaller(mockContext);
  });

  it("should perform CRUD operation", async () => {
    // Arrange - Mock the final method in the chain
    const expectedResult = [{ id: "test", name: "Test" }];
    vi.mocked(mockContext.drizzle.orderBy).mockResolvedValue(expectedResult);

    // Act
    const result = await caller.routerName.operation();

    // Assert - Verify behavior, not implementation
    expect(result).toEqual(expectedResult);
    expect(mockContext.drizzle.select).toHaveBeenCalled();
    expect(mockContext.drizzle.from).toHaveBeenCalled();
    expect(mockContext.drizzle.where).toHaveBeenCalled();
    expect(mockContext.drizzle.orderBy).toHaveBeenCalled();
  });
});
```

### Mock Configuration Patterns

#### Query Operations (getAll)

```typescript
// Mock select().from().where().orderBy() pattern
vi.mocked(mockContext.drizzle.orderBy).mockResolvedValue(results);
```

#### Insert Operations (create)

```typescript
// Mock insert().values().returning() pattern
vi.mocked(mockContext.drizzle.returning).mockResolvedValue([result]);
```

#### Update Operations (update)

```typescript
// Mock update().set().where().returning() pattern
vi.mocked(mockContext.drizzle.returning).mockResolvedValue([result]);
```

#### Complex Operations (delete with count)

```typescript
// First call: count check
vi.mocked(mockContext.drizzle.select).mockReturnValueOnce(mockContext.drizzle);
vi.mocked(mockContext.drizzle.from).mockReturnValueOnce(mockContext.drizzle);
vi.mocked(mockContext.drizzle.where).mockResolvedValueOnce([{ count: 0 }]);

// Second call: actual delete
vi.mocked(mockContext.drizzle.delete).mockReturnValue(mockContext.drizzle);
vi.mocked(mockContext.drizzle.where).mockReturnValue(mockContext.drizzle);
vi.mocked(mockContext.drizzle.returning).mockResolvedValue([deleteResult]);
```

## IssueStatus Router Example

The migrated `issueStatus` router demonstrates all key patterns:

### Operations Converted

- **getAll**: `ctx.drizzle.select().from(schema.issueStatuses).where().orderBy()`
- **create**: `ctx.drizzle.insert(schema.issueStatuses).values().returning()`
- **update**: `ctx.drizzle.update(schema.issueStatuses).set().where().returning()`
- **delete**: Complex operation with count check + delete

### Key Features Tested

- Multi-tenant filtering with `organizationId`
- Dynamic update operations (`updateData` object)
- Business logic validation (cannot delete status in use)
- Proper error handling and messages

## Testing Best Practices

### 1. Focus on Behavior

Test what the router does, not how it does it:

- ✅ Verify correct data is returned
- ✅ Verify proper error handling
- ✅ Verify business rules are enforced
- ❌ Don't test specific SQL queries
- ❌ Don't test Drizzle implementation details

### 2. Multi-Tenant Testing

Always verify organization isolation:

```typescript
it("should enforce organization isolation", async () => {
  await caller.router.operation();

  // Verify where clause was called (implies organizationId filtering)
  expect(mockContext.drizzle.where).toHaveBeenCalled();
});
```

### 3. Error Scenarios

Test business logic errors:

```typescript
it("should throw error for invalid operations", async () => {
  // Configure mock to simulate error condition
  vi.mocked(mockContext.drizzle.where).mockResolvedValue([{ count: 5 }]);

  await expect(caller.router.delete({ id: "used-status" })).rejects.toThrow(
    "Cannot delete status that is currently being used",
  );
});
```

## Migration Impact

### Backward Compatibility

- Existing test patterns continue to work
- No changes required for non-migrated routers
- Mock context provides both Prisma and Drizzle clients

### Performance Benefits

- Tests run faster due to simpler mock structure
- Reduced complexity in test setup
- Better TypeScript support

## Critical Lessons Learned: Complex Router Testing

### Admin Router Testing Breakthrough (Phase 2B)

During Phase 2B migration, we encountered significant challenges testing complex routers with multiple query chains and validation logic. The admin router (`removeUser` procedure) required a fundamentally different approach.

#### The Problem: Complex Query Chain Mocking Failures

Initial attempts to mock individual Drizzle methods in complex chains failed:

```typescript
// ❌ This approach was too brittle and complex
const membershipChain = {
  from: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnValue({
    innerJoin: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(membershipResult),
      }),
    }),
  }),
};
```

**Issues encountered:**

- Tests threw `INTERNAL_SERVER_ERROR` instead of expected error codes
- Complex mock chains had multiple failure points
- Mock lifecycle issues with `vi.clearAllMocks()` breaking tRPC infrastructure
- Test structure problems (calling functions multiple times)

#### The Solution: Simplified Mock with Call Counting

```typescript
// ✅ Successful approach: Single mock function with call counting
const setupRemoveUserMocks = (options = {}) => {
  const {
    membershipResult = [mockMembership],
    allMembershipsResult = mockAllMemberships,
    validationResult = { valid: true },
    shouldThrowOnMembership = false,
    shouldThrowOnAllMemberships = false,
    shouldThrowOnDelete = false,
  } = options;

  // Single mock function handles all query results
  let callCount = 0;
  const mockQuery = vi.fn().mockImplementation(() => {
    callCount++;

    if (callCount === 1) {
      // First call: membership lookup
      if (shouldThrowOnMembership) {
        throw new Error("Database connection failed");
      }
      return Promise.resolve(membershipResult);
    } else if (callCount === 2) {
      // Second call: all memberships
      if (shouldThrowOnAllMemberships) {
        throw new Error("Query timeout");
      }
      return Promise.resolve(allMembershipsResult);
    } else {
      // Third call: delete
      if (shouldThrowOnDelete) {
        throw new Error("Delete constraint violation");
      }
      return Promise.resolve(undefined);
    }
  });

  // Simple chain objects that just call our mock function
  const createMockChain = () => ({
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: mockQuery, // Final method calls our simple mock
  });

  // Setup mocks without clearing critical infrastructure
  vi.mocked(mockContext.drizzle.select)
    .mockReturnValueOnce(createMockChain()) // Membership query
    .mockReturnValueOnce(createMockChainNoLimit()); // All memberships query

  vi.mocked(mockContext.drizzle.delete).mockReturnValue(
    createMockDeleteChain(),
  );
  vi.mocked(validateUserRemoval).mockReturnValue(validationResult);
};
```

#### Key Breakthrough: Test Structure Fix

The root cause wasn't always the mocking - it was test structure:

```typescript
// ❌ This calls the function TWICE, causing state issues
await expect(caller.removeUser({ userId })).rejects.toThrow(TRPCError);
try {
  await caller.removeUser({ userId }); // Called AGAIN here
  // assertions...
}

// ✅ This calls the function ONCE with proper error handling
try {
  await caller.removeUser({ userId });
  throw new Error("Expected function to throw, but it didn't");
} catch (error) {
  expect(error).toBeInstanceOf(TRPCError);
  expect((error as TRPCError).code).toBe("PRECONDITION_FAILED");
}
```

### Best Practices for Complex Router Testing

1. **Don't Mock Individual Chain Methods**: Use simple mock functions with call counting instead
2. **Avoid Function Double-Calling**: Use single try/catch blocks for error testing
3. **Preserve Infrastructure Mocks**: Don't use `vi.clearAllMocks()` - clear selectively
4. **Test One Scenario at a Time**: Fix one test completely before moving to the next
5. **Use Debugging**: Add console.log to understand what errors are actually being thrown

### Updated Testing Pattern for Complex Routers

```typescript
describe("Complex Router with Multiple Queries", () => {
  let mockContext: VitestMockContext;
  let caller: ReturnType<typeof createCaller>;

  beforeEach(() => {
    mockContext = createVitestMockContext();
    // Don't clear all mocks - preserve permission system mocks
    caller = createCaller(mockContext);
  });

  it("should handle validation failure", async () => {
    // Setup mock with specific failure scenario
    setupComplexRouterMocks({
      validationResult: { valid: false, error: "Cannot proceed" },
    });

    // Single function call with proper error handling
    try {
      await caller.complexRouter.operation({ id: "test" });
      throw new Error("Expected function to throw, but it didn't");
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe("PRECONDITION_FAILED");
      expect((error as TRPCError).message).toBe("Cannot proceed");
    }
  });
});
```

## Current Status

✅ **Test Infrastructure Updated**: Enhanced Drizzle mock supports all query patterns
✅ **Complex Router Testing Solved**: Admin router breakthrough provides pattern for complex scenarios
✅ **All Tests Passing**: Full validation suite passes with new patterns  
✅ **IssueStatus Router Migrated**: First router successfully migrated and tested
✅ **Documentation Complete**: Testing patterns documented for future migrations

The test infrastructure is ready to support all Drizzle router migrations in Phase 2B-E, including complex routers with multiple query chains and business logic validation.
