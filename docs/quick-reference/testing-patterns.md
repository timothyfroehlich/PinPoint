# Testing Patterns: Modern Vitest & Direct Conversion

Testing strategies optimized for fast feedback and direct conversion.

## 🎯 Testing Philosophy for Direct Conversion

**Core Principles:**

- Fast feedback loops over extensive test suites
- Integration testing with PGlite for database logic
- Mock at the right level (module > individual functions)
- TypeScript compilation as primary safety net
- Manual testing for complex business logic

---

## 🧪 Modern Vitest Patterns

### Modern Mock Patterns

**Partial mocking**: `vi.importActual` with type safety → @docs/testing/vitest-guide.md#partial-mocking  
**Hoisted variables**: `vi.hoisted()` for shared mock state → @docs/testing/vitest-guide.md#hoisted-mocks

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

### Database Testing Setup

**PGlite setup**: In-memory PostgreSQL with migrations → @docs/testing/vitest-guide.md#pglite-setup  
**Integration tests**: Router testing with real database calls → @docs/testing/integration-guide.md#router-patterns

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

## 📋 Testing Decision Tree

```
Testing Need:
├── Mock setup? → @docs/testing/vitest-guide.md#mock-patterns
├── Database testing? → @docs/testing/vitest-guide.md#pglite-setup
├── Router tests? → @docs/testing/integration-guide.md#router-patterns
└── Complete strategy? → @docs/testing/INDEX.md
```

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

**Complete strategies**: @docs/testing/vitest-guide.md
