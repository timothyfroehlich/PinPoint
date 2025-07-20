# Testing Patterns Guide

This guide covers Jest testing patterns, mocking strategies, and coverage best practices for PinPoint's TypeScript strictest mode environment.

## Quick Reference

For basic testing patterns, see [CLAUDE.md TypeScript Guidelines](../../CLAUDE.md#typescript-strictest-mode-guidelines). This guide covers advanced scenarios and comprehensive patterns.

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

## Related Documentation

- **Quick Patterns**: [CLAUDE.md TypeScript Guidelines](../../CLAUDE.md#typescript-strictest-mode-guidelines)
- **TypeScript Issues**: [typescript-strictest.md](./typescript-strictest.md)
- **Migration Tools**: [scripts/README.md](../../scripts/README.md)
- **Project Coverage**: [docs/coverage-setup.md](../coverage-setup.md)
