# Testing Architecture for RLS-Enhanced System

**Strategic Bridge Phase**: Design testing methodology that realizes 100% of RLS benefits before fixing 306 failing tests.

## Strategic Importance

### Why This Phase Is Critical

**PREVENTS**: Ad-hoc test fixes that miss RLS benefits → messy test architecture lasting 2+ years
**ENABLES**: Systematic test repair using excellent RLS patterns → sustainable testing excellence

### The RLS Testing Transformation

**BEFORE RLS (Complex Coordination):**

```typescript
// Every test needs complex organizationId coordination
await withIsolatedTest(workerDb, async (db) => {
  const orgId = "test-org";
  const { caller } = await createTestContext(db, orgId); // Manual coordination

  // Must inject organizationId everywhere
  await caller.issues.create({ title: "Test", organizationId: orgId });

  // Manual scoping validation
  const issues = await caller.issues.list();
  expect(issues.every((i) => i.organizationId === orgId)).toBe(true);
});
```

**AFTER RLS (Simple Session Context):**

```typescript
// Set organization context once, everything automatically scoped
await withIsolatedTest(workerDb, async (db) => {
  await db.execute(sql`SET app.current_organization_id = 'test-org'`); // Set once
  const { caller } = await createTestContext(db); // No coordination needed

  // Automatic organizational scoping
  await caller.issues.create({ title: "Test" }); // No organizationId needed

  // RLS ensures correct scoping automatically
  const issues = await caller.issues.list(); // Only test-org issues returned
});
```

### Benefits Realization

1. **Simplified Test Setup**: No complex organizationId coordination
2. **Enhanced Security Testing**: Database-level policies provide confidence
3. **Reduced Test Complexity**: RLS handles multi-tenancy automatically
4. **Memory Safety**: Worker-scoped patterns prevent system lockups
5. **Sustainable Architecture**: Patterns designed for 2+ year lifespan

---

## 8 Testing Archetype Templates

### 1. Pure Function Unit Test

**RLS Impact**: None (pure functions have no database dependency)
**Pattern**: Unchanged

```typescript
// src/utils/__tests__/formatting.test.ts
import { formatIssueTitle } from "../formatting";

describe("formatIssueTitle", () => {
  test("capitalizes first letter", () => {
    expect(formatIssueTitle("test issue")).toBe("Test issue");
  });
});
```

### 2. Service Business Logic Test

**RLS Impact**: MASSIVELY SIMPLIFIED - No organizationId parameters needed
**Pattern**: Focus on business logic, RLS handles scoping

```typescript
// src/services/__tests__/issueService.test.ts
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
import { IssueService } from "../issueService";

test("calculates issue priority correctly", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Set organizational context once
    await db.execute(sql`SET app.current_organization_id = 'test-org'`);

    const service = new IssueService(db);

    // No organizationId needed - RLS handles it
    const issue = await service.createIssue({
      title: "High Priority Issue",
      machineDowntime: 120, // 2 hours
    });

    expect(issue.calculatedPriority).toBe("high");
    // RLS ensures this issue is automatically scoped to test-org
  });
});
```

### 3. PGlite Integration Test

**RLS Impact**: DRAMATICALLY SIMPLIFIED - No createTestContext coordination
**Pattern**: Worker-scoped database with session context

```typescript
// src/integration-tests/issue.integration.test.ts
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
import { sql } from "drizzle-orm";

test("issue lifecycle with organizational scoping", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Set organizational context
    await db.execute(sql`SET app.current_organization_id = 'test-org'`);

    // Insert test data - automatically scoped by RLS
    const [machine] = await db
      .insert(schema.machines)
      .values({
        name: "Test Machine",
        model: "Stern Pinball",
      })
      .returning();

    const [issue] = await db
      .insert(schema.issues)
      .values({
        title: "Machine malfunction",
        machineId: machine.id,
      })
      .returning();

    // RLS ensures only test-org data is accessible
    const foundIssues = await db.query.issues.findMany();
    expect(foundIssues).toHaveLength(1);
    expect(foundIssues[0].id).toBe(issue.id);

    // Cross-organization isolation test
    await db.execute(sql`SET app.current_organization_id = 'other-org'`);
    const otherOrgIssues = await db.query.issues.findMany();
    expect(otherOrgIssues).toHaveLength(0); // RLS isolation verified
  });
});
```

### 4. React Component Unit Test

