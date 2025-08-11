# Testing Patterns: Modern Vitest & Direct Conversion

Testing strategies aligned with direct conversion approach. Focus on fast feedback over comprehensive coverage.

## 🎯 Testing Philosophy for Direct Conversion

**Core Principles:**

- Fast feedback loops over extensive test suites
- Integration testing with PGlite for database logic
- Mock at the right level (module > individual functions)
- TypeScript compilation as primary safety net
- Manual testing for complex business logic

---

## 🧪 Modern Vitest Patterns

### Type-Safe Partial Mocking

```typescript
import type * as AuthModule from "@/utils/auth";

vi.mock("@/utils/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof AuthModule>();
  return {
    ...actual,
    // Only mock what you need
    getUser: vi.fn().mockResolvedValue({ id: "123", name: "Test User" }),
    // hasPermission keeps original implementation
  };
});
```

### Hoisted Mock Variables

```typescript
const mocks = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockQuery: vi.fn(),
  mockAuth: {
    getUser: vi.fn(),
    signOut: vi.fn(),
  },
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: () => ({
    auth: mocks.mockAuth,
    from: () => ({ select: mocks.mockQuery }),
  }),
}));

test("uses hoisted mocks", () => {
  mocks.mockAuth.getUser.mockResolvedValue({ data: { user: null } });
  // Test logic here
});
```

### Configuration Migration

```typescript
// vitest.config.ts - Updated for v4.0
export default defineConfig({
  test: {
    // OLD: workspace (deprecated)
    // NEW: projects
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

---

## 🗄️ Database Testing with PGlite

### Setup In-Memory PostgreSQL

```typescript
// vitest.setup.ts
import { vi } from "vitest";
import * as schema from "./src/db/schema";

vi.mock("./src/db/index.ts", async (importOriginal) => {
  const { PGlite } = await vi.importActual<
    typeof import("@electric-sql/pglite")
  >("@electric-sql/pglite");
  const { drizzle } =
    await vi.importActual<typeof import("drizzle-orm/pglite")>(
      "drizzle-orm/pglite",
    );
  const { migrate } = await vi.importActual<
    typeof import("drizzle-orm/pglite/migrator")
  >("drizzle-orm/pglite/migrator");

  const client = new PGlite();
  const testDb = drizzle(client, { schema });

  // Apply migrations
  await migrate(testDb, { migrationsFolder: "./drizzle" });

  const originalModule =
    await importOriginal<typeof import("./src/db/index.ts")>();
  return {
    ...originalModule,
    db: testDb,
  };
});
```

### Integration Test Pattern

```typescript
// router.integration.test.ts
import { createTRPCMsw } from "msw-trpc";
import { appRouter } from "@/server/api/root";

describe("User Router Integration", () => {
  beforeEach(() => {
    // Fresh database for each test
    vi.clearAllMocks();
  });

  test("creates user with organizational scoping", async () => {
    const caller = appRouter.createCaller(mockContext);

    const user = await caller.user.create({
      name: "Test User",
      email: "test@example.com",
    });

    expect(user.organizationId).toBe(mockContext.user.organizationId);
  });
});
```

---

## 🔐 Authentication Testing

### Supabase Server Component Mocks

```typescript
// Mock next/headers for Server Components
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
        error: null,
      }),
    },
  }),
}));
```

### Server Action Testing

```typescript
import * as actions from "@/app/actions";

vi.mock("@/app/actions");

test("form submission calls server action", async () => {
  const mockCreatePost = vi.mocked(actions.createPost);
  mockCreatePost.mockResolvedValue({ id: 1 });

  // Simulate form submission
  const formData = new FormData();
  formData.set("title", "Test Post");

  await actions.createPost(formData);

  expect(mockCreatePost).toHaveBeenCalledWith(formData);
});
```

---

## 🛡️ Security & Permission Testing

### Multi-Tenant Scoping Tests

```typescript
test("enforces organizational boundaries", async () => {
  const caller = appRouter.createCaller({
    user: { organizationId: "org-1" },
  });

  // Should only return posts from user's organization
  const posts = await caller.post.getAll();

  posts.forEach((post) => {
    expect(post.organizationId).toBe("org-1");
  });
});
```

### Permission Matrix Testing

```typescript
const permissionCases = [
  { role: "admin", action: "delete", allowed: true },
  { role: "user", action: "delete", allowed: false },
  { role: "user", action: "read", allowed: true },
];

permissionCases.forEach(({ role, action, allowed }) => {
  test(`${role} can ${allowed ? "" : "not "}${action}`, async () => {
    const caller = appRouter.createCaller({
      user: { role, organizationId: "test-org" },
    });

    if (allowed) {
      await expect(caller.post[action]({ id: "1" })).resolves.toBeDefined();
    } else {
      await expect(caller.post[action]({ id: "1" })).rejects.toThrow();
    }
  });
});
```

---

## 📋 Daily Testing Checklist

**Before Router Conversion:**

- [ ] Update test mocks for new Drizzle patterns
- [ ] Ensure organizational scoping tests pass
- [ ] Verify authentication context works

**During Router Conversion:**

- [ ] Run tests after each procedure conversion
- [ ] Fix any failing tests immediately
- [ ] Add integration tests for complex logic

**After Router Conversion:**

- [ ] Full test suite passes
- [ ] Manual testing of key user flows
- [ ] Performance check for slow queries

---

## ⚠️ Common Testing Pitfalls

**Mock Setup Issues:**

- ❌ Accessing variables in `vi.mock` factories directly
- ✅ Use `vi.hoisted` for shared mock state
- ❌ Mocking individual methods instead of modules
- ✅ Mock at module level with partial mocking

**Database Testing:**

- ❌ Using external Docker containers for tests
- ✅ PGlite in-memory for fast, isolated tests
- ❌ Sharing database state between tests
- ✅ Fresh database for each test case

**Authentication Mocks:**

- ❌ Forgetting to mock `next/headers` for Server Components
- ✅ Mock both server and client Supabase utilities
- ❌ Complex auth state setup in every test
- ✅ Use factory functions for common auth states

---

## 🚦 Test Commands

```bash
# Test by project type
npm run test -- --project=unit         # Unit tests (mocked DB)
npm run test -- --project=integration  # Integration tests (PGlite DB)

# All tests
npm run test            # Full test suite
npm run test:brief      # Fast, minimal output

# Debugging
npm run test:ui         # Interactive UI
npm run test -- --reporter=verbose  # Detailed output
```

---

_Complete testing strategies: @docs/testing/vitest-guide.md_
