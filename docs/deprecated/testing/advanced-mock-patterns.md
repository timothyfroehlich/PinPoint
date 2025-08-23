# Advanced Mock Patterns

This guide documents sophisticated mocking patterns that preserve TypeScript types while allowing selective mocking of deeply nested structures.

## Hoisted Mock Pattern

### Basic Structure

```typescript
import { vi } from "vitest";

// Hoist mocks before module imports
const mocks = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockIssuesQuery: vi.fn(),
  mockStatusQuery: vi.fn(),
  mockLocationsQuery: vi.fn(),
}));

// Mock specific parts while preserving the rest
vi.mock("~/trpc/react", async () => {
  const actual =
    await vi.importActual<typeof import("~/trpc/react")>("~/trpc/react");
  return {
    ...actual,
    api: {
      ...actual.api,
      issue: {
        ...actual.api.issue,
        core: {
          ...actual.api.issue.core,
          getAll: {
            ...actual.api.issue.core.getAll,
            useQuery: mocks.mockIssuesQuery,
          },
        },
      },
    },
  };
});
```

### Benefits

1. **Type Safety**: Preserves TypeScript types throughout the mock chain
2. **Selective Mocking**: Only mock what you need, keep everything else
3. **Hoisting**: Ensures mocks are available before module resolution

## Deep Object Mocking with Type Preservation

### Pattern for Nested API Mocks

```typescript
type DeepMockAPI = {
  issue: {
    core: {
      getAll: { useQuery: typeof mocks.mockIssuesQuery };
      create: { useMutation: typeof mocks.mockCreateMutation };
    };
    status: {
      getAll: { useQuery: typeof mocks.mockStatusQuery };
    };
  };
  location: {
    getAll: { useQuery: typeof mocks.mockLocationsQuery };
  };
};

// Create a type-safe mock preserving the original structure
function createAPIMock(actual: any, overrides: DeepPartial<DeepMockAPI>): any {
  return deepMerge(actual, { api: overrides });
}
```

### Usage in Tests

```typescript
describe("Complex Component", () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup default responses
    mocks.mockIssuesQuery.mockReturnValue({
      data: { issues: [], totalCount: 0 },
      isLoading: false,
      error: null,
    });
  });

  it("handles loading state", () => {
    mocks.mockIssuesQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    // Test loading behavior
  });
});
```

## Service Layer Mocking with Accelerate

### Mock Factory for Prisma with Extensions

```typescript
import type { ExtendedPrismaClient } from "~/server/db";

function createMockPrismaClient(): ExtendedPrismaClient {
  const mockClient = {
    // Standard Prisma operations
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    // Accelerate extension
    $accelerate: {
      invalidate: vi.fn(),
      ttl: vi.fn().mockReturnValue({
        findMany: vi.fn(),
        findUnique: vi.fn(),
      }),
    },
    // Transaction support
    $transaction: vi
      .fn()
      .mockImplementation((callback) => callback(mockClient)),
  } as unknown as ExtendedPrismaClient;

  return mockClient;
}
```

### Testing Services with Mocked Dependencies

```typescript
describe("CollectionService", () => {
  let service: CollectionService;
  let mockPrisma: ExtendedPrismaClient;

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    service = new CollectionService(mockPrisma);
  });

  it("invalidates cache after update", async () => {
    await service.updateCollection("coll-1", { name: "New Name" });

    expect(mockPrisma.$accelerate.invalidate).toHaveBeenCalledWith({
      collection: { id: "coll-1" },
    });
  });
});
```

## Router Testing with Complex Mocks

### Mock Next.js Modules

```typescript
// Must mock before imports to prevent module resolution issues
vi.mock("next/navigation", () => ({
  useRouter: () => mocks.mockRouter,
  usePathname: () => "/test-path",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next-auth", () => ({
  default: vi.fn().mockImplementation(() => ({
    auth: vi.fn(),
    handlers: { GET: vi.fn(), POST: vi.fn() },
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}));
```

### Mock Complex Authentication Flow

