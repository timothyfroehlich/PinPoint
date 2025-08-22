# Integration Testing Archetype

**Agent**: `integration-test-architect`  
**Purpose**: Full-stack integration testing with memory-safe PGlite and RLS context  
**Characteristics**: Real database operations, organizational scoping, transaction isolation  
**Critical**: Memory safety patterns prevent system lockups

---

## 🚨 CRITICAL: Memory Safety Requirements

**NEVER USE** (causes 1-2GB+ memory usage and system lockups):

```typescript
// ❌ FORBIDDEN: Per-test PGlite instances
beforeEach(async () => {
  const { db } = await createSeededTestDatabase(); // 50-100MB per test
});

// ❌ FORBIDDEN: Multiple PGlite instances
test("...", async () => {
  const testDb = await new PGlite(); // Multiplies memory usage
});
```

**ALWAYS USE** (memory-safe, prevents lockups):

```typescript
// ✅ MANDATORY: Worker-scoped pattern
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";

test("integration test", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Single shared PGlite instance, transaction isolation
  });
});
```

---

## When to Use This Archetype

✅ **Perfect for**:

- Database queries and constraints
- Service layer business logic (with database)
- tRPC router operations
- Multi-table operations
- Complete user workflows
- Schema constraint validation
- RLS context testing

❌ **Wrong archetype for**:

- Pure functions → Use Unit Testing Archetype
- UI component rendering → Use Unit Testing Archetype
- Security boundaries → Use Security Testing Archetype
- RLS policy validation → Use Security Testing Archetype

---

## Core Principles

1. **Memory Safety**: ALWAYS use worker-scoped PGlite pattern
2. **RLS Context**: Establish organizational session context
3. **Transaction Isolation**: Each test gets clean database state
4. **Real Operations**: Use actual database with real constraints
5. **Minimal Mocking**: Only mock external services (email, APIs)

---

## Memory Safety Architecture (MANDATORY)

### Worker-Scoped PGlite Pattern

```typescript
// test/helpers/worker-scoped-db.ts
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "~/db/schema";

// Single PGlite instance per worker (NOT per test)
let workerDb: ReturnType<typeof drizzle> | null = null;

export async function getWorkerDb() {
  if (!workerDb) {
    const client = new PGlite(); // ONE instance per worker
    workerDb = drizzle(client, { schema });

    // Run migrations once
    await runMigrations(workerDb);
  }
  return workerDb;
}

// Transaction isolation for test cleanup
export async function withIsolatedTest<T>(
  db: ReturnType<typeof drizzle>,
  testFn: (db: ReturnType<typeof drizzle>) => Promise<T>,
): Promise<T> {
  return await db
    .transaction(async (tx) => {
      try {
        return await testFn(tx);
      } finally {
        // Transaction rollback provides automatic cleanup
        throw new Error("Test transaction rollback");
      }
    })
    .catch((error) => {
      if (error.message === "Test transaction rollback") {
        return; // Expected rollback
      }
      throw error; // Re-throw actual errors
    });
}

// Vitest test helper with proper types
export const test = vitest.test.extend<{
  workerDb: ReturnType<typeof drizzle>;
}>({
  workerDb: async ({}, use) => {
    const db = await getWorkerDb();
    await use(db);
  },
});
```

### Memory Safety Guidelines

**✅ ALWAYS USE:**

- Worker-scoped PGlite instances (one per worker)
- Transaction-based test isolation
- Automatic cleanup via rollback

**❌ NEVER USE:**

- `new PGlite()` in individual tests (50-100MB each)
- `createSeededTestDatabase()` per test (memory blowout)
- External database containers (slow, complex)

---

## Pattern 1: Service Business Logic with RLS

### RLS Session Context Management

```typescript
// Standard session setup for all tests
async function setTestSession(
  db: ReturnType<typeof drizzle>,
  orgId: string,
  userId?: string,
  role?: string,
) {
  await db.execute(sql`SET app.current_organization_id = ${orgId}`);

  if (userId) {
    await db.execute(sql`SET app.current_user_id = ${userId}`);
  }

  if (role) {
    await db.execute(sql`SET app.current_user_role = ${role}`);
  }
}

// Test helper for common scenarios
export const testSessions = {
  admin: (db: any, orgId: string) =>
    setTestSession(db, orgId, "admin-user", "admin"),

  member: (db: any, orgId: string) =>
    setTestSession(db, orgId, "member-user", "member"),

  anonymous: (db: any, orgId: string) => setTestSession(db, orgId),
};
```

