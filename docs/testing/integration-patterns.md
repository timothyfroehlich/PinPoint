# Integration Testing Patterns (Phase 3.3 Enhanced)

**Status**: ✅ **Updated with Phase 3.3 Validation** - Two proven integration approaches documented  
**Enhanced**: August 2025 with systematic implementation results  
**Current System**: Dual archetype approach validated through Phase 3.3

---

## 🎯 **Phase 3.3 Validated Integration Approaches**

Two proven patterns emerged from systematic Phase 3.3 implementation:

### **Archetype 5: tRPC Router Integration with Mocks**

✅ **Validated in Phase 3.3a (Issue Management) & 3.3e (Service Layer)**

- **Performance**: Fast execution (200-400ms per test)
- **Reliability**: 22/22 tests passing in `issue.comment.test.ts`
- **Memory Usage**: Minimal (no database instances)
- **Best for**: Complex router logic, permission scenarios, rapid feedback

**Core Pattern**:

```typescript
import { createVitestMockContext } from "~/test/vitestMockContext";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

// Consistent mock data with SEED_TEST_IDS
const mockContext = createVitestMockContext({
  user: {
    id: SEED_TEST_IDS.USERS.ADMIN,
    user_metadata: {
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      role: "admin",
    },
  },
});

// Simulated RLS behavior via mocks
const caller = appRouter.createCaller(mockContext);
```

### **Archetype 3: PGlite Integration RLS-Enhanced**

✅ **Validated in Phase 3.3b (Machine/Location) & 3.3c (Admin/Infrastructure)**

- **Reality**: Real database operations with full constraints
- **Validation**: True organizational boundary enforcement
- **Memory Safety**: Worker-scoped patterns prevent system lockups
- **⚠️ Requires**: Proper RLS context establishment (lessons from machine.owner failures)
- **Best for**: Complex workflows, constraint validation, end-to-end verification

**Core Pattern**:

```typescript
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

test("real database integration", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Use seeded organizations - no setup needed
    const primaryOrgId = SEED_TEST_IDS.ORGANIZATIONS.primary;
    const { ctx } = await createTestContext(db, primaryOrgId);
    const caller = appRouter.createCaller(ctx);

    // Real database operations with actual constraints
    const result = await caller.issues.create({
      title: "Test Issue",
      description: "Integration test with seed data",
    });

    // Verify in actual database with predictable seeded context
    const dbRecord = await db.query.issues.findFirst({
      where: eq(schema.issues.id, result.id),
    });
    expect(dbRecord).toBeDefined();
    expect(dbRecord.organizationId).toBe(primaryOrgId);
  });
});
```

---

## 🚨 **Critical Memory Safety Patterns (Phase 3.3 Validated)**

**❌ NEVER USE** (causes system lockups):

```typescript
beforeEach(async () => {
  const { db } = await createSeededTestDatabase(); // 50-100MB per test - DANGEROUS
});
```

**✅ ALWAYS USE** (memory-safe, Phase 3.3 proven):

```typescript
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";

test("memory-safe pattern", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Shared worker-scoped instance, transaction isolation
  });
});
```

---

## 📊 **Phase 3.3 Implementation Lessons**

### **RLS Context Establishment (Critical Learning)**

**Issue Identified**: Machine owner tests failing due to improper RLS context setup  
**Symptoms**: Tests expect `NOT_FOUND` but operations succeed across organizations  
**Root Cause**: RLS context not properly established in real PGlite tests

**❌ Problematic Pattern**:

```typescript
// Real PGlite without proper RLS context
const result = await caller.assignOwner({
  machineId: "other-org-machine",
  ownerId: testUser2.id,
});
// Expected: TRPCError NOT_FOUND
// Actual: Operation succeeds (RLS not enforced)
```

**✅ Required Fix Pattern**:

```typescript
// Proper RLS context establishment needed
await withIsolatedTest(workerDb, async (db) => {
  // Set RLS context BEFORE operations
  await db.execute(sql`SET app.current_organization_id = ${organizationId}`);
  await db.execute(sql`SET app.current_user_id = ${userId}`);

  const caller = appRouter.createCaller(contextWithRLS);
  // Now RLS boundaries properly enforced
});
```

### **SEED_TEST_IDS Success Pattern**

**Proven in Phase 3.3e**: Complete standardization across service layer tests

