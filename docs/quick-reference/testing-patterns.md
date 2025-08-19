# Testing Patterns: Modern Vitest & Hardcoded ID Architecture

Testing strategies optimized for fast feedback, predictable data, and direct conversion.

## 🎯 Testing Philosophy for Direct Conversion

**Core Principles:**

- **Hardcoded IDs over random generation**: Predictable test data for debugging
- **Memory-safe PGlite patterns**: Worker-scoped instances to prevent system lockups
- **Minimal → Full seed progression**: All tests build on consistent foundation
- **Two-organization architecture**: Primary + competitor orgs for RLS testing
- Fast feedback loops over extensive test suites
- Integration testing with PGlite for database logic
- Mock at the right level (module > individual functions)
- TypeScript compilation as primary safety net

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

## 🗄️ Memory-Safe Database Testing with PGlite

### 🚨 CRITICAL: Memory Safety Rules

**❌ NEVER USE (causes system lockups):**
```typescript
beforeEach(async () => {
  const { db } = await createSeededTestDatabase(); // 50-100MB per test
});
```

**✅ ALWAYS USE (memory-safe):**
```typescript
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";

test("integration test", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Single shared instance, transaction cleanup
  });
});
```

### Database Testing Setup

**PGlite setup**: Worker-scoped PostgreSQL with automatic cleanup → @docs/testing/test-database.md#memory-safety  
**Integration tests**: Real database calls with RLS context → @docs/testing/archetype-integration-testing.md  
**pgTAP RLS tests**: Native PostgreSQL policy validation → @docs/testing/pgtap-rls-testing.md

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

### Multi-Tenant Scoping Tests with SEED_TEST_IDS

```typescript
import { SEED_TEST_IDS, createMockAdminContext } from "~/test/constants/seed-test-ids";

test("enforces organizational boundaries", async () => {
  const adminContext = createMockAdminContext();
  const caller = appRouter.createCaller({
    user: { organizationId: adminContext.organizationId },
  });

  // Should only return posts from user's organization
  const posts = await caller.post.getAll();

  posts.forEach((post) => {
    expect(post.organizationId).toBe(SEED_TEST_IDS.ORGANIZATIONS.primary);
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
      user: { role, organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary },
    });

    if (allowed) {
      await expect(caller.post[action]({ 
        id: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE 
      })).resolves.toBeDefined();
    } else {
      await expect(caller.post[action]({ 
        id: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE 
      })).rejects.toThrow();
    }
  });
});
```

---

## 🎯 Hardcoded Test Data Architecture

### **Minimal → Full Seed Progression**

**Architecture**: All tests use minimal seed as foundation

```
Minimal Seed (Foundation)
├── 2 organizations (primary + competitor)
├── ~8 test users (admin, members, guests)  
├── ~10 machines across different games
├── ~20 sample issues
└── All infrastructure (roles, statuses, priorities)

Full Seed (Additive)
├── Minimal seed (always included) 
├── +50 additional machines
├── +180 additional issues
└── Rich sample data for demos
```

### **SEED_TEST_IDS: Single Source of Truth**

**Hardcoded IDs for predictability** → [`src/test/constants/seed-test-ids.ts`](../../src/test/constants/seed-test-ids.ts)

```typescript
import { SEED_TEST_IDS, createMockAdminContext } from "~/test/constants/seed-test-ids";

// Two organizations for security testing
SEED_TEST_IDS.ORGANIZATIONS.primary      // "test-org-pinpoint" (Austin Pinball)
SEED_TEST_IDS.ORGANIZATIONS.competitor   // "test-org-competitor" (Competitor Arcade)

// Predictable user IDs
SEED_TEST_IDS.USERS.ADMIN                // "test-user-tim"
SEED_TEST_IDS.USERS.MEMBER1              // "test-user-harry"

// Mock patterns for unit tests
SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION // "mock-org-1"
SEED_TEST_IDS.MOCK_PATTERNS.MACHINE      // "mock-machine-1"
```

### **Usage Patterns by Test Type**

**Unit Tests** (mocked database):
```typescript
// Use MOCK_PATTERNS for consistent mock IDs
const mockContext = createMockAdminContext();
const mockData = { organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION };
```

**Integration Tests** (real PGlite database):
```typescript
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";

test("integration test", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Use seeded data for real relationships
    const seededData = await getSeededTestData(db, SEED_TEST_IDS.ORGANIZATIONS.primary);
    expect(result.machineId).toBe(seededData.machine);
  });
});
```

