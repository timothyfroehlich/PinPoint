# Integration Testing Patterns

## Overview

Integration tests in PinPoint use a real database with dedicated Vitest project configuration for test isolation. This approach provides confidence that features work correctly with actual database constraints, RLS policies, and multi-table operations.

## Core Principles

1. **Real Database**: Use Supabase local instance (never mocked)
2. **Hard Failures**: Tests fail immediately if database unavailable (no skipping)
3. **Dedicated Project**: Separate Vitest project configuration for integration tests
4. **Transaction Isolation**: Each test runs in a rolled-back transaction
5. **Minimal Mocking**: Only mock external services (email, APIs)
6. **User Journey Focus**: Test complete workflows
7. **RLS Validation**: Verify security policies work

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

## Test Database Setup

### Integration Test Setup

The integration test setup ensures database availability and provides real connections:

```typescript
// src/test/vitest.integration.setup.ts
import { beforeAll, afterAll, afterEach } from "vitest";

// NO database mocking - uses real Supabase database

beforeAll(async () => {
  // Hard failure if database unavailable
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required for integration tests. Ensure Supabase is running.",
    );
  }

  // Reject test/mock URLs - integration tests need real database
  if (
    process.env.DATABASE_URL.includes("test://") ||
    process.env.DATABASE_URL.includes("postgresql://test:test@")
  ) {
    throw new Error(
      "Integration tests require a real database URL, not a test/mock URL. Check .env.test configuration.",
    );
  }
});

afterEach(() => {
  // Cleanup handled by individual tests using transactions
});

afterAll(() => {
  // Global cleanup
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

### RLS Policy Testing

```typescript
describe("RLS Security Policies", () => {
  it("prevents unauthorized access patterns", async () => {
    await withTransaction(async (tx) => {
      // Setup: Create issue as admin
      const adminCtx = await createTestContext({
        db: tx,
        organizationId: testOrgId,
        permissions: ["admin"],
      });

      const adminCaller = appRouter.createCaller(adminCtx);
      const sensitiveIssue = await adminCaller.issue.create({
        title: "Security Vulnerability",
        isInternal: true,
        machineId: testMachineId,
      });

      // Test 1: Member without permission cannot see internal issues
      const memberCtx = await createTestContext({
        db: tx,
        organizationId: testOrgId,
        permissions: ["issue:view"], // No internal permission
      });

      const memberCaller = appRouter.createCaller(memberCtx);
      const memberIssues = await memberCaller.issue.getAll();

      expect(memberIssues).not.toContainEqual(
        expect.objectContaining({ id: sensitiveIssue.id }),
      );

      // Test 2: Different org cannot access at all
      const otherOrgCtx = await createTestContext({
        db: tx,
        organizationId: "other-org",
        permissions: ["admin"], // Even admin in other org
      });

      const otherOrgCaller = appRouter.createCaller(otherOrgCtx);
      await expect(
        otherOrgCaller.issue.getById({ id: sensitiveIssue.id }),
      ).rejects.toThrow();

      // Test 3: Anonymous access blocked
      const publicCtx = await createTestContext({
        db: tx,
        // No auth
      });

      const publicCaller = appRouter.createCaller(publicCtx);
      await expect(
        publicCaller.issue.getById({ id: sensitiveIssue.id }),
      ).rejects.toThrow("UNAUTHORIZED");
    });
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
# Run all integration tests
npm run test -- --project=integration

# Run specific integration test files
npm run test src/integration-tests/notification.schema.test.ts

# Run both integration test files
npm run test src/integration-tests/ src/server/db/drizzle-crud-validation.test.ts

# Watch mode for integration tests
npm run test -- --project=integration --watch
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