```typescript
const createAuthMock = (permissions: string[] = []) => {
  return {
    auth: vi.fn().mockResolvedValue({
      user: createMockSupabaseUser(),
      expires: "2024-12-31",
    }),
    getUserPermissionsForSession: vi.fn().mockResolvedValue(permissions),
    requirePermissionForSession: vi
      .fn()
      .mockImplementation(async (_session, permission) => {
        if (!permissions.includes(permission)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Missing required permission: ${permission}`,
          });
        }
      }),
  };
};
```

## Partial Mocking Pattern

### Keep Original Implementation

```typescript
vi.mock("~/server/auth/permissions", async () => {
  const actual = await vi.importActual("~/server/auth/permissions");
  return {
    ...actual, // Keep all original exports
    // Only override specific functions
    getUserPermissionsForSession: vi.fn(),
    requirePermissionForSession: vi.fn(),
  };
});
```

### Conditional Mocking

```typescript
vi.mock("~/lib/supabase/client", async () => {
  const actual = await vi.importActual("~/lib/supabase/client");

  if (process.env.TEST_REAL_SUPABASE === "true") {
    return actual; // Use real implementation
  }

  return {
    ...actual,
    createClient: () => createMockSupabaseClient(),
  };
});
```

## Mock Composition Pattern

### Combine Multiple Mock Concerns

```typescript
class MockBuilder {
  private mocks: Record<string, any> = {};

  withAuth(permissions: string[]) {
    this.mocks.auth = createAuthMock(permissions);
    return this;
  }

  withDatabase(data: any) {
    this.mocks.db = createMockPrismaClient();
    // Setup data...
    return this;
  }

  withRouter(route: string) {
    this.mocks.router = {
      push: vi.fn(),
      pathname: route,
    };
    return this;
  }

  build() {
    return this.mocks;
  }
}

// Usage
const mocks = new MockBuilder()
  .withAuth(["issue:view", "issue:create"])
  .withDatabase({ users: [user1, user2] })
  .withRouter("/issues")
  .build();