### SEED_TEST_IDS Integration (RECOMMENDED)

**Use hardcoded, predictable IDs** from the seed data architecture for consistent testing:

```typescript
import {
  SEED_TEST_IDS,
  createMockAdminContext,
} from "~/test/constants/seed-test-ids";
// Use SEED_TEST_IDS constants directly - no import needed

// ✅ PREFERRED: Use seed constants for organizational context
test("integration test with seed data", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Use hardcoded organization IDs for predictability
    await testSessions.admin(db, SEED_TEST_IDS.ORGANIZATIONS.primary);

    // Get dynamic relationship IDs from seeded data
    // Use SEED_TEST_IDS constants directly for predictable test data

    // Test with consistent, predictable IDs
    const service = new IssueService(db);
    const issue = await service.create({
      title: "Integration Test Issue",
      machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1, // Real seeded machine
      priorityId: SEED_TEST_IDS.PRIORITIES.HIGH, // Real seeded priority
    });

    expect(issue.organizationId).toBe(SEED_TEST_IDS.ORGANIZATIONS.primary);
    expect(issue.machineId).toBe(seededData.machine);
  });
});

// ✅ MULTI-ORG TESTING: Use both organizations for security boundaries
test("cross-org data isolation", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Create data in primary org
    await testSessions.admin(db, SEED_TEST_IDS.ORGANIZATIONS.primary);
    const primaryIssue = await createIssue(db, { title: "Primary Org Issue" });

    // Switch to competitor org - should not see primary org data
    await testSessions.admin(db, SEED_TEST_IDS.ORGANIZATIONS.competitor);
    const visibleIssues = await db.query.issues.findMany();

    // Verify complete isolation
    expect(visibleIssues).not.toContainEqual(primaryIssue);
    expect(visibleIssues.length).toBe(0); // No cross-contamination
  });
});
```

**Benefits of SEED_TEST_IDS approach:**

- 🎯 **Predictable debugging**: "machine-mm-001" vs random UUIDs
- 🔗 **Stable relationships**: Foreign keys never break
- 🧪 **Cross-test consistency**: Same IDs across all test types
- 🛡️ **Security testing**: Two orgs enable boundary validation

### Service Testing with RLS Benefits

```typescript
// src/services/__tests__/issueService.test.ts
import {
  test,
  withIsolatedTest,
  testSessions,
} from "~/test/helpers/worker-scoped-db";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
// Use SEED_TEST_IDS constants directly - no import needed
import { IssueService } from "../issueService";
import { sql } from "drizzle-orm";

test("calculates issue priority with RLS context", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Use hardcoded organization ID for predictability
    await testSessions.admin(db, SEED_TEST_IDS.ORGANIZATIONS.primary);

    const service = new IssueService(db);

    // Use seeded data for consistent relationships
    // Use SEED_TEST_IDS constants directly for predictable test data

    // No organizationId needed - RLS handles it automatically
    const issue = await service.createIssue({
      title: "High Priority Issue",
      machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1, // Use seeded machine
      machineDowntime: 120, // 2 hours
    });

    expect(issue.calculatedPriority).toBe("high");
    expect(issue.organizationId).toBe(SEED_TEST_IDS.ORGANIZATIONS.primary); // RLS inserted this

    // Verify automatic cleanup via transaction rollback
  });
});

test("service respects RLS organizational boundaries", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Create data in primary org
    await testSessions.admin(db, SEED_TEST_IDS.ORGANIZATIONS.primary);
    const service = new IssueService(db);

    // Use seeded data instead of creating custom data
    // Use SEED_TEST_IDS constants directly for predictable test data

    const issue1 = await service.createIssue({
      title: "Primary Org Issue",
      machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
    });

    // Switch to competitor org context
    await testSessions.admin(db, SEED_TEST_IDS.ORGANIZATIONS.competitor);

    // Service should only see competitor org data (none from primary)
    const issues = await service.getIssuesByStatus("open");
    expect(issues).toHaveLength(0); // RLS filters out primary org data

    // Get seeded data for competitor org (will be minimal)
    // Use competitor organization constants

    const issue2 = await service.createIssue({
      title: "Competitor Org Issue",
      machineId: SEED_TEST_IDS.MACHINES.AFM_COMPETITOR_1, // Use seeded competitor machine
    });

    const competitorIssues = await service.getIssuesByStatus("open");
    expect(competitorIssues).toHaveLength(1);
    expect(competitorIssues[0].title).toBe("Competitor Org Issue");
    expect(competitorIssues[0].organizationId).toBe(
      SEED_TEST_IDS.ORGANIZATIONS.competitor,
    );
  });
});
```