**RLS Impact**: None (UI components don't directly interact with RLS)
**Pattern**: Unchanged, uses MSW-tRPC mocking

```typescript
// src/components/issues/__tests__/IssueList.test.tsx
import { render, screen } from '@testing-library/react';
import { VitestTestWrapper } from '~/test/VitestTestWrapper';
import { IssueList } from '../IssueList';

test('renders issue list correctly', () => {
  render(
    <VitestTestWrapper>
      <IssueList />
    </VitestTestWrapper>
  );

  expect(screen.getByRole('list')).toBeInTheDocument();
});
```

### 5. tRPC Router Test

**RLS Impact**: MASSIVELY SIMPLIFIED - No organizational context complexity
**Pattern**: Mock database with session context

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
      execute: vi.fn(), // For session context setting
      query: {
        issues: {
          findMany: vi.fn(),
          findFirst: vi.fn(),
        },
      },
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn(),
        }),
      }),
    },
  };
});

test("creates issue with automatic org scoping", async () => {
  // Session context automatically set by RLS middleware
  const mockCtx = createVitestMockContext({
    user: { id: "user-1", user_metadata: { organizationId: "test-org" } },
  });

  const caller = appRouter.createCaller(mockCtx);

  // No organizationId needed in input - RLS handles it
  await caller.issues.create({
    title: "Test Issue",
    machineId: "machine-1",
  });

  // Verify RLS session was set
  expect(mockDb.execute).toHaveBeenCalledWith(
    expect.objectContaining({
      sql: expect.stringContaining("SET app.current_organization_id"),
    }),
  );
});
```

### 6. Permission/Auth Test

**RLS Impact**: ENHANCED - Database-level security adds confidence
**Pattern**: Test RLS policies directly

```typescript
// src/security/__tests__/rls-policies.test.ts
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
import { sql } from "drizzle-orm";

test("RLS enforces organizational boundaries", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Create data in org-1
    await db.execute(sql`SET app.current_organization_id = 'org-1'`);
    await db.insert(schema.issues).values({ title: "Org 1 Issue" });

    // Create data in org-2
    await db.execute(sql`SET app.current_organization_id = 'org-2'`);
    await db.insert(schema.issues).values({ title: "Org 2 Issue" });

    // Verify isolation
    const org2Issues = await db.query.issues.findMany();
    expect(org2Issues).toHaveLength(1);
    expect(org2Issues[0].title).toBe("Org 2 Issue");

    // Switch context and verify isolation
    await db.execute(sql`SET app.current_organization_id = 'org-1'`);
    const org1Issues = await db.query.issues.findMany();
    expect(org1Issues).toHaveLength(1);
    expect(org1Issues[0].title).toBe("Org 1 Issue");
  });
});
```

### 7. RLS Policy Test (NEW ARCHETYPE)

**RLS Impact**: NEW - Test database policies directly
**Pattern**: Direct policy validation

```typescript
// src/db/__tests__/rls-policies.test.ts
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
import { sql } from "drizzle-orm";

test("issues RLS policy blocks cross-org access", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Test INSERT policy
    await db.execute(sql`SET app.current_organization_id = 'test-org'`);

    // Should succeed - correct org context
    await expect(
      db.insert(schema.issues).values({
        title: "Valid Issue",
      }),
    ).resolves.not.toThrow();

    // Test SELECT policy isolation
    await db.execute(sql`SET app.current_organization_id = 'other-org'`);
    const issues = await db.query.issues.findMany();
    expect(issues).toHaveLength(0); // RLS blocks cross-org access
  });
});

test("RLS policy respects role-based permissions", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    await db.execute(sql`SET app.current_organization_id = 'test-org'`);
    await db.execute(sql`SET app.current_user_role = 'member'`);

    // Member should be able to create issues
    await expect(
      db.insert(schema.issues).values({ title: "Member Issue" }),
    ).resolves.not.toThrow();

    // But not delete them (admin-only operation)
    const [issue] = await db.select().from(schema.issues).limit(1);
    await expect(
      db.delete(schema.issues).where(eq(schema.issues.id, issue.id)),
    ).rejects.toThrow(); // RLS policy violation
  });
});
```

### 8. Schema/Database Constraint Test

**RLS Impact**: ENHANCED - RLS policies add security constraints
**Pattern**: Test constraints with organizational context

```typescript
// src/db/__tests__/schema-constraints.test.ts
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";