```

## Testing Error Scenarios

### Mock Failures Gracefully

```typescript
describe("Error Handling", () => {
  it("handles network errors", () => {
    mocks.mockIssuesQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Network error"),
    });

    // Test error UI
  });

  it("handles permission errors", () => {
    mocks.mockIssuesQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new TRPCError({
        code: "FORBIDDEN",
        message: "Insufficient permissions",
      }),
    });

    // Test permission error handling
  });
});
```

## Best Practices

1. **Hoist Early**: Use `vi.hoisted()` for mocks needed during module resolution
2. **Type Safety**: Preserve types with `importActual` and spread operators
3. **Clear Mocks**: Always clear mocks in `beforeEach` to prevent test pollution
4. **Mock Minimally**: Only mock what you need to test
5. **Document Complex Mocks**: Add comments explaining non-obvious mock structures

## Common Pitfalls

1. **Import Order**: Mocks must be defined before imports
2. **Type Assertions**: Don't overuse `as any` - preserve types where possible
3. **Mock Leakage**: Mocks can leak between tests without proper cleanup
4. **Over-mocking**: Don't mock everything - some integration is valuable

## Advanced Techniques

### Dynamic Mock Responses

```typescript
let callCount = 0;
mocks.mockQuery.mockImplementation(() => {
  callCount++;
  if (callCount === 1) {
    return { data: null, isLoading: true };
  }
  return { data: mockData, isLoading: false };
});
```

### Mock Validation

```typescript
afterEach(() => {
  // Ensure mocks were called as expected
  expect(mocks.mockQuery).toHaveBeenCalled();
  expect(mocks.mockMutation).not.toHaveBeenCalledWith(
    expect.objectContaining({ invalid: true }),
  );
});
```

## Drizzle ORM Complex Query Chain Mocking

### Problem: Complex Query Chain Brittleness

During Phase 2B migration, we discovered that mocking individual methods in complex Drizzle query chains is extremely brittle:

```typescript
// ❌ Avoid: Complex nested method mocking
const complexChainMock = {
  from: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnValue({
    innerJoin: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(result),
      }),
    }),
  }),
};
```

**Issues with this approach:**

- Multiple failure points in chain
- Mock state contamination between calls
- Difficult to handle different scenarios
- Infrastructure disruption with `vi.clearAllMocks()`

### Solution: Call Counting Mock Pattern

```typescript
// ✅ Preferred: Single mock function with call counting
const createDrizzleMockWithCallCounting = (
  scenarios: {
    firstCallResult?: any;
    secondCallResult?: any;
    thirdCallResult?: any;
    firstCallShouldThrow?: boolean;
    secondCallShouldThrow?: boolean;
    thirdCallShouldThrow?: boolean;
  } = {},
) => {
  const {
    firstCallResult = defaultFirstResult,
    secondCallResult = defaultSecondResult,
    thirdCallResult = undefined,
    firstCallShouldThrow = false,
    secondCallShouldThrow = false,
    thirdCallShouldThrow = false,
  } = scenarios;

  let callCount = 0;
  const mockQuery = vi.fn().mockImplementation(() => {
    callCount++;

    if (callCount === 1) {
      if (firstCallShouldThrow) {
        throw new Error("First call failed");
      }
      return Promise.resolve(firstCallResult);
    } else if (callCount === 2) {
      if (secondCallShouldThrow) {
        throw new Error("Second call failed");
      }
      return Promise.resolve(secondCallResult);
    } else {
      if (thirdCallShouldThrow) {
        throw new Error("Third call failed");
      }
      return Promise.resolve(thirdCallResult);
    }
  });

  // Simple chain structure that all lead to our single mock function
  const createMockChain = (hasFinalMethod = "limit") => ({
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    [hasFinalMethod]: mockQuery,
  });

  return { mockQuery, createMockChain };
};
```

### Usage in Complex Router Tests

```typescript
describe("Admin Router removeUser", () => {
  let mockContext: VitestMockContext;
  let setupRemoveUserMocks: Function;

  beforeEach(() => {
    mockContext = createVitestMockContext();

    setupRemoveUserMocks = (options = {}) => {
      const { mockQuery, createMockChain } = createDrizzleMockWithCallCounting({
        firstCallResult: options.membershipResult || [mockMembership],
        secondCallResult: options.allMembershipsResult || mockAllMemberships,
        thirdCallResult: undefined, // Delete operation
        firstCallShouldThrow: options.shouldThrowOnMembership,
        secondCallShouldThrow: options.shouldThrowOnAllMemberships,
        thirdCallShouldThrow: options.shouldThrowOnDelete,
      });

      // Setup Drizzle mocks using our chain creators
      vi.mocked(mockContext.drizzle.select)
        .mockReturnValueOnce(createMockChain("limit")) // Membership lookup
        .mockReturnValueOnce(createMockChain("where")); // All memberships

      vi.mocked(mockContext.drizzle.delete).mockReturnValue(
        createMockChain("where"),
      ); // Delete operation

      // Setup validation mocks
      vi.mocked(validateUserRemoval).mockReturnValue(
        options.validationResult || { valid: true },
      );
    };
  });

  it("should handle validation failure", async () => {
    setupRemoveUserMocks({
      validationResult: {
        valid: false,
        error: "Cannot remove last admin user",
      },
    });

    try {
      await caller.removeUser({ userId: "test-user" });
      throw new Error("Expected function to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe("PRECONDITION_FAILED");
    }
  });

  it("should handle database errors on first query", async () => {
    setupRemoveUserMocks({
      shouldThrowOnMembership: true,
    });

    await expect(caller.removeUser({ userId: "test-user" })).rejects.toThrow(
      "First call failed",
    );
  });
});
```

### Key Benefits of Call Counting Pattern

1. **Single Point of Control**: All query results controlled by one function
2. **Scenario Flexibility**: Easy to test different error conditions
3. **Reduced Brittleness**: No complex nested mock structures
4. **Infrastructure Preservation**: Doesn't disrupt tRPC/auth mocks
5. **Debugging Friendly**: Easy to trace which call is causing issues

### Critical Test Structure Pattern

```typescript
// ❌ Avoid: Double function calls that contaminate mock state
await expect(caller.removeUser({ userId })).rejects.toThrow(TRPCError);
try {
  await caller.removeUser({ userId }); // This call uses contaminated state
  // assertions...
}

// ✅ Preferred: Single call with proper error handling
try {
  await caller.removeUser({ userId });
  throw new Error("Expected function to throw, but it didn't");
} catch (error) {
  expect(error).toBeInstanceOf(TRPCError);
  expect((error as TRPCError).code).toBe("PRECONDITION_FAILED");
}
```

### Mock Lifecycle Management

```typescript
beforeEach(() => {
  // ❌ Don't use vi.clearAllMocks() - breaks infrastructure
  // vi.clearAllMocks();

  // ✅ Clear only specific mocks you control
  vi.mocked(mockContext.drizzle.select).mockClear();
  vi.mocked(mockContext.drizzle.delete).mockClear();
  vi.mocked(validateUserRemoval).mockClear();

  // Re-establish critical infrastructure mocks
  setupPermissionMocks();
  setupAuthMocks();
});
```

This pattern has been battle-tested on complex admin router procedures with multiple database queries, validation logic, and error scenarios.
