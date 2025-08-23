# PinPoint Non-Negotiables Examples

_Detailed code examples and rationale for file content violations from NON_NEGOTIABLES.md_

## Memory Safety Violations

**Violation**: Per-test PGlite instances cause system lockups.

```typescript
// ❌ NEVER - Causes system lockups (1-2GB+ memory usage)
beforeEach(async () => {
  const { db } = await createSeededTestDatabase(); // 50-100MB per test
});

beforeAll(async () => {
  const client = new PGlite(); // Multiple instances per test file
});

test("...", async () => {
  const testDb = await createTestDatabase(); // Multiplies memory usage
});
```

**✅ REQUIRED PATTERN:**

```typescript
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";

test("integration test", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Shared PGlite instance, automatic cleanup
  });
});
```

**RATIONALE:** 12+ integration tests using per-test PGlite = 20+ database instances. 50-100MB per instance = 1-2GB+ total memory usage. Causes system lockups and computer freezing. Vitest workers multiply the problem (4 workers × many instances).

## Schema Modifications

**Violation**: Schema is locked, code adapts to schema.

```typescript
// ❌ NEVER - Schema is LOCKED, code adapts to schema
// Don't change schema files to fix TypeScript errors

// ✅ REQUIRED - Fix imports/code to match schema
import { collectionTypes } from "~/server/db/schema"; // not collection_types
const data = { modelId: machine.modelId }; // not model
```

**RATIONALE:** Schema defines the source of truth - code adapts to schema, not vice versa. Only exceptional circumstances justify schema modifications.

## TypeScript Safety Defeats

**Violation**: No `any`, `!.`, unsafe `as`. Use proper type guards.

```typescript
// ❌ NEVER - Defeats @tsconfig/strictest safety
const user = getUser()!.email; // Non-null assertion without justification
const data: any = await fetchData(); // Using any types
const user = data as User; // Unsafe type assertion without validation

// ✅ REQUIRED - Proper type safety
const user = getUser();
if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
console.log(user.email); // Now safe

function isUser(data: unknown): data is User {
  return typeof data === "object" && data !== null && "id" in data;
}
if (isUser(data)) {
  const user = data;
} // Safe assertion
```

**RATIONALE:** @tsconfig/strictest mode catches potential runtime errors at compile time. TypeScript safety defeats create bugs that could be prevented.

## Deep Relative Imports

**Violation**: No `../../../lib/`. Always use TypeScript aliases.

```typescript
// ❌ NEVER - Relative imports for deep paths
import { validateUser } from "../../../lib/validation/user";
import { SEED_TEST_IDS } from "../../test/constants/seed-test-ids";

// ✅ REQUIRED - Always use TypeScript aliases
import { validateUser } from "~/lib/validation/user";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
```

**RATIONALE:** Deep relative imports break when files are moved and are hard to maintain. TypeScript aliases provide consistent, refactor-safe imports.

## Seed Data Modifications

**Violation**: SEED_TEST_IDS locked for predictable debugging.

```typescript
// ❌ NEVER - Modifying locked seed data structure
const SEED_TEST_IDS = {
  USERS: {
    ADMIN: "new-admin-id", // Changing established IDs
    NEW_USER: "added-user", // Adding new test users
  },
};

// ✅ REQUIRED - Seed data is LOCKED like schema
// Code and tests adapt to existing SEED_TEST_IDS structure
// Only exceptional circumstances justify seed data changes
```

**RATIONALE:** SEED_TEST_IDS provides predictable debugging foundation - changing IDs breaks test reliability and debugging workflows.

## Missing Return Types

**Violation**: Complex functions need explicit return types.

```typescript
// ❌ NEVER - Missing explicit return types on complex functions
export async function createIssue(data) {
  // No return type
  return await db.insert(issues).values(data);
}

// ✅ REQUIRED - Explicit return types prevent inference errors
export async function createIssue(data: CreateIssueInput): Promise<Issue> {
  return await db.insert(issues).values(data).returning();
}
```

**RATIONALE:** Complex functions without explicit return types cause TypeScript inference errors and make refactoring dangerous.

## Missing Org Scoping

**Violation**: Always scope queries by organizationId to prevent data leakage.

```typescript
// ❌ MISSING SCOPING - Data leakage risk
const issues = await db.query.issues.findMany();

// ✅ REQUIRED - Always scope by organization
const issues = await db.query.issues.findMany({
  where: eq(issues.organizationId, ctx.organizationId),
});
```

**RATIONALE:** Multi-tenant applications must scope all queries by organization to prevent cross-organization data leakage.

## API Security Holes

**Violation**: Use protectedProcedure, not publicProcedure. Generic errors leak information.