```typescript
import {
  SEED_TEST_IDS,
  createMockAdminContext,
} from "~/test/constants/seed-test-ids";

// Consistent test IDs across all patterns
export const mockData = {
  organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
  userId: SEED_TEST_IDS.MOCK_PATTERNS.USER,
  machineId: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
};

// Helper for consistent mock context
const mockContext = createMockAdminContext();
// Uses: organizationId: "test-org-pinpoint", userId: "test-user-tim"
```

**Benefits Validated**:

- Predictable debugging ("mock-org-1 is failing" vs random UUIDs)
- Stable test relationships
- Cross-language consistency (TypeScript → SQL → Seed data)

---

## 🎯 **Archetype Selection Guide (Phase 3.3 Updated)**

**Use Archetype 5 (Mocked tRPC Router) when**:

- Testing complex router logic
- Permission scenario validation
- Rapid feedback needed
- Complex organizational boundary simulation

**Use Archetype 3 (Real PGlite) when**:

- Testing database constraints
- Multi-table workflow validation
- True organizational boundary enforcement needed
- End-to-end verification required

---

## 🚨 **Memory Safety Alert (Phase 3.3 Confirmed)**

This file now contains **validated safe patterns** from Phase 3.3. Use the documented worker-scoped patterns.

**👉 [archetype-integration-testing.md](./archetype-integration-testing.md)** - Complete archetype documentation

**Phase 3.3 Validated Benefits**:

- **🚨 Memory safety confirmed** (prevents 1-2GB+ memory usage and system lockups)
- **Worker-scoped PGlite patterns** (MANDATORY for Archetype 3)
- **RLS session context management** (requires proper setup for real PGlite)
- **Agent assignment validated** (`integration-test-architect`)
- **Conversion procedures proven** through systematic implementation

---

## Legacy Content (For Reference Only - DANGEROUS PATTERNS)

The content below contains **dangerous memory patterns** and is **deprecated**. Use the archetype system instead.

---

## Overview

Integration tests in PinPoint use **PGlite in-memory PostgreSQL** for fast, reliable database testing with dedicated Vitest project configuration. This approach provides confidence that features work correctly with actual database constraints, referential integrity, and multi-table operations.

## Core Principles

1. **Real Database**: Use PGlite in-memory PostgreSQL (preferred) or Supabase local for E2E
2. **Fast Execution**: PGlite provides real database behavior without Docker overhead
3. **Dedicated Project**: Separate Vitest project configuration for integration tests
4. **Transaction Isolation**: Each test runs in a clean database instance
5. **Minimal Mocking**: Only mock external services (email, APIs)
6. **User Journey Focus**: Test complete workflows with real constraints
7. **Referential Integrity**: Validate foreign keys, constraints, cascades

## Vitest Project Configuration

Integration tests run in a dedicated Vitest project:

```typescript
// vitest.config.ts - Integration project
{
  test: {
    name: "integration",
    globals: true,
    environment: "node",
    setupFiles: ["src/test/vitest.integration.setup.ts"], // No database mocking
    typecheck: {
      tsconfig: "./tsconfig.tests.json",
    },
    poolOptions: {
      threads: { singleThread: true }, // Prevent connection conflicts
    },
    include: [
      "src/integration-tests/**/*.test.{ts,tsx}",
    ],
  },
}
```

## PGlite Integration Testing (Recommended)

### PGlite Setup Pattern

**Reference Implementation**: `src/integration-tests/location.integration.test.ts`

PGlite provides real PostgreSQL behavior in-memory for fast, reliable integration testing:

```typescript
// test/helpers/pglite-test-setup.ts
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "~/server/db/schema";

export type TestDatabase = ReturnType<typeof drizzle<typeof schema>>;

export async function createSeededTestDatabase() {
  // Create fresh in-memory PostgreSQL database
  const client = new PGlite();
  const db = drizzle(client, { schema });

  // Apply real schema migrations
  await migrate(db, { migrationsFolder: "drizzle" });

  // Create minimal seed data
  const orgId = await createTestOrganization(db);
  await createTestUsers(db, orgId);
  await createTestMachinesAndIssues(db, orgId);

  return { db, organizationId: orgId };
}

export async function getSeededTestData(db: TestDatabase, orgId: string) {
  // Query actual seeded IDs from database
  const location = await db.query.locations.findFirst({
    where: eq(schema.locations.organizationId, orgId),
  });

  return {
    organization: orgId,
    location: location?.id,
    // ... other test data IDs
  };
}
```