---

## Pattern 2: PGlite Integration Testing

### Database Constraint Validation

```typescript
// src/integration-tests/schema-constraints.integration.test.ts
import {
  test,
  withIsolatedTest,
  testSessions,
} from "~/test/helpers/worker-scoped-db";
import { sql } from "drizzle-orm";

test("foreign key constraint with RLS context", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    await testSessions.admin(db, "test-org");

    // Should fail - no machine exists
    await expect(
      db.insert(schema.issues).values({
        title: "Issue for nonexistent machine",
        machineId: "nonexistent-id",
      }),
    ).rejects.toThrow(/foreign key constraint/);

    // Create machine first
    const [machine] = await db
      .insert(schema.machines)
      .values({
        name: "Test Machine",
        model: "Stern Pinball",
      })
      .returning();

    // Should succeed - valid reference
    const [issue] = await db
      .insert(schema.issues)
      .values({
        title: "Valid issue",
        machineId: machine.id,
      })
      .returning();

    expect(issue.machineId).toBe(machine.id);
    expect(issue.organizationId).toBe("test-org"); // RLS automatic
  });
});

test("cross-organization constraint isolation", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Create machine in org-1
    await testSessions.admin(db, "org-1");
    const [org1Machine] = await db
      .insert(schema.machines)
      .values({ name: "Org 1 Machine" })
      .returning();

    // Switch to org-2 and try to reference org-1 machine
    await testSessions.admin(db, "org-2");

    // Should fail - can't reference cross-org machine due to RLS + FK
    await expect(
      db.insert(schema.issues).values({
        title: "Cross-org issue attempt",
        machineId: org1Machine.id, // References org-1 machine from org-2 context
      }),
    ).rejects.toThrow(); // RLS + foreign key violation
  });
});
```

### Complete Workflow Integration

```typescript
// src/integration-tests/issue-lifecycle.integration.test.ts
test("complete issue lifecycle with RLS", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    await testSessions.admin(db, "test-org");

    // 1. Create required entities
    const [location] = await db
      .insert(schema.locations)
      .values({
        name: "Test Location",
        address: "123 Test St",
      })
      .returning();

    const [machine] = await db
      .insert(schema.machines)
      .values({
        name: "Test Machine",
        locationId: location.id,
      })
      .returning();

    // 2. Create issue
    const [issue] = await db
      .insert(schema.issues)
      .values({
        title: "Machine malfunction",
        description: "Flipper not responding",
        machineId: machine.id,
        statusId: "new",
      })
      .returning();

    // 3. Add comment
    const [comment] = await db
      .insert(schema.comments)
      .values({
        issueId: issue.id,
        content: "Confirmed issue, ordering part",
        authorId: "admin-user",
      })
      .returning();

    // 4. Update status
    await db
      .update(schema.issues)
      .set({ statusId: "in-progress" })
      .where(eq(schema.issues.id, issue.id));

    // 5. Verify complete workflow with relational queries
    const fullIssue = await db.query.issues.findFirst({
      where: eq(schema.issues.id, issue.id),
      with: {
        machine: {
          with: {
            location: true,
          },
        },
        comments: true,
      },
    });

    expect(fullIssue).toBeDefined();
    expect(fullIssue?.machine.location.name).toBe("Test Location");
    expect(fullIssue?.comments).toHaveLength(1);
    expect(fullIssue?.comments[0].content).toContain("Confirmed issue");
    expect(fullIssue?.statusId).toBe("in-progress");

    // All data automatically scoped to test-org by RLS
    expect(fullIssue?.organizationId).toBe("test-org");
    expect(fullIssue?.machine.organizationId).toBe("test-org");
    expect(fullIssue?.machine.location.organizationId).toBe("test-org");
  });
});
```

