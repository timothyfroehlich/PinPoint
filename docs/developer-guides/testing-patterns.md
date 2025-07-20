# Testing Patterns Guide

This guide covers Jest testing patterns, mocking strategies, and coverage best practices for PinPoint's TypeScript strictest mode environment.

## Quick Reference

For basic testing patterns, see [CLAUDE.md TypeScript Guidelines](../../CLAUDE.md#typescript-strictest-mode-guidelines). This guide covers advanced scenarios and comprehensive patterns.

**NEW**: For schema-validated testing with Zod-Prisma integration, see [Zod-Prisma Integration Guide](./zod-prisma-integration.md).

## Jest Mocking Patterns

### 1. Service Mocking with jest.Mocked

**Basic Service Mock**

```typescript
import { UserService } from "../services/userService";

// ✅ Properly typed service mock
const mockUserService: jest.Mocked<UserService> = {
  get: jest.fn<Promise<User>, [string]>(),
  create: jest.fn<Promise<User>, [CreateUserData]>(),
  update: jest.fn<Promise<User>, [string, UpdateUserData]>(),
  delete: jest.fn<Promise<void>, [string]>(),
};

// Mock implementation with type safety
mockUserService.get.mockImplementation(async (id) => {
  if (id === "existing-user") {
    return createMockUser({ id });
  }
  throw new Error("User not found");
});
```

### 2. Prisma Client Mocking

**ExtendedPrismaClient with $accelerate**

```typescript
import type { ExtendedPrismaClient } from "../server/db";

// ✅ Complete Prisma mock including $accelerate
const mockPrisma: Partial<ExtendedPrismaClient> = {
  user: {
    findUnique: jest.fn<Promise<User | null>, [any]>(),
    findMany: jest.fn<Promise<User[]>, [any]>(),
    create: jest.fn<Promise<User>, [any]>(),
    update: jest.fn<Promise<User>, [any]>(),
    delete: jest.fn<Promise<User>, [any]>(),
  },
  organization: {
    findUnique: jest.fn<Promise<Organization | null>, [any]>(),
    findMany: jest.fn<Promise<Organization[]>, [any]>(),
    create: jest.fn<Promise<Organization>, [any]>(),
  },
  $accelerate: {
    invalidate: jest.fn<Promise<void>, [string]>(),
    invalidateAll: jest.fn<Promise<void>, []>(),
  },
  $transaction: jest.fn(),
  $disconnect: jest.fn<Promise<void>, []>(),
};

// Mock with realistic data
mockPrisma.user!.findUnique!.mockImplementation(async ({ where }) => {
  if (where.id === "user-1") {
    return createMockUser({ id: "user-1" });
  }
  return null;
});
```

### 3. tRPC Context Mocking

**Complete Context Mock**

```typescript
import type { Context } from "../server/api/trpc";

function createMockContext(overrides: Partial<Context> = {}): Context {
  return {
    db: mockPrisma as ExtendedPrismaClient,
    session: null,
    services: {
      user: mockUserService,
      notification: mockNotificationService,
      collection: mockCollectionService,
      issueActivity: mockIssueActivityService,
      pinballmap: mockPinballmapService,
    },
    ...overrides,
  };
}

// Authenticated context
function createMockAuthContext(user: Partial<User> = {}): Context {
  return createMockContext({
    session: {
      user: createMockUser(user),
      expires: new Date(Date.now() + 86400000).toISOString(),
    },
  });
}
```

### 4. Mock Data Factories

**Type-Safe Mock Factories**

```typescript
// User factory
function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: "mock-user-id",
    name: "Mock User",
    email: "mock@example.com",
    image: null,
    createdAt: new Date("2023-01-01"),
    updatedAt: new Date("2023-01-01"),
    ...overrides,
  };
}
```

**Schema-Validated Factories (Recommended)**

```typescript
import { UserSchema, IssueSchema } from "~/prisma/generated/zod";

// ✅ Schema-validated factory with CUID format
function createValidUser(overrides: Partial<User> = {}): User {
  const baseUser = {
    id: "clh7xkg7w0000x9yz0qj3k1vq", // Valid CUID format
    name: "Test User",
    email: "test@example.com",
    emailVerified: null,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    bio: null,
    profilePicture: null,
    emailNotificationsEnabled: true,
    pushNotificationsEnabled: false,
    notificationFrequency: "IMMEDIATE" as const,
    ...overrides,
  };

  // Always validate with schema to ensure data consistency
  return UserSchema.parse(baseUser);
}

// Organization factory
function createMockOrganization(
  overrides: Partial<Organization> = {},
): Organization {
  return {
    id: "mock-org-id",
    name: "Mock Organization",
    subdomain: "mock-org",
    settings: {},
    createdAt: new Date("2023-01-01"),
    updatedAt: new Date("2023-01-01"),
    ...overrides,
  };
}

// Game instance factory
function createMockGameInstance(
  overrides: Partial<GameInstance> = {},
): GameInstance {
  return {
    id: "mock-game-id",
    serialNumber: "MOCK123",
    organizationId: "mock-org-id",
    locationId: "mock-location-id",
    gameTitleId: "mock-title-id",
    condition: "GOOD",
    notes: null,
    createdAt: new Date("2023-01-01"),
    updatedAt: new Date("2023-01-01"),
    ...overrides,
  };
}
```

## tRPC Testing Patterns

### 1. Router Testing

**Testing Public Procedures**

```typescript
import { createTRPCMsw } from "msw-trpc";
import { appRouter } from "../server/api/root";

describe("User Router", () => {
  const ctx = createMockContext();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should get user by id", async () => {
    const mockUser = createMockUser({ id: "user-1" });
    mockPrisma.user!.findUnique!.mockResolvedValue(mockUser);

    const caller = appRouter.createCaller(ctx);
    const result = await caller.user.byId({ id: "user-1" });

    expect(result).toEqual(mockUser);
    expect(mockPrisma.user!.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
    });
  });
});
```

**Testing Protected Procedures**

```typescript
describe("Protected User Routes", () => {
  it("should require authentication", async () => {
    const ctx = createMockContext(); // No session
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.user.updateProfile({ name: "New Name" }),
    ).rejects.toThrow("UNAUTHORIZED");
  });

  it("should update user profile when authenticated", async () => {
    const user = createMockUser({ id: "user-1" });
    const ctx = createMockAuthContext(user);
    const caller = appRouter.createCaller(ctx);

    const updatedUser = createMockUser({ id: "user-1", name: "Updated Name" });
    mockPrisma.user!.update!.mockResolvedValue(updatedUser);

    const result = await caller.user.updateProfile({ name: "Updated Name" });

    expect(result).toEqual(updatedUser);
    expect(mockPrisma.user!.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { name: "Updated Name" },
    });
  });
});
```

### 2. Multi-Tenant Testing

**Organization Scoping Tests**

```typescript
describe("Multi-tenant data access", () => {
  it("should only return data for user organization", async () => {
    const user = createMockUser({ id: "user-1" });
    const ctx = createMockAuthContext(user);

    // Mock user membership
    mockPrisma.member!.findFirst!.mockResolvedValue({
      userId: "user-1",
      organizationId: "org-1",
      role: "MEMBER",
    });

    // Mock organization-scoped data
    const orgGames = [createMockGameInstance({ organizationId: "org-1" })];
    mockPrisma.gameInstance!.findMany!.mockResolvedValue(orgGames);

    const caller = appRouter.createCaller(ctx);
    const result = await caller.game.list();

    expect(mockPrisma.gameInstance!.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1" },
      include: expect.any(Object),
    });
    expect(result).toEqual(orgGames);
  });
});
```

## Error Handling Patterns

### 1. Testing Error Scenarios

**Service Error Handling**

```typescript
describe("Error handling", () => {
  it("should handle database errors gracefully", async () => {
    const ctx = createMockAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Mock database error
    mockPrisma.user!.findUnique!.mockRejectedValue(
      new Error("Database connection failed"),
    );

    await expect(caller.user.byId({ id: "user-1" })).rejects.toThrow(
      "Database connection failed",
    );
  });

  it("should return null for not found resources", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    mockPrisma.user!.findUnique!.mockResolvedValue(null);

    const result = await caller.user.byId({ id: "nonexistent" });
    expect(result).toBeNull();
  });
});
```

### 2. Validation Error Testing

**Input Validation**

```typescript
describe("Input validation", () => {
  it("should validate required fields", async () => {
    const ctx = createMockAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.user.create({
        name: "", // Invalid: empty name
        email: "invalid-email", // Invalid: bad email format
      }),
    ).rejects.toThrow(); // Zod validation error
  });
});
```

## Testing Utilities and Helpers

### 1. Setup and Teardown

**Test Setup Helper**

```typescript
// test/helpers/setup.ts
export function setupTestEnvironment() {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset common mocks to default behavior
    mockPrisma.user!.findUnique!.mockResolvedValue(null);
    mockPrisma.organization!.findUnique!.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
}
```

### 2. Custom Matchers

**Jest Custom Matchers**

```typescript
// test/helpers/matchers.ts
expect.extend({
  toHaveBeenCalledWithOrganizationScope(received, organizationId: string) {
    const calls = received.mock.calls;
    const pass = calls.some(
      (call) => call[0]?.where?.organizationId === organizationId,
    );

    return {
      pass,
      message: () =>
        `Expected function to have been called with organizationId "${organizationId}"`,
    };
  },
});

// Usage in tests
expect(mockPrisma.gameInstance!.findMany).toHaveBeenCalledWithOrganizationScope(
  "org-1",
);
```

### 3. Test Data Builders

**Builder Pattern for Complex Objects**

```typescript
class GameInstanceBuilder {
  private data: Partial<GameInstance> = {};

  constructor() {
    this.data = {
      id: "default-id",
      serialNumber: "DEFAULT123",
      organizationId: "default-org",
      locationId: "default-location",
      gameTitleId: "default-title",
      condition: "GOOD",
      createdAt: new Date("2023-01-01"),
      updatedAt: new Date("2023-01-01"),
    };
  }

  withId(id: string): GameInstanceBuilder {
    this.data.id = id;
    return this;
  }

  withOrganization(organizationId: string): GameInstanceBuilder {
    this.data.organizationId = organizationId;
    return this;
  }

  withCondition(condition: GameCondition): GameInstanceBuilder {
    this.data.condition = condition;
    return this;
  }

  build(): GameInstance {
    return this.data as GameInstance;
  }
}

// Usage
const gameInstance = new GameInstanceBuilder()
  .withId("game-1")
  .withOrganization("org-1")
  .withCondition("NEEDS_REPAIR")
  .build();
```

## Coverage and Quality

### 1. Coverage Configuration

**Jest Coverage Setup**

```javascript
// jest.config.js
module.exports = {
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/*.stories.{ts,tsx}",
    "!src/test/**/*",
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
    "./src/server/": {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
    "./src/lib/": {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
```

### 2. Testing Anti-Patterns to Avoid

**❌ Don't Do This**

```typescript
// Using any in tests
const mockService = jest.fn() as any;

// Testing implementation details
expect(component.state.isLoading).toBe(true);

// Overly specific mocks
mockPrisma.user.findUnique.mockImplementation(async (args) => {
  if (args.where.id === "user-1" && args.include?.profile === true) {
    return specificUser;
  }
  // ... many more specific conditions
});

// Not cleaning up mocks
// (missing jest.clearAllMocks() in beforeEach)
```

**✅ Do This Instead**

```typescript
// Properly typed mocks
const mockService: jest.Mocked<UserService> = {
  get: jest.fn<Promise<User>, [string]>(),
};

// Testing behavior, not implementation
await user.click(saveButton);
expect(mockService.update).toHaveBeenCalledWith(expectedData);

// Flexible mocks with factories
mockPrisma.user.findUnique.mockImplementation(async ({ where }) => {
  return testData.users.find((u) => u.id === where.id) ?? null;
});

// Proper cleanup
beforeEach(() => {
  jest.clearAllMocks();
});
```

## Integration with TypeScript Strictest

### 1. Type-Safe Test Helpers

**Ensuring Type Safety in Tests**

```typescript
// Type-safe API caller
function createTypedCaller<T extends keyof AppRouter["_def"]["procedures"]>(
  procedure: T,
  ctx: Context = createMockContext(),
) {
  const caller = appRouter.createCaller(ctx);
  return caller[procedure];
}

// Usage with full type safety
const userProcedures = createTypedCaller("user");
const result = await userProcedures.byId({ id: "user-1" });
// result is properly typed as User | null
```

### 2. Avoiding Common Type Issues

**exactOptionalPropertyTypes in Tests**

```typescript
// ❌ Bad: undefined not compatible with optional
const testUser: Partial<User> = {
  name: userName || undefined,
  email: userEmail || undefined,
};

// ✅ Good: conditional assignment
const testUser: Partial<User> = {};
if (userName) testUser.name = userName;
if (userEmail) testUser.email = userEmail;

// ✅ Alternative: builder pattern
const testUser = new UserBuilder()
  .withName(userName)
  .withEmail(userEmail)
  .build();
```

## Commands and Scripts

### Development Commands

```bash
# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Debug specific test file
npm run test -- --testPathPattern=user.test.ts --verbose
```

### Test-Specific TypeScript Checking

```bash
# Check specific test file
npm run typecheck:tests -- src/server/api/__tests__/user.test.ts

# Check all test files
npm run typecheck:tests
```

## Critical Infrastructure Lessons

### ⚠️ Mock Infrastructure Changes: High-Risk Operations

**Lesson**: Changing core mock infrastructure (like `mockContext.ts` or `serviceHelpers.ts`) can cascade failures across the entire test suite.

**What Happened**: Attempting to fix Prisma AcceleratePromise errors by switching from `DeepMockProxy<ExtendedPrismaClient>` to manual mock objects broke 40+ additional test files that depended on the mock infrastructure.

**Key Principles**:

1. **Preserve Interface Compatibility**: Keep existing mock interfaces intact when fixing underlying issues
2. **Incremental Changes**: Fix one file at a time rather than changing shared infrastructure
3. **Dependency Mapping**: Understand what depends on shared utilities before changing them
4. **Rollback Strategy**: Always have a path back to a known working state

**Recommended Approach for Infrastructure Changes**:

```typescript
// ❌ Big Bang Approach - High Risk
// Replace entire mock infrastructure at once
const mockDb = {
  // Completely new structure...
} as jest.Mocked<ExtendedPrismaClient>;

// ✅ Incremental Approach - Low Risk
// Keep existing structure, fix specific issues
const mockDb = mockDeep<ExtendedPrismaClient>();
// Add fixes for specific issues without breaking interface
mockDb.$accelerate = {
  invalidate: jest.fn(),
  ttl: jest.fn(),
};
```

### 🔄 Parallel vs Sequential Fixes

**Lesson**: Use parallel agents for isolated files, sequential approach for interdependent changes.

**What Worked**:

- ✅ Parallel fixes for isolated test files (collection.test.ts, issue.notification.test.ts)
- ✅ Files with no shared dependencies can be fixed simultaneously

**What Failed**:

- ❌ Parallel fixes when shared infrastructure was changing
- ❌ Agents working with broken mock context due to simultaneous changes

**Decision Matrix**:

```
File Type              | Approach    | Risk Level
----------------------|-------------|------------
Isolated test files   | Parallel    | Low
Shared utilities      | Sequential  | High
Mock infrastructure   | Sequential  | Very High
Individual routers    | Parallel    | Low
Service tests         | Sequential  | Medium
```

### 🎯 Prisma Accelerate Mock Patterns

**Lesson**: Prisma Accelerate integration requires specific mock patterns that maintain type compatibility.

**The Problem**: Prisma methods with Accelerate return `AcceleratePromise<T>` instead of `Promise<T>`, breaking standard Jest mock patterns.

**Solutions**:

```typescript
// ❌ Breaks with AcceleratePromise
mockDb.user.findFirst.mockResolvedValue(userData);

// ✅ Compatible pattern
mockDb.user.findFirst.mockResolvedValue(
  Promise.resolve(userData) as any, // Type assertion for complex Prisma types
);

// ✅ Alternative: Use mockImplementation
mockDb.user.findFirst.mockImplementation(async () => userData);
```

### 📊 Error Count Management

**Lesson**: Track error counts as a key metric for progress validation.

**Pattern**:

1. **Baseline**: Establish starting error count (`npm run typecheck 2>&1 | grep -c "error TS"`)
2. **File Breakdown**: Track errors by file (`cut -d'(' -f1 | sort | uniq -c | sort -nr`)
3. **Progress Validation**: Ensure error count decreases with each change
4. **Rollback Trigger**: If error count increases significantly, rollback immediately

**Example Workflow**:

```bash
# Before changes
npm run typecheck 2>&1 | grep -c "error TS"  # 72 errors

# After infrastructure change
npm run typecheck 2>&1 | grep -c "error TS"  # 108 errors - ROLLBACK!

# After rollback + targeted fixes
npm run typecheck 2>&1 | grep -c "error TS"  # 64 errors - Progress!
```

## Related Documentation

- **Quick Patterns**: [CLAUDE.md TypeScript Guidelines](../../CLAUDE.md#typescript-strictest-mode-guidelines)
- **TypeScript Issues**: [typescript-strictest.md](./typescript-strictest.md)
- **Migration Tools**: [scripts/README.md](../../scripts/README.md)
- **Project Coverage**: [docs/coverage-setup.md](../coverage-setup.md)