### Integration Test Structure

```typescript
// src/integration-tests/admin.integration.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminRouter } from "~/server/api/routers/admin";
import {
  createSeededTestDatabase,
  getSeededTestData,
} from "~/test/helpers/pglite-test-setup";

describe("Admin Router Integration (PGlite)", () => {
  let db: TestDatabase;
  let context: TRPCContext;
  let caller: ReturnType<typeof adminRouter.createCaller>;
  let testData: SeededTestData;

  beforeEach(async () => {
    // Fresh database for each test
    const setup = await createSeededTestDatabase();
    db = setup.db;
    testData = await getSeededTestData(db, setup.organizationId);

    // Create test context with real database
    context = {
      user: { id: testData.user, organizationId: testData.organization },
      organization: { id: testData.organization },
      drizzle: db, // Real database, not mocked
      // ... other context setup
    };

    caller = adminRouter.createCaller(context);
  });

  it("should create user with real database constraints", async () => {
    const result = await caller.createUser({
      name: "New User",
      email: "newuser@example.com",
    });

    // Verify in actual database
    const dbUser = await db.query.users.findFirst({
      where: eq(schema.users.id, result.id),
    });

    expect(dbUser).toBeDefined();
    expect(dbUser?.organizationId).toBe(testData.organization);
  });
});
```

### Database Connection Helpers

```typescript
// src/test/integration-helpers.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

// Real database connection (no mocking)
const testDbUrl = process.env.DATABASE_URL!; // From .env.test
export const testSql = postgres(testDbUrl, { max: 1 });
export const testDb = drizzle(testSql);

// Supabase clients for integration testing
export const testSupabaseAdmin = createClient(
  process.env.SUPABASE_URL ?? "http://localhost:54321",
  process.env.SUPABASE_SECRET_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
```

### Transaction Test Wrapper

```typescript
// src/test/transaction-wrapper.ts
import { testDb } from "./integration-setup";

export async function withTransaction<T>(
  testFn: (tx: typeof testDb) => Promise<T>,
): Promise<T> {
  return await testDb.transaction(async (tx) => {
    try {
      return await testFn(tx);
    } finally {
      // Transaction automatically rolls back
      await tx.rollback();
    }
  });
}

// Usage in tests
it("creates issue with proper scoping", async () => {
  await withTransaction(async (tx) => {
    const issue = await createIssue(tx, { title: "Test" });
    expect(issue).toBeDefined();
    // All changes rolled back after test
  });
});
```

## Testing Patterns

### tRPC Procedure Testing

```typescript
// src/server/api/routers/__tests__/issue.integration.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "~/server/api/root";
import { withTransaction } from "~/test/transaction-wrapper";
import { createTestContext } from "~/test/context-helpers";

describe("Issue Router Integration", () => {
  let testOrgId: string;
  let testUserId: string;

  beforeEach(async () => {
    // Setup test data
    const { organization, user } = await setupTestOrganization();
    testOrgId = organization.id;
    testUserId = user.id;
  });

  it("creates issue with all relationships", async () => {
    await withTransaction(async (tx) => {
      // Create test context with real session
      const ctx = await createTestContext({
        db: tx,
        userId: testUserId,
        organizationId: testOrgId,
        permissions: ["issue:create"],
      });

      const caller = appRouter.createCaller(ctx);

      // Create machine first
      const machine = await caller.machine.create({
        modelId: "test-model",
        locationId: "test-location",
        serialNumber: "TEST-001",
      });

      // Create issue
      const issue = await caller.issue.create({
        title: "Test Issue",
        description: "Integration test",
        machineId: machine.id,
        priorityId: "medium",
      });

      expect(issue.title).toBe("Test Issue");
      expect(issue.organizationId).toBe(testOrgId);
      expect(issue.createdById).toBe(testUserId);

      // Verify relationships
      const fullIssue = await caller.issue.getById({ id: issue.id });
      expect(fullIssue.machine.id).toBe(machine.id);
      expect(fullIssue.createdBy.id).toBe(testUserId);
    });
  });

  it("enforces organization isolation", async () => {
    await withTransaction(async (tx) => {
      // Create issue in org1
      const ctx1 = await createTestContext({
        db: tx,
        organizationId: "org1",
        permissions: ["issue:create", "issue:view"],
      });

      const caller1 = appRouter.createCaller(ctx1);
      const issue1 = await caller1.issue.create({
        title: "Org1 Issue",
        machineId: "machine1",
      });

      // Try to access from org2
      const ctx2 = await createTestContext({
        db: tx,
        organizationId: "org2",
        permissions: ["issue:view"],
      });

      const caller2 = appRouter.createCaller(ctx2);

      // Should not see org1's issue
      await expect(caller2.issue.getById({ id: issue1.id })).rejects.toThrow(
        "not found",
      );

      // List should be empty
      const issues = await caller2.issue.getAll();
      expect(issues).toHaveLength(0);
    });
  });
});
```