**Security Tests** (cross-org isolation):
```typescript
test("enforces cross-org boundaries", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Create data in primary org
    await setOrgContext(db, SEED_TEST_IDS.ORGANIZATIONS.primary);
    const issue1 = await createIssue(db, { title: "Primary Org Secret" });
    
    // Switch to competitor org - should not see primary org data
    await setOrgContext(db, SEED_TEST_IDS.ORGANIZATIONS.competitor);
    const visibleIssues = await db.query.issues.findMany();
    
    expect(visibleIssues).not.toContainEqual(issue1);
  });
});
```

**pgTAP SQL Tests** (database-level RLS validation):
```sql
-- Load generated constants from TypeScript
\i constants.sql

-- Use generated functions for consistent IDs
SELECT set_jwt_claims_for_test(test_org_primary(), test_user_admin());
SELECT results_eq(
  'SELECT organization_id FROM issues',
  ARRAY[test_org_primary()],
  'Primary org user sees only their data'
);
```

### **Key Benefits**

- 🎯 **Predictable debugging**: "machine-mm-001 is failing" vs random UUIDs
- 🔗 **Stable relationships**: Foreign keys never break from ID changes
- ⚡ **Fast tests**: No nanoid() generation overhead
- 🔄 **Cross-language consistency**: TypeScript → SQL → Seed data
- 🔒 **Security testing**: Two orgs enable RLS boundary validation

### **When to Use What**

- **Unit Tests**: `SEED_TEST_IDS.MOCK_PATTERNS` for consistent mock IDs
- **Service Unit Tests**: `SEED_TEST_IDS.MOCK_PATTERNS` for standardized mocks  
- **Single-Org Integration**: `getSeededTestData()` for dynamic seeded relationships
- **Multi-Org Security**: `SEED_TEST_IDS.ORGANIZATIONS` for boundary testing
- **pgTAP RLS Tests**: Generated SQL functions for database-level validation

---

## 📋 Testing Decision Tree

```
Testing Need:
├── Unit tests (mocked DB)? → Use SEED_TEST_IDS.MOCK_PATTERNS
├── Integration tests (real DB)? → Use getSeededTestData() + withIsolatedTest
├── Security/RLS tests? → Use SEED_TEST_IDS.ORGANIZATIONS for cross-org scenarios
├── pgTAP database tests? → Use generated SQL constants from build script
├── Memory safety? → ALWAYS use withIsolatedTest pattern
├── Mock setup? → @docs/testing/vitest-guide.md#mock-patterns
└── Complete strategy? → @docs/testing/INDEX.md
```

---

## ⚠️ Common Testing Pitfalls

**Mock Setup Issues:**

- ❌ Accessing variables in `vi.mock` factories directly
- ✅ Use `vi.hoisted` for shared mock state
- ❌ Mocking individual methods instead of modules
- ✅ Mock at module level with partial mocking

**Database Testing & Memory Safety:**

- ❌ `new PGlite()` per test (causes 1-2GB+ memory usage and system lockups)
- ✅ Worker-scoped PGlite with `withIsolatedTest` pattern
- ❌ `createSeededTestDatabase()` in `beforeEach` (memory blowout)
- ✅ Single shared instance with transaction isolation
- ❌ Using external Docker containers for tests
- ✅ PGlite in-memory for fast, isolated tests

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
npm run test            # Full test suite (business logic)
npm run test:brief      # Fast, minimal output
npm run test:rls        # pgTAP RLS policy validation
npm run test:all        # Complete dual-track testing

# SQL constants generation
npm run generate:sql-constants  # TypeScript → SQL functions

# Debugging
npm run test:ui         # Interactive UI
npm run test -- --reporter=verbose  # Detailed output
```

---

## 📖 Related Documentation

**Memory Safety**: [@docs/testing/test-database.md](../testing/test-database.md#memory-safety) - Critical PGlite patterns  
**Seed Architecture**: [`SEED_TEST_IDS`](../../src/test/constants/seed-test-ids.ts) - Hardcoded ID constants  
**Integration Testing**: [@docs/testing/archetype-integration-testing.md](../testing/archetype-integration-testing.md) - Full-stack patterns  
**Security Testing**: [@docs/testing/archetype-security-testing.md](../testing/archetype-security-testing.md) - Cross-org validation  
**pgTAP RLS Testing**: [@docs/testing/pgtap-rls-testing.md](../testing/pgtap-rls-testing.md) - Native PostgreSQL testing  
**Complete strategies**: [@docs/testing/INDEX.md](../testing/INDEX.md) - Full testing architecture

**Last Updated**: 2025-08-19 (Phase 0 - Seed data architecture implementation)