---

## Pattern 3: tRPC Router Testing

### Router Integration with Mock Database

```typescript
// src/server/api/routers/__tests__/issue.test.ts
import { createVitestMockContext } from "~/test/vitestMockContext";
import { appRouter } from "../../root";
import type * as DbModule from "@/lib/db";

// Mock database with RLS-aware patterns
vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof DbModule>();
  return {
    ...actual,
    db: {
      execute: vi.fn(), // For RLS session context
      query: {
        issues: {
          findMany: vi.fn(),
          findFirst: vi.fn(),
        },
        machines: {
          findFirst: vi.fn(),
        },
      },
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn(),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn(),
        }),
      }),
    },
  };
});

describe("Issue Router", () => {
  const mockDb = vi.mocked((await import("@/lib/db")).db);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates issue with automatic RLS scoping", async () => {
    // Mock context with RLS-aware user
    const mockCtx = createVitestMockContext({
      user: {
        id: "test-user",
        user_metadata: {
          organizationId: "test-org",
          role: "admin",
        },
      },
    });

    // Mock machine lookup (validates machine exists in org)
    mockDb.query.machines.findFirst.mockResolvedValue({
      id: "machine-1",
      name: "Test Machine",
      organizationId: "test-org",
    });

    // Mock issue creation
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: "issue-1",
            title: "Test Issue",
            machineId: "machine-1",
            organizationId: "test-org", // RLS would set this
            createdById: "test-user",
          },
        ]),
      }),
    });

    const caller = appRouter.createCaller(mockCtx);

    // No organizationId needed in input - RLS handles it
    const result = await caller.issues.create({
      title: "Test Issue",
      machineId: "machine-1",
      description: "Test Description",
    });

    expect(result.title).toBe("Test Issue");
    expect(result.organizationId).toBe("test-org");

    // Verify RLS session was established
    expect(mockDb.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        sql: expect.stringContaining("SET app.current_organization_id"),
      }),
    );

    // Verify machine was validated within organization
    expect(mockDb.query.machines.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        // Should include both machine ID and org validation
      }),
    });
  });

  it("enforces organizational boundaries in queries", async () => {
    const mockCtx = createVitestMockContext({
      user: {
        id: "test-user",
        user_metadata: {
          organizationId: "test-org",
          role: "member",
        },
      },
    });

    // Mock RLS-filtered results
    mockDb.query.issues.findMany.mockResolvedValue([
      {
        id: "issue-1",
        title: "Org Issue",
        organizationId: "test-org",
      },
    ]);

    const caller = appRouter.createCaller(mockCtx);
    const result = await caller.issues.getAll();

    expect(result).toHaveLength(1);
    expect(result[0].organizationId).toBe("test-org");

    // Verify RLS context was set
    expect(mockDb.execute).toHaveBeenCalledWith(
      expect.stringContaining("SET app.current_organization_id"),
    );
  });

  it("rejects operations on cross-org resources", async () => {
    const mockCtx = createVitestMockContext({
      user: {
        id: "test-user",
        user_metadata: {
          organizationId: "test-org",
          role: "admin",
        },
      },
    });

    // Mock machine not found (due to cross-org access)
    mockDb.query.machines.findFirst.mockResolvedValue(null);

    const caller = appRouter.createCaller(mockCtx);

    await expect(
      caller.issues.create({
        title: "Cross-org issue",
        machineId: "other-org-machine", // Machine from different org
      }),
    ).rejects.toThrow("Machine not found");
  });
});
```

---

## Pattern 4: "Fake Integration" Conversion

### Transform Direct Service Calls to tRPC Integration

**BEFORE (Problematic "Fake Integration")**:

```typescript
// ❌ Direct service testing bypasses tRPC and RLS
describe("CommentService", () => {
  let commentService: CommentService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = createMockDatabase();
    commentService = new CommentService(mockDb);
  });

  test("creates comment", async () => {
    const result = await commentService.createComment({
      issueId: "issue-1",
      content: "Test comment",
      userId: "user-1",
      organizationId: "org-1", // Manual coordination required
    });

    expect(result.content).toBe("Test comment");
  });
});
```