### Multi-Table Operations

```typescript
describe("Issue Workflow Integration", () => {
  it("completes full issue lifecycle", async () => {
    await withTransaction(async (tx) => {
      const ctx = await createTestContext({
        db: tx,
        permissions: ["issue:create", "issue:edit", "issue:assign"],
      });

      const caller = appRouter.createCaller(ctx);

      // 1. Create issue
      const issue = await caller.issue.create({
        title: "Broken flipper",
        machineId: testMachineId,
      });

      // 2. Add comment
      const comment = await caller.comment.create({
        issueId: issue.id,
        content: "Confirmed broken, needs part",
      });

      // 3. Assign to technician
      const assigned = await caller.issue.assign({
        issueId: issue.id,
        userId: technicianId,
      });

      // 4. Update status
      const updated = await caller.issue.updateStatus({
        id: issue.id,
        statusId: inProgressStatusId,
      });

      // 5. Verify activity log
      const activities = await caller.activity.getForIssue({
        issueId: issue.id,
      });

      expect(activities).toHaveLength(4); // Created, commented, assigned, status
      expect(activities[0].action).toBe("created");
      expect(activities[1].action).toBe("commented");
      expect(activities[2].action).toBe("assigned");
      expect(activities[3].action).toBe("status_changed");

      // 6. Close issue
      const closed = await caller.issue.close({ id: issue.id });
      expect(closed.status.category).toBe("RESOLVED");
      expect(closed.resolvedAt).toBeDefined();
    });
  });
});
```

### RLS Policy Testing (Modern Pattern)

Using memory-safe PGlite with SEED_TEST_IDS and RLS session helpers:

```typescript
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

test("RLS enforces organizational boundaries", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Use seeded organizations for predictable testing
    const primaryOrgId = SEED_TEST_IDS.ORGANIZATIONS.primary;
    const competitorOrgId = SEED_TEST_IDS.ORGANIZATIONS.competitor;

    // Create data in primary org context
    const { ctx: primaryCtx } = await createTestContext(db, primaryOrgId);
    const primaryCaller = appRouter.createCaller(primaryCtx);
    const primaryIssue = await primaryCaller.issues.create({
      title: "Primary Org Confidential Issue",
      priority: "high",
    });

    // Create data in competitor org context
    const { ctx: competitorCtx } = await createTestContext(db, competitorOrgId);
    const competitorCaller = appRouter.createCaller(competitorCtx);
    const competitorIssue = await competitorCaller.issues.create({
      title: "Competitor Org Confidential Issue",
      priority: "low",
    });

    // Verify complete isolation - competitor context only sees competitor data
    const competitorVisibleIssues = await competitorCaller.issues.getAll();
    expect(competitorVisibleIssues).toHaveLength(1);
    expect(competitorVisibleIssues[0].id).toBe(competitorIssue.id);
    expect(competitorVisibleIssues[0].organizationId).toBe(competitorOrgId);

    // Primary context only sees primary data
    const primaryVisibleIssues = await primaryCaller.issues.getAll();
    expect(primaryVisibleIssues).toHaveLength(1);
    expect(primaryVisibleIssues[0].id).toBe(primaryIssue.id);
    expect(primaryVisibleIssues[0].organizationId).toBe(primaryOrgId);
  });
});

test("cross-org boundary testing with seeded orgs", async ({ workerDb }) => {
  await withCrossOrgTest(
    workerDb,
    [
      { orgId: SEED_TEST_IDS.ORGANIZATIONS.primary, role: "admin" },
      { orgId: SEED_TEST_IDS.ORGANIZATIONS.competitor, role: "member" },
    ],
    async (contexts, db) => {
      // Start in primary org as admin
      const [primaryCaller, competitorCaller] = contexts;

      await primaryCaller.issues.create({ title: "Primary Admin Issue" });
      await competitorCaller.issues.create({
        title: "Competitor Member Issue",
      });

      // Each context only sees their own org's data
      const competitorIssues = await competitorCaller.issues.getAll();
      expect(competitorIssues).toHaveLength(1);
      expect(competitorIssues[0].title).toBe("Competitor Member Issue");
      expect(competitorIssues[0].organizationId).toBe(
        SEED_TEST_IDS.ORGANIZATIONS.competitor,
      );
    },
  );
});
```

