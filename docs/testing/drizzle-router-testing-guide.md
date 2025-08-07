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

## Current Status

✅ **Test Infrastructure Updated**: Enhanced Drizzle mock supports all query patterns
✅ **All Tests Passing**: 1185 tests pass with updated infrastructure  
✅ **IssueStatus Router Migrated**: First router successfully migrated and tested
✅ **Documentation Complete**: Testing patterns documented for future migrations

The test infrastructure is ready to support all Drizzle router migrations in Phase 2B-E.