test("machine foreign key constraint with RLS", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    await db.execute(sql`SET app.current_organization_id = 'test-org'`);

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
      })
      .returning();

    // Should succeed - valid reference
    await expect(
      db.insert(schema.issues).values({
        title: "Valid issue",
        machineId: machine.id,
      }),
    ).resolves.not.toThrow();
  });
});
```

---

## Memory Safety Architecture

### Worker-Scoped PGlite Pattern (MANDATORY)

**CRITICAL**: This pattern prevents 1-2GB+ memory usage and system lockups

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

- Worker-scoped PGlite instances
- Transaction-based test isolation
- Automatic cleanup via rollback

**❌ NEVER USE:**

- `new PGlite()` in individual tests (50-100MB each)
- `createSeededTestDatabase()` per test (memory blowout)
- External database containers (slow, complex)

---

## Session Context Management

### RLS Session Pattern

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

### Session Context in Different Test Types

**Integration Tests:**

```typescript
test("with admin context", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    await testSessions.admin(db, "test-org");
    // Test admin-specific functionality
  });
});
```

**Router Tests:**

```typescript
// Session context set automatically by RLS middleware in production
// Mock context reflects this in tests
const mockCtx = createVitestMockContext({
  user: {
    id: "admin-user",
    user_metadata: {
      organizationId: "test-org",
      role: "admin",
    },
  },
});
```

---

## Migration Guides

### From Complex Coordination to RLS Session

**BEFORE:**

```typescript
// Complex createTestContext coordination
const { caller, ctx } = await createTestContext(db, "test-org", {
  user: { id: "user-1", organizationId: "test-org" },
});

await caller.issues.create({
  title: "Test",
  organizationId: ctx.organizationId, // Manual injection
});
```

**AFTER:**

```typescript
// Simple session context
await db.execute(sql`SET app.current_organization_id = 'test-org'`);
const { caller } = await createTestContext(db); // No coordination needed

await caller.issues.create({
  title: "Test", // RLS handles scoping automatically
});
```

### Service Test Migration

**BEFORE:**

```typescript
// Service needs organizationId parameter
const service = new IssueService(db);
const issue = await service.create({
  title: "Test",
  organizationId: "test-org", // Manual parameter
});
```

**AFTER:**

```typescript
// RLS session context eliminates parameter
await db.execute(sql`SET app.current_organization_id = 'test-org'`);
const service = new IssueService(db);
const issue = await service.create({
  title: "Test", // RLS handles organizational scoping
});
```

### Router Test Migration

**BEFORE:**

```typescript
// Complex mock setup with organizational coordination
const mockDb = {
  query: {
    issues: {
      findMany: vi.fn().mockImplementation(({ where }) => {
        // Manual organizational filtering in mock
        return mockIssues.filter(
          (i) => i.organizationId === where.organizationId,
        );
      }),
    },
  },
};
```

**AFTER:**

```typescript
// Simplified mock - RLS handles organizational filtering
const mockDb = {
  execute: vi.fn(), // For session context
  query: {
    issues: {
      findMany: vi.fn().mockResolvedValue(mockIssues), // RLS filters automatically
    },
  },
};
```

---

## Testing Methodology Documentation

### Test Organization Structure

```
src/
├── __tests__/                     # Pure function unit tests
├── components/__tests__/           # React component tests
├── services/__tests__/            # Service business logic tests
├── server/api/routers/__tests__/  # tRPC router tests
├── integration-tests/             # PGlite integration tests
├── security/__tests__/            # Permission and RLS policy tests
└── db/__tests__/                  # Schema and constraint tests
```

### Test Naming Conventions

**File Naming:**

- `*.test.ts` - Unit tests (no database)
- `*.integration.test.ts` - Integration tests (with PGlite)
- `*.security.test.ts` - Permission and RLS tests
- `*.schema.test.ts` - Database constraint tests

**Test Naming:**

- `describe('RLS Policies')` - For policy-specific tests
- `describe('Organizational Scoping')` - For multi-tenant tests
- `describe('Permission Matrix')` - For role-based tests

### Documentation Standards

**Test File Headers:**

```typescript
/**
 * @fileoverview Integration tests for issue management with RLS
 * @requires PGlite worker-scoped database
 * @security Tests organizational boundaries via RLS policies
 */