### Legacy Pattern (Pre-RLS)

For reference, the old manual filtering approach:

```typescript
describe("Manual Organization Filtering (Legacy)", () => {
  it("required complex manual checks", async () => {
    // OLD: Manual organizationId coordination everywhere
    const issues = await db.query.issues.findMany({
      where: and(
        eq(issues.organizationId, ctx.organization.id), // Manual filter
        eq(issues.statusId, input.statusId),
      ),
    });

    // OLD: Manual validation required
    expect(issues.every((i) => i.organizationId === ctx.organization.id)).toBe(
      true,
    );
  });
});
```

### Service Integration Testing

```typescript
describe("Notification Service Integration", () => {
  it("sends notifications through complete workflow", async () => {
    await withTransaction(async (tx) => {
      // Mock only external email service
      const emailSpy = vi.spyOn(emailService, "send").mockResolvedValue({
        success: true,
      });

      const notificationService = new NotificationService(tx);

      // Create real data
      const [machine] = await tx
        .insert(machines)
        .values({
          modelId: "test-model",
          locationId: "test-location",
          ownerId: testUserId,
        })
        .returning();

      const [issue] = await tx
        .insert(issues)
        .values({
          title: "Test Issue",
          machineId: machine.id,
          organizationId: testOrgId,
          statusId: "new",
        })
        .returning();

      // Test notification
      await notificationService.notifyMachineOwnerOfIssue(issue.id, machine.id);

      // Verify email sent with correct data
      expect(emailSpy).toHaveBeenCalledWith({
        to: expect.any(String),
        subject: expect.stringContaining("Test Issue"),
        body: expect.stringContaining(machine.id),
      });

      // Verify notification record created
      const [notification] = await tx
        .select()
        .from(notifications)
        .where(eq(notifications.issueId, issue.id));

      expect(notification).toBeDefined();
      expect(notification.userId).toBe(testUserId);
      expect(notification.type).toBe("new_issue");
    });
  });
});
```

## Test Data Factories

```typescript
// src/test/factories/organization-factory.ts
import { faker } from "@faker-js/faker";
import { testDb } from "../integration-setup";

export async function createTestOrganization(
  overrides: Partial<OrganizationInput> = {},
) {
  const org = await testDb
    .insert(organizations)
    .values({
      name: faker.company.name(),
      slug: faker.helpers.slugify(faker.company.name()),
      ...overrides,
    })
    .returning();

  // Create default statuses, priorities, etc.
  await createDefaultOrgData(org[0].id);

  return org[0];
}

export async function createTestUser(
  organizationId: string,
  overrides: Partial<UserInput> = {},
) {
  const user = await testDb
    .insert(users)
    .values({
      email: faker.internet.email(),
      name: faker.person.fullName(),
      ...overrides,
    })
    .returning();

  // Create membership
  await testDb.insert(memberships).values({
    userId: user[0].id,
    organizationId,
    roleId: overrides.roleId ?? "member",
  });

  return user[0];
}

// Use in tests
const org = await createTestOrganization({ name: "Test Arcade" });
const admin = await createTestUser(org.id, { roleId: "admin" });
```

## Performance Testing

```typescript
describe("Performance Integration Tests", () => {
  it("handles large datasets efficiently", async () => {
    await withTransaction(async (tx) => {
      // Create many issues
      const issueData = Array.from({ length: 1000 }, (_, i) => ({
        title: `Issue ${i}`,
        organizationId: testOrgId,
        machineId: testMachineId,
        statusId: "new",
      }));

      await tx.insert(issues).values(issueData);

      // Test query performance
      const start = performance.now();

      const results = await tx
        .select()
        .from(issues)
        .where(
          and(eq(issues.organizationId, testOrgId), eq(issues.statusId, "new")),
        )
        .limit(50);

      const duration = performance.now() - start;

      expect(results).toHaveLength(50);
      expect(duration).toBeLessThan(100); // Should be fast with indexes
    });
  });
});
```

