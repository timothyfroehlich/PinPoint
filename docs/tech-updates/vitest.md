# Vitest: Modern ES Module Mocking & Type Safety

_Advanced mocking patterns for type-safe testing in modern JavaScript applications_

## Key Changes (2024-2025)

### **🚀 Vitest 3.0 Updates (2025)**

**Enhanced Browser Mode**: Better ES module support for browser-based testing  
**Performance Improvements**: Faster test execution and module resolution  
**Improved TypeScript Integration**: Better type inference for mock functions

### 🎯 **Modern ES Module Mocking Standard**

**New Standard: `vi.importActual` with Async Factory**

- **DO:** Use `vi.mock` with async factory and `vi.importActual` for partial mocking
- **DON'T:** Use complex patterns that sacrifice type safety
- **Migration Benefit:** Full TypeScript support with precise control over what's mocked

**Type-Safe Partial Mocking**

- **DO:** Import original module types with `importOriginal<typeof ModuleType>()`
- **DON'T:** Mock entire modules when you only need to replace specific functions
- **Migration Benefit:** Retain original implementations while mocking only what's needed

**Enhanced Mock Control**

- **DO:** Use `vi.hoisted` for variables that need to be accessed in `vi.mock`
- **DON'T:** Try to reference test variables directly in mock factories
- **Migration Benefit:** Clean separation of mock setup from test logic

### ⚡ **Vitest v4.0 Beta Changes**

**Configuration Updates**

- **BREAKING:** `workspace` option deprecated, use `projects` instead
- **DO:** Migrate to `projects` configuration for monorepo setups
- **DON'T:** Rely on deprecated `workspace` configuration
- **Migration Impact:** Better support for distinct test configurations per project

**Spy Implementation Rewrite**

- **DO:** Use new intuitive spying patterns in v4.0
- **DON'T:** Rely on complex workarounds from earlier versions
- **Migration Benefit:** More predictable module mocking behavior

### 🛠 **Integration Patterns**

**Enhanced Mock Registry**

- **DO:** Use `vi.mockObject` for deep object mocking
- **DON'T:** Manually mock every property of complex objects
- **Migration Benefit:** Automatic mocking with `{ spy: true }` option

**Module Reset Capabilities**

- **DO:** Use `vi.resetModules()` for isolating modules with conflicting state
- **DON'T:** Let module state leak between tests
- **Migration Benefit:** Cleaner test isolation and reliability

## Modern Mocking Patterns

### Type-Safe Partial Module Mocking

**The Cornerstone Pattern**

```typescript
// utils/auth.ts - Original module
export const getUser = async (id: string) => {
  /* API call */
};
export const hasPermission = (user: User, permission: string) => {
  /* logic */
};

// test file
import type * as AuthModule from "@/utils/auth";

vi.mock("@/utils/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof AuthModule>();
  return {
    ...actual,
    getUser: vi.fn().mockResolvedValue({ id: "123", name: "Test User" }),
    // hasPermission retains original implementation
  };
});
```

### Hoisted Mock Variables

**Using `vi.hoisted` for Complex Setup**

```typescript
const mocks = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockQuery: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  createClient: mocks.mockCreateClient,
  db: { query: { users: { findMany: mocks.mockQuery } } },
}));

test("uses hoisted mocks", () => {
  mocks.mockQuery.mockResolvedValue([{ id: 1, name: "Test" }]);
  // test implementation
});
```

### Advanced Object Mocking

**Deep Object Mocking with `vi.mockObject`**

```typescript
const mockDbClient = vi.mockObject(
  {
    query: {
      users: { findMany: async () => [] },
      posts: { findFirst: async () => null },
    },
  },
  { spy: true }
); // Keeps original behavior, adds spy capabilities
```

## Stack-Specific Integration

### Mocking Drizzle Database Client

**In-Memory Database for Tests**

```typescript
// vitest.setup.ts
vi.mock("@/lib/db", async (importOriginal) => {
  const { PGlite } = await vi.importActual<
    typeof import("@electric-sql/pglite")
  >("@electric-sql/pglite");
  const { drizzle } =
    await vi.importActual<typeof import("drizzle-orm/pglite")>(
      "drizzle-orm/pglite"
    );

  const client = new PGlite();
  const testDb = drizzle(client, { schema: await import("@/lib/db/schema") });

  return {
    db: testDb,
    // Keep other exports
    ...(await importOriginal()),
  };
});
```

### Mocking Supabase Client

**Server Component Testing**

```typescript
// Mock next/headers for server components
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: vi.fn().mockReturnValue({ value: "fake-session" }),
    set: vi.fn(),
    remove: vi.fn(),
  }),
}));

// Mock Supabase server client
vi.mock("@/utils/supabase/server", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "123", email: "test@example.com" } },
      }),
    },
  }),
}));
```