```typescript
// ❌ NEVER - Missing authentication in protected procedures
export const userRouter = createTRPCRouter({
  getProfile: publicProcedure.query(async ({ ctx }) => {
    return await getUserProfile(ctx.session.user.id); // No auth check!
  }),
});

// ❌ NEVER - Generic error messages leak information
throw new Error("User not found"); // Reveals data existence

// ✅ REQUIRED - Proper auth + security-aware errors
export const userRouter = createTRPCRouter({
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    // Auth automatically enforced by protectedProcedure
  }),
});

throw new TRPCError({
  code: "NOT_FOUND",
  message: "Resource not found or access denied",
});
```

**RATIONALE:** API security requires proper authentication and non-leaking error messages to prevent information disclosure.

## RLS Track Mixing

**Violation**: pgTAP tests RLS policies. PGlite bypasses RLS. Don't mix.

```typescript
// ❌ NEVER - Mixing pgTAP RLS patterns with PGlite business logic patterns
// Track 1 (pgTAP RLS): Must set session context for actual RLS policy testing
test("RLS policy blocks cross-org access", async () => {
  await withIsolatedTest(workerDb, async (db) => {
    // Wrong - PGlite helper in pgTAP test
    // This bypasses RLS - defeats the point of RLS testing
  });
});

// ❌ NEVER - Missing session context in pgTAP RLS tests (Track 1)
// In supabase/tests/rls/ - testing actual RLS policies
await db.insert(issues).values({ title: "test" }); // No user context set

// ❌ NEVER - Trying to set RLS context in PGlite business logic tests (Track 2)
test("business logic", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    await db.execute(sql`SET session.user_id = '${userId}'`); // Wrong - RLS is bypassed
  });
});

// ✅ REQUIRED - Correct dual-track patterns
// Track 1 (pgTAP RLS): Native PostgreSQL with session context
await db.execute(sql`SET session.user_id = '${userId}'`);
await db.execute(sql`SET session.organization_id = '${orgId}'`);
await db.insert(issues).values({ title: "test" }); // Now tests actual RLS policy

// Track 2 (PGlite Business Logic): RLS bypassed, use worker-scoped helpers
test("business logic", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // RLS bypassed via integration_tester role - 5x faster
    await db.insert(issues).values({ title: "test", organizationId: "org-1" });
  });
});
```

**RATIONALE:** Track 1 (pgTAP RLS) tests security policies with RLS enabled. Track 2 (PGlite) tests business logic with RLS bypassed for performance. Mixing patterns defeats the purpose of each track.

## Wrong Test Archetypes

**Violation**: Pure functions don't use DB. Integration uses workerDb. tRPC uses mocks.

```typescript
// ❌ NEVER - Wrong archetype for test purpose
// Pure Function Tests: Should not use database or external dependencies
test("pure function", async ({ workerDb }) => {
  // Wrong - DB in pure function test
  expect(calculateTotal(await db.getValues())).toBe(6); // External dependency
});

// Integration Tests: Must use { workerDb } fixture with worker-scoped pattern
test("integration test", () => {
  // Wrong - Missing workerDb fixture
  const db = new PGlite(); // Wrong - Creating own DB instance
  expect(await db.insert(issues).values(data)).toBeTruthy();
});

// tRPC Router Tests: Must use mock contexts, not real database
test("tRPC router", async ({ workerDb }) => {
  // Wrong - Real DB instead of mocks
  const caller = createCaller({ db: workerDb });
});

// ✅ REQUIRED - Correct archetype patterns
// Archetype 1: Pure Function - No external dependencies
test("calculateTotal pure function", () => {
  expect(calculateTotal([1, 2, 3])).toBe(6); // Pure computation only
});

// Archetype 3: PGlite Integration - Use worker-scoped database
test("issue creation integration", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Proper worker-scoped pattern
  });
});

// Archetype 5: tRPC Router - Use mock contexts
test("tRPC issue router", () => {
  const mockCtx = createMockContext({ userId: "test-user" });
  const caller = createCaller(mockCtx); // Mock context, not real DB
});
```

**RATIONALE:** Each of the 8 test archetypes has specific patterns that ensure architectural correctness and prevent anti-patterns. Wrong archetype usage breaks quality gates and defeats testing purpose.

## snake_case Variables

**Violation**: Use camelCase TypeScript variables, snake_case DB names.

```typescript
// ❌ NEVER - snake_case TypeScript variable names
const user_profiles = pgTable("user_profiles", {
  user_id: varchar("user_id"),
});

// ✅ REQUIRED - camelCase TypeScript variables, snake_case DB names (Drizzle standard)
const userProfiles = pgTable("user_profiles", {
  userId: varchar("user_id"), // TypeScript camelCase, DB snake_case
  createdAt: timestamp("created_at"),
  organizationId: varchar("organization_id"),
});
```

**RATIONALE:** Drizzle expects camelCase TypeScript variable names but generates snake_case database table/column names. This is the standard Drizzle pattern - mixing these conventions breaks type inference and query generation.