## Best Practices

1. **Use transactions** for automatic cleanup
2. **Test user journeys** not individual functions
3. **Verify RLS policies** in every security-sensitive test
4. **Create realistic test data** with factories
5. **Mock only external services** (email, SMS, APIs)
6. **Test error cases** and edge conditions
7. **Keep tests independent** - no shared state

## Common Pitfalls

### Running Integration Tests Without Database

```typescript
// ❌ BAD: Expecting tests to skip
// Integration tests will fail hard if database unavailable

// ✅ GOOD: Ensure Supabase is running
// Run `supabase start` before integration tests
// Check `supabase status` to verify
```

### Mixing Unit and Integration Test Patterns

```typescript
// ❌ BAD: Using mocks in integration tests
it("creates issue", async () => {
  // This is in src/integration-tests/ but trying to mock
  vi.mock("~/server/db/drizzle"); // Wrong for integration tests!
});

// ✅ GOOD: Use real database in integration tests
it("creates issue", async () => {
  // No mocking - real database operations
  const db = createDrizzleClient();
  const issue = await db.insert(issues).values({...});
});
```

### Forgetting Transaction Wrapper

```typescript
// ❌ BAD: Pollutes test database
it("creates issue", async () => {
  const issue = await db.insert(issues).values({...});
  // Data persists after test!
});

// ✅ GOOD: Automatic cleanup
it("creates issue", async () => {
  await withTransaction(async (tx) => {
    const issue = await tx.insert(issues).values({...});
    // Rolled back after test
  });
});
```

### Wrong Project Configuration

```typescript
// ❌ BAD: Integration test in wrong location
// File: src/server/api/routers/__tests__/issues.integration.test.ts
// This will run with mocked database (wrong project)

// ✅ GOOD: Integration test in correct location
// File: src/integration-tests/issues.integration.test.ts
// This will run with real database (integration project)
```

## Running Integration Tests

### Prerequisites

**PGlite Integration Tests (Recommended):**

- No external dependencies - runs completely in-memory
- Fast execution (typically <2 seconds per test file)
- Perfect for router testing and database constraint validation

**Supabase Docker Integration Tests (E2E only):**

1. **Supabase must be running locally:**

   ```bash
   supabase status    # Check status
   supabase start     # Start if needed
   ```

2. **Environment configured:**
   - `.env.test` file with correct `DATABASE_URL`
   - Environment loaded with `override: true` by `src/lib/env-loaders/test.ts`

### Commands

```bash
# Run PGlite integration tests (fast)
npm run test src/integration-tests/

# Run specific PGlite integration test
npm run test src/integration-tests/location.integration.test.ts

# Run all integration tests (PGlite + Supabase Docker)
npm run test -- --project=integration

# Watch mode for integration development
npm run test src/integration-tests/ --watch
```

### Hard Failure Behavior

Integration tests **always fail hard** when database unavailable:

- ❌ **No skipping**: Tests never skip silently
- ✅ **Clear errors**: Immediate failure with helpful error messages
- ✅ **Fast feedback**: Fail at setup, not during individual tests

Example error messages:

- `"DATABASE_URL is required for integration tests. Ensure Supabase is running."`
- `"Integration tests require a real database URL, not a test/mock URL."`

## Debugging Integration Tests

```bash
# Run single integration test
npm run test -- --project=integration notification.schema.test.ts

# Enable debug output
DEBUG=* npm run test -- --project=integration

# Check database connectivity
supabase status
psql $DATABASE_URL -c "SELECT 1;"
```

## Migration from Mock-Based Tests

```typescript
// OLD: Mock everything
const mockDb = createMockDb();
const mockIssue = { id: "1", title: "Test" };
mockDb.issue.create.mockResolvedValue(mockIssue);

// NEW: Real database
await withTransaction(async (tx) => {
  const [issue] = await tx
    .insert(issues)
    .values({ title: "Test", organizationId, machineId })
    .returning();

  // Real data with real constraints!
  expect(issue.id).toBeDefined();
  expect(issue.createdAt).toBeInstanceOf(Date);
});
```