### Mocking Next.js Server Actions

**Testing Form Submissions**

```typescript
import * as actions from "@/lib/actions";

vi.mock("@/lib/actions");

test("form calls server action", async () => {
  const mockCreatePost = vi.mocked(actions.createPost);
  mockCreatePost.mockResolvedValue({ id: 1 });

  // Test form submission
  // Assert mockCreatePost was called with FormData
});
```

## Testing Strategies

### Module Reset for Clean Tests

**Isolating Module State**

```typescript
beforeEach(() => {
  vi.resetModules(); // Clear module cache
  vi.clearAllMocks(); // Reset mock state
});

test("module starts with fresh state", async () => {
  const module = await import("./stateful-module.js");
  expect(module.getState()).toBe("initial");
});
```

### Global Variable Mocking

**Environment and Global Mocking**

```typescript
// Mock environment variables
vi.stubGlobal("process.env.NODE_ENV", "test");

// Mock global APIs
vi.stubGlobal(
  "fetch",
  vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ data: "mocked" }),
  })
);

// Cleanup in teardown
afterEach(() => {
  vi.unstubAllGlobals();
});
```

### Type-Safe Mock Casting

**Using `vi.mocked` for TypeScript**

```typescript
import { someService } from "@/services/example";

vi.mock("@/services/example");

test("with proper types", () => {
  const mockedService = vi.mocked(someService);
  mockedService.getData.mockResolvedValue({ id: 1 });

  // Full TypeScript support with autocompletion
});
```

## Configuration Updates

### Migrating from Workspace to Projects

**Old Configuration**

```typescript
// vitest.config.ts (deprecated)
export default defineConfig({
  test: {
    workspace: ["./packages/*/vitest.config.ts"],
  },
});
```

**New Configuration**

```typescript
// vitest.config.ts (v4.0+)
export default defineConfig({
  test: {
    projects: [
      {
        name: "unit",
        testMatch: ["**/*.test.ts"],
      },
      {
        name: "integration",
        testMatch: ["**/*.integration.test.ts"],
      },
    ],
  },
});
```

## Common Patterns for Direct Migration

### Database Query Testing

**Testing with Mocked Drizzle**

```typescript
// Mock database operations for router testing
const mockDb = vi.hoisted(() => ({
  query: {
    users: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
```

### Authentication Context Testing

**Mocking User Sessions**

```typescript
const mockAuth = vi.hoisted(() => ({
  getUser: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: mockAuth,
  }),
}));

test("protected component", () => {
  mockAuth.getUser.mockResolvedValue({
    data: { user: { id: "123" } },
  });
  // Test protected component behavior
});
```

## Migration Checklist

### Phase 1: Update Mock Patterns

- [ ] Replace old mocking patterns with `vi.importActual`
- [ ] Use async factory functions for partial mocks
- [ ] Implement `vi.hoisted` for complex mock setups

### Phase 2: Stack Integration

- [ ] Mock Drizzle database client for router testing
- [ ] Mock Supabase authentication for component testing
- [ ] Mock Next.js Server Actions for form testing

### Phase 3: Configuration Update

- [ ] Migrate from `workspace` to `projects` configuration
- [ ] Update test scripts for v4.0 compatibility
- [ ] Implement proper mock cleanup strategies

### Phase 4: Type Safety

- [ ] Add proper TypeScript types to all mocks
- [ ] Use `vi.mocked` for type-safe mock assertions
- [ ] Ensure all mock factories return properly typed objects

## Best Practices

**Do's:**

- Use `vi.importActual` for partial mocking
- Implement proper TypeScript types in mock factories
- Use `vi.hoisted` for variables needed in mock setup
- Reset modules and mocks between tests
- Mock at the right level (module vs function vs property)

**Don'ts:**

- Mock more than necessary (prefer partial mocking)
- Access test variables directly in mock factories
- Let mock state leak between tests
- Sacrifice type safety for convenience
- Use deprecated `workspace` configuration

## Performance Benefits

**Reduced Test Complexity**

- Type-safe mocking reduces debugging time
- Partial mocks are more maintainable
- Proper cleanup prevents test interference

**Better Developer Experience**

- Full TypeScript autocompletion in mocks
- Clear separation of concerns with `vi.hoisted`
- Intuitive patterns align with ES module semantics

## Next Steps

1. **Audit existing test mocks** for outdated patterns
2. **Implement type-safe partial mocking** throughout test suite
3. **Update configuration** for v4.0 compatibility
4. **Integrate stack-specific mocking** patterns for Drizzle/Supabase
5. **Establish consistent** mock cleanup strategies

_Full examples and advanced patterns in [tech-stack-research-catchup.md](../tech-stack-research-catchup.md)_