```

**Complex Test Comments:**

```typescript
test("issue timeline with cross-org isolation", async ({ workerDb }) => {
  // SETUP: Create issues in two different organizations
  // VERIFY: RLS ensures complete isolation between orgs
  // EDGE CASE: Timeline spans across org context switches
});
```

---

## Quality Validation

### Archetype Compliance Checklist

**For Each Test File:**

- [ ] Uses correct archetype pattern
- [ ] Follows memory safety guidelines (worker-scoped PGlite)
- [ ] Implements proper session context management
- [ ] Includes RLS-specific verification where applicable
- [ ] Has appropriate test naming and documentation

### Automated Validation

```typescript
// test/helpers/archetype-validator.ts
export function validateTestArchetype(testFile: string) {
  // Check for memory safety violations
  if (testFile.includes("new PGlite(")) {
    throw new Error(
      `Memory safety violation: Per-test PGlite instance in ${testFile}`,
    );
  }

  // Check for proper session context usage
  if (
    testFile.includes("integration.test.ts") &&
    !testFile.includes("SET app.current_organization_id")
  ) {
    throw new Error(`Missing RLS session context in ${testFile}`);
  }

  // Check for worker-scoped pattern
  if (!testFile.includes("withIsolatedTest")) {
    throw new Error(`Missing transaction isolation in ${testFile}`);
  }
}
```

### Quality Gates

**Pre-commit Validation:**

- All tests use approved archetype patterns
- No memory safety violations detected
- Proper RLS session context where required
- Transaction isolation implemented correctly

**CI/CD Validation:**

- Memory usage stays under 500MB during test execution
- All integration tests pass with RLS enabled
- Cross-organizational isolation verified
- Performance benchmarks met (test suite completes efficiently)

---

## Implementation Workflow

### Foundation Setup

**Documentation Creation** (Prerequisites for all testing work)
_Scope: Medium complexity - establishes patterns for 306+ tests_

- [ ] Create archetype templates (8 distinct patterns)
- [ ] Document memory safety patterns (critical for system stability)
- [ ] Establish session context guidelines (RLS integration foundation)

**Infrastructure Implementation** (Depends on documentation completion)
_Scope: High complexity - core testing infrastructure changes_

- [ ] Update worker-scoped-db helpers (memory safety critical)
- [ ] Create session context utilities (RLS session management)
- [ ] Implement archetype validation (automated quality gates)

**Quality Assurance Setup** (Depends on infrastructure completion)
_Scope: Medium complexity - validation and enforcement_

- [ ] Create quality validation tools (pre-commit integration)
- [ ] Establish pre-commit hooks (archetype compliance)
- [ ] Document migration guides (pattern conversion workflows)

**Validation & Testing** (Depends on quality assurance setup)
_Scope: Low complexity - verification of established patterns_

- [ ] Test archetype patterns with sample tests
- [ ] Validate memory safety with load testing
- [ ] Confirm RLS session context works correctly

### Readiness Criteria for Systematic Test Repair

**Architecture Requirements** (Must be completed before test fixing begins)
_Critical: Establishes foundation for 306+ test repairs_

- [ ] All 8 archetype templates documented and tested
- [ ] Worker-scoped PGlite pattern validated (prevents memory blowouts)
- [ ] RLS session context management working (organizational isolation)
- [ ] Memory safety guidelines established (system stability)
- [ ] Quality validation tools implemented (automated compliance)
- [ ] Migration guides completed (conversion workflows)

**Validation Requirements** (Must pass before proceeding)
_Critical: Verifies architecture readiness for systematic repair_

- [ ] Sample tests demonstrate each archetype pattern (proof of concept)
- [ ] Memory usage verified under 500MB during test execution (scalability)
- [ ] RLS session context properly isolates organizations (security)
- [ ] Automated validation catches archetype violations (quality assurance)

**Completion Indicators**
_How to know each phase is truly ready:_

- [ ] Documentation: Can repair any failing test by following archetype guide
- [ ] Infrastructure: Helper functions eliminate boilerplate in sample tests
- [ ] Quality: Pre-commit hooks prevent pattern violations
- [ ] Validation: Load testing shows sustainable memory usage patterns

---

## Success Metrics

### Technical Excellence

- **Memory Safety**: Tests use <500MB total (vs 1-2GB+ with per-test databases)
- **RLS Integration**: Session context automatically handles organizational scoping
- **Test Simplicity**: 50-70% reduction in test setup complexity
- **Pattern Consistency**: All tests follow approved archetype patterns

### Architectural Benefits

- **Sustainable Patterns**: Testing methodology designed for 2+ year lifespan
- **RLS Realization**: 100% of RLS benefits captured in testing approach
- **Developer Experience**: Clear guidelines for future test development
- **Quality Assurance**: Automated validation prevents regression to poor patterns

### Systematic Test Repair Preparation

- **Clear Patterns**: Defined approach for each of 306 failing tests
- **Consistent Execution**: No ad-hoc decisions during test fixing
- **Quality Guarantee**: Every repaired test follows excellent patterns
- **Knowledge Transfer**: Comprehensive documentation for future developers

---

This testing architecture ensures that systematic test repair realizes the full benefits of RLS while establishing sustainable testing excellence that will serve the project for years to come.