**AFTER (Proper tRPC Integration)**:

```typescript
// ✅ Full-stack tRPC integration with RLS
import {
  test,
  withIsolatedTest,
  testSessions,
} from "~/test/helpers/worker-scoped-db";
import { createTRPCCaller } from "~/test/helpers/trpc-caller";

test("creates comment via tRPC with RLS", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Set RLS context
    await testSessions.admin(db, "test-org");

    // Create test issue first
    const [machine] = await db
      .insert(schema.machines)
      .values({ name: "Test Machine" })
      .returning();

    const [issue] = await db
      .insert(schema.issues)
      .values({
        title: "Test Issue",
        machineId: machine.id,
      })
      .returning();

    // Test via tRPC caller - respects RLS
    const caller = createTRPCCaller(db, {
      user: {
        id: "test-user",
        user_metadata: { organizationId: "test-org", role: "admin" },
      },
    });

    const result = await caller.comments.create({
      issueId: issue.id,
      content: "Test comment",
      // No manual organizationId - RLS handles it
    });

    expect(result.content).toBe("Test comment");
    expect(result.organizationId).toBe("test-org"); // RLS enforced
    expect(result.issueId).toBe(issue.id);
  });
});
```

---

## Pattern 5: Multi-Context Testing

### Cross-Organizational Isolation Testing

```typescript
test("multi-org data isolation validation", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Create data in multiple organizations
    const testData = [];

    // Org 1 data
    await testSessions.admin(db, "org-1");
    const [org1Machine] = await db
      .insert(schema.machines)
      .values({ name: "Org 1 Machine" })
      .returning();

    const [org1Issue] = await db
      .insert(schema.issues)
      .values({
        title: "Org 1 Issue",
        machineId: org1Machine.id,
      })
      .returning();

    // Org 2 data
    await testSessions.admin(db, "org-2");
    const [org2Machine] = await db
      .insert(schema.machines)
      .values({ name: "Org 2 Machine" })
      .returning();

    const [org2Issue] = await db
      .insert(schema.issues)
      .values({
        title: "Org 2 Issue",
        machineId: org2Machine.id,
      })
      .returning();

    // Verify complete isolation
    // From org-2 context, should only see org-2 data
    const org2Issues = await db.query.issues.findMany({
      with: { machine: true },
    });

    expect(org2Issues).toHaveLength(1);
    expect(org2Issues[0].title).toBe("Org 2 Issue");
    expect(org2Issues[0].machine.name).toBe("Org 2 Machine");

    // Switch to org-1 context
    await testSessions.admin(db, "org-1");
    const org1Issues = await db.query.issues.findMany({
      with: { machine: true },
    });

    expect(org1Issues).toHaveLength(1);
    expect(org1Issues[0].title).toBe("Org 1 Issue");
    expect(org1Issues[0].machine.name).toBe("Org 1 Machine");

    // Verify complete isolation in complex queries
    const allMachines = await db.query.machines.findMany();
    expect(allMachines).toHaveLength(1); // Only org-1 machine visible
    expect(allMachines[0].name).toBe("Org 1 Machine");
  });
});
```

### Role-Based Context Testing

```typescript
test("role-based RLS context validation", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    await testSessions.admin(db, "test-org");

    // Create sensitive admin data
    const [adminIssue] = await db
      .insert(schema.issues)
      .values({
        title: "Admin Only Issue",
        isConfidential: true,
      })
      .returning();

    // Create public data
    const [publicIssue] = await db
      .insert(schema.issues)
      .values({
        title: "Public Issue",
        isConfidential: false,
      })
      .returning();

    // Switch to member context
    await testSessions.member(db, "test-org");

    // Member should only see public issues
    const memberVisibleIssues = await db.query.issues.findMany();

    expect(memberVisibleIssues).toHaveLength(1);
    expect(memberVisibleIssues[0].title).toBe("Public Issue");

    // Switch back to admin context
    await testSessions.admin(db, "test-org");

    // Admin should see all issues
    const adminVisibleIssues = await db.query.issues.findMany();
    expect(adminVisibleIssues).toHaveLength(2);
  });
});
```

---

## Performance Testing

### Large Dataset Efficiency

```typescript
test("handles large datasets efficiently with RLS", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    await testSessions.admin(db, "test-org");

    // Create many issues for performance testing
    const issueData = Array.from({ length: 1000 }, (_, i) => ({
      title: `Issue ${i}`,
      description: `Test issue number ${i}`,
      statusId: i % 2 === 0 ? "new" : "in-progress",
    }));

    await db.insert(schema.issues).values(issueData);

    // Test query performance with RLS
    const start = performance.now();

    const results = await db.query.issues.findMany({
      where: eq(schema.issues.statusId, "new"),
      limit: 50,
      orderBy: desc(schema.issues.createdAt),
    });

    const duration = performance.now() - start;

    expect(results).toHaveLength(50);
    expect(duration).toBeLessThan(100); // Should be fast with proper indexes

    // Verify all results are properly scoped
    results.forEach((issue) => {
      expect(issue.organizationId).toBe("test-org");
    });
  });
});
```

---

## Pattern 6: Business Logic Testing with integration_tester Role

### BYPASSRLS for Fast Business Logic Testing

**Purpose**: Test business logic without RLS overhead using dual-track testing strategy  
**Role**: `integration_tester` with `BYPASSRLS` capability  
**Context**: Part of dual-track approach - pgTAP handles RLS validation separately

**Key Benefits**:

- **5x faster execution**: No RLS policy evaluation overhead
- **Focus on business logic**: Test functionality without security complexity
- **Clean data setup**: Direct database operations without organizational coordination
- **Clear separation**: Security testing handled by pgTAP track

**Complete Strategy**: [📖 dual-track-testing-strategy.md](./dual-track-testing-strategy.md)

```typescript
// src/services/__tests__/issueService.test.ts
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
import { IssueService } from "../issueService";

// Database connection uses integration_tester role (BYPASSRLS)
// DATABASE_URL="postgresql://integration_tester:testpassword@localhost:5432/postgres"

test("calculates issue priority correctly", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // integration_tester bypasses RLS - focus on business logic
    const service = new IssueService(db);

    // Create test data directly - no organizational setup needed
    const [organization] = await db
      .insert(schema.organizations)
      .values({
        id: "test-org",
        name: "Test Organization",
      })
      .returning();

    const [location] = await db
      .insert(schema.locations)
      .values({
        name: "Test Location",
        organizationId: organization.id, // Explicit assignment
      })
      .returning();

    const [machine] = await db
      .insert(schema.machines)
      .values({
        name: "Critical Production Machine",
        locationId: location.id,
        organizationId: organization.id, // Explicit assignment
        importance: "high",
      })
      .returning();

    // Test business logic without RLS interference
    const issue = await service.createIssue({
      title: "Machine Down",
      machineId: machine.id,
      organizationId: organization.id, // Explicit assignment
      estimatedDowntime: 240, // 4 hours
    });

    // Verify business rule calculations (not security boundaries)
    expect(issue.calculatedPriority).toBe("critical");
    expect(issue.escalationLevel).toBe(2);
    expect(issue.estimatedResolutionTime).toBe(8); // hours
  });
});
```

### Complex Workflow Testing

```typescript
test("issue comment workflow with notifications", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Setup: Create complete test scenario directly
    const [org] = await db
      .insert(schema.organizations)
      .values({
        id: "workflow-org",
        name: "Workflow Test Org",
      })
      .returning();

    const [adminUser] = await db
      .insert(schema.users)
      .values({
        id: "admin-user",
        email: "admin@test.com",
        name: "Admin User",
      })
      .returning();

    const [memberUser] = await db
      .insert(schema.users)
      .values({
        id: "member-user",
        email: "member@test.com",
        name: "Member User",
      })
      .returning();

    const [issue] = await db
      .insert(schema.issues)
      .values({
        id: "test-issue",
        title: "Test Issue",
        organizationId: org.id,
        createdById: memberUser.id,
        statusId: "new",
      })
      .returning();

    const commentService = new CommentService(db);

    // Test workflow: Member creates comment, admin gets notified
    const comment = await commentService.createComment({
      issueId: issue.id,
      authorId: memberUser.id,
      content: "This machine is completely broken",
      mentionedUserIds: [adminUser.id], // Mention admin
    });

    // Verify comment creation business logic
    expect(comment.content).toBe("This machine is completely broken");
    expect(comment.authorId).toBe(memberUser.id);

    // Verify notification business logic
    const notifications = await db.query.notifications.findMany({
      where: eq(schema.notifications.userId, adminUser.id),
    });

    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe("mention");
    expect(notifications[0].relatedEntityId).toBe(comment.id);

    // Test escalation business logic
    await commentService.escalateIssue(issue.id, adminUser.id);

    const updatedIssue = await db.query.issues.findFirst({
      where: eq(schema.issues.id, issue.id),
    });

    expect(updatedIssue?.priorityLevel).toBe("high");
    expect(updatedIssue?.escalatedAt).toBeDefined();
  });
});
```

### Multi-Table Relationship Testing

```typescript
test("machine collection aggregation logic", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Create hierarchical test data
    const [org] = await db
      .insert(schema.organizations)
      .values({
        id: "collection-org",
        name: "Collection Test Org",
      })
      .returning();

    const [location] = await db
      .insert(schema.locations)
      .values({
        name: "Test Arcade",
        organizationId: org.id,
      })
      .returning();

    // Create multiple machines
    const machines = await db
      .insert(schema.machines)
      .values([
        {
          name: "Pinball A",
          locationId: location.id,
          organizationId: org.id,
          isActive: true,
        },
        {
          name: "Pinball B",
          locationId: location.id,
          organizationId: org.id,
          isActive: true,
        },
        {
          name: "Pinball C",
          locationId: location.id,
          organizationId: org.id,
          isActive: false,
        },
      ])
      .returning();

    const [collection] = await db
      .insert(schema.collections)
      .values({
        name: "Classic Collection",
        locationId: location.id,
      })
      .returning();

    // Add machines to collection
    await db.insert(schema.collectionMachines).values([
      { collectionId: collection.id, machineId: machines[0].id },
      { collectionId: collection.id, machineId: machines[1].id },
      { collectionId: collection.id, machineId: machines[2].id },
    ]);

    const collectionService = new CollectionService(db);

    // Test aggregation business logic
    const stats = await collectionService.getCollectionStats(collection.id);

    expect(stats.totalMachines).toBe(3);
    expect(stats.activeMachines).toBe(2);
    expect(stats.inactiveMachines).toBe(1);
    expect(stats.activePercentage).toBe(66.67);
  });
});
```

### Performance and Scalability Testing

```typescript
test("handles large dataset operations efficiently", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Create large test dataset
    const [org] = await db
      .insert(schema.organizations)
      .values({
        id: "perf-org",
        name: "Performance Test Org",
      })
      .returning();

    // Create 1000 issues for performance testing
    const issueData = Array.from({ length: 1000 }, (_, i) => ({
      title: `Performance Test Issue ${i}`,
      organizationId: org.id,
      createdAt: new Date(),
    }));

    await db.insert(schema.issues).values(issueData);

    const issueService = new IssueService(db);

    // Test pagination performance
    const startTime = performance.now();
    const paginatedResults = await issueService.getIssuesPaginated({
      page: 1,
      limit: 50,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
    const endTime = performance.now();

    // Verify business logic
    expect(paginatedResults.issues).toHaveLength(50);
    expect(paginatedResults.totalCount).toBe(1000);
    expect(paginatedResults.totalPages).toBe(20);

    // Verify performance characteristics
    expect(endTime - startTime).toBeLessThan(100); // Should complete in <100ms
  });
});
```

### Database Connection Configuration

**Test Environment Setup**:

```env
# .env.test - integration_tester bypasses RLS
DATABASE_URL="postgresql://integration_tester:testpassword@localhost:5432/postgres"

# integration_tester role has BYPASSRLS - perfect for business logic testing
# Security testing handled separately by pgTAP track
```

**Role Creation** (test environment only):

```sql
-- Created by setup script - see dual-track strategy
CREATE ROLE integration_tester WITH LOGIN SUPERUSER BYPASSRLS PASSWORD 'testpassword';
```

### Migration from RLS-Enforced Tests

**Before (RLS-enforced complexity)**:

```typescript
test("issue creation with org context", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Complex organizational setup
    const { org } = await setupOrgContext(db);
    await db.execute(sql`SET app.current_organization_id = ${org.id}`);

    // Mixed business logic + security verification
    const issue = await service.createIssue({...});
    expect(issue.organizationId).toBe(org.id); // Security check mixed with logic
  });
});
```

**After (business logic focus)**:

```typescript
test("issue priority calculation", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Direct data setup - no organizational complexity
    const issue = await service.createIssue({...});

    // Pure business logic validation
    expect(issue.calculatedPriority).toBe("high");
  });
});
```

### Integration with Dual-Track Strategy

**Clear Responsibility Split**:

- **This pattern (integration_tester)**: Business logic, workflows, data relationships
- **pgTAP Security Track**: RLS policies, organizational boundaries, permissions
- **No overlap**: Each track focuses on its specific concern

**Performance Benefits**:

- **5x faster test execution**: No RLS evaluation overhead
- **Simpler test setup**: Direct data creation without organizational coordination
- **Clearer test intent**: Focus on functionality, not security

**Cross-references**:

- **Security testing**: [📖 archetype-security-testing.md](./archetype-security-testing.md)
- **pgTAP RLS testing**: [📖 pgtap-rls-testing.md](./pgtap-rls-testing.md)
- **Complete strategy**: [📖 dual-track-testing-strategy.md](./dual-track-testing-strategy.md)

---

## Anti-Patterns to Avoid

### ❌ Memory Unsafe Patterns

```typescript
// ❌ DANGEROUS: Creates 50-100MB per test
beforeEach(async () => {
  const { db } = await createSeededTestDatabase(); // Per-test database
});

// ❌ DANGEROUS: Multiple PGlite instances
test("multiple tests", async () => {
  const db1 = new PGlite();
  const db2 = new PGlite(); // Memory multiplier
});
```

### ❌ Manual Organizational Coordination

```typescript
// ❌ COMPLEX: Manual organizationId management
const mockDb = createMockDb();
const service = new IssueService(mockDb);

// Manual injection everywhere
await service.create({
  title: "Test",
  organizationId: "test-org", // Manual coordination
});

// Manual scoping validation
const issues = await service.list();
expect(issues.every((i) => i.organizationId === "test-org")).toBe(true);
```

### ❌ Mixed Testing Patterns

```typescript
// ❌ WRONG: Using mocks in integration tests
vi.mock("@/lib/db"); // Should use real database

// ❌ WRONG: Integration test in unit test location
// File: src/components/__tests__/integration.test.ts
// Should be in src/integration-tests/
```

---

## Quality Guidelines

### Memory Safety Validation

- **Monitor memory usage**: Tests should stay under 500MB total
- **Single PGlite instance**: One per worker, not per test
- **Transaction isolation**: Automatic cleanup via rollback

### RLS Context Validation

- **Session establishment**: Every test must set organizational context
- **Boundary verification**: Test cross-org isolation
- **Role enforcement**: Verify role-based access control

### Performance Targets

- **Fast execution**: Integration tests should complete in 2-5 seconds per file
- **Efficient queries**: Database operations should be optimized
- **Parallel safety**: Tests must be completely independent

---

## Agent Assignment

**This archetype is handled by**: `integration-test-architect`

**Agent responsibilities**:

- **CRITICAL**: Enforce memory safety patterns (prevent system lockups)
- Establish RLS context for all database operations
- Validate organizational boundary enforcement
- Test full-stack functionality with real database constraints
- Convert "fake integration" patterns to proper tRPC integration

**Quality validation**:

- All tests use worker-scoped PGlite pattern
- RLS session context is properly established
- Organizational boundaries are verified
- Memory usage remains stable during execution

---

## When to Escalate to Other Archetypes

**Switch to Unit Testing Archetype when**:

- No database interaction required
- Testing pure business logic
- React component rendering only
- Performance requires <100ms execution

**Switch to Security Testing Archetype when**:

- Primary focus is security boundaries
- Testing RLS policies directly
- Cross-organizational access validation
- Permission matrix verification

The integration testing archetype provides the foundation for confident full-stack testing while maintaining memory safety and leveraging RLS for simplified organizational scoping.
