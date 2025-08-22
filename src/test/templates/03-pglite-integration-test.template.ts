/**
 * TEMPLATE: Archetype 3 - PGlite Integration Test
 *
 * USE FOR: Testing database interactions with full integration scenarios
 * RLS IMPACT: DRAMATICALLY SIMPLIFIED - No createTestContext coordination
 * AGENT: integration-test-architect
 *
 * CHARACTERISTICS:
 * - Full database integration testing with PGlite
 * - Worker-scoped database for memory safety
 * - Transaction isolation with automatic rollback
 * - Tests data relationships and complex queries
 * - Integration_tester role simulation (RLS bypassed for speed)
 */

import { describe, test, expect } from "vitest";
import { eq, and, sql, count, desc } from "drizzle-orm";
import {
  test as workerTest,
  withBusinessLogicTest,
} from "~/test/helpers/worker-scoped-db";
import { verifyIntegrationTesterMode } from "~/test/helpers/pglite-test-setup";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import * as schema from "~/server/db/schema";

describe("YourModule Integration Tests", () => {
  // =============================================================================
  // DATABASE INTEGRATION SETUP VERIFICATION
  // =============================================================================

  test("verifies integration_tester mode is active", async ({ workerDb }) => {
    await withBusinessLogicTest(workerDb, async (db) => {
      // VERIFY: integration_tester simulation is working
      const mode = await verifyIntegrationTesterMode(db);
      expect(mode.isActive).toBe(true);
      expect(mode.details.rlsBypassed).toBe(true);
      expect(mode.details.testRole).toBe("integration_tester");
    });
  });

  // =============================================================================
  // BASIC CRUD OPERATIONS INTEGRATION
  // =============================================================================

  test("creates and retrieves data with proper relationships", async ({
    workerDb,
  }) => {
    await withBusinessLogicTest(workerDb, async (db) => {
      // ARRANGE: Create related data
      const [organization] = await db
        .insert(schema.organizations)
        .values({
          id: "integration-org",
          name: "Integration Test Organization",
          settings: { theme: "light", notifications: true },
        })
        .returning();

      const [user] = await db
        .insert(schema.users)
        .values({
          id: "integration-user",
          email: "integration@test.com",
          name: "Integration Tester",
        })
        .returning();

      const [machine] = await db
        .insert(schema.machines)
        .values({
          name: "Integration Test Machine",
          organizationId: organization.id,
          ownerId: user.id,
          model: "Test Model 2000",
          serialNumber: "INT-001",
        })
        .returning();

      // ACT: Create related issue
      const [issue] = await db
        .insert(schema.issues)
        .values({
          title: "Integration Test Issue",
          description: "Testing database integration",
          machineId: machine.id,
          organizationId: organization.id,
          createdById: user.id,
          priority: "high",
          status: "open",
        })
        .returning();

      // ASSERT: Data relationships work correctly
      expect(issue).toBeDefined();
      expect(issue.machineId).toBe(machine.id);
      expect(issue.organizationId).toBe(organization.id);
      expect(issue.createdById).toBe(user.id);

      // VERIFY: Query with relationships
      const issueWithRelations = await db.query.issues.findFirst({
        where: eq(schema.issues.id, issue.id),
        with: {
          machine: true,
          organization: true,
          createdBy: true,
        },
      });

      expect(issueWithRelations?.machine.name).toBe("Integration Test Machine");
      expect(issueWithRelations?.organization.name).toBe(
        "Integration Test Organization",
      );
      expect(issueWithRelations?.createdBy.email).toBe("integration@test.com");
    });
  });

  test("handles complex queries with joins and aggregations", async ({
    workerDb,
  }) => {
    await withBusinessLogicTest(workerDb, async (db) => {
      // ARRANGE: Create test dataset
      const testData = await createComplexTestDataset(db);

      // ACT: Execute complex query
      const complexQuery = await db
        .select({
          machineId: schema.machines.id,
          machineName: schema.machines.name,
          issueCount: count(schema.issues.id),
          highPriorityCount: count(
            sql`CASE WHEN ${schema.issues.priority} = 'high' THEN 1 END`,
          ),
          organizationName: schema.organizations.name,
        })
        .from(schema.machines)
        .leftJoin(
          schema.issues,
          eq(schema.machines.id, schema.issues.machineId),
        )
        .leftJoin(
          schema.organizations,
          eq(schema.machines.organizationId, schema.organizations.id),
        )
        .where(eq(schema.organizations.id, testData.organizationId))
        .groupBy(
          schema.machines.id,
          schema.machines.name,
          schema.organizations.name,
        )
        .having(({ issueCount }) => sql`${issueCount} > 0`)
        .orderBy(desc(count(schema.issues.id)));

      // ASSERT: Complex query results
      expect(complexQuery).toHaveLength(2); // 2 machines with issues
      expect(complexQuery[0].issueCount).toBeGreaterThan(0);
      expect(complexQuery[0].highPriorityCount).toBeGreaterThanOrEqual(0);
      expect(
        complexQuery.every(
          (row) => row.organizationName === "Complex Test Org",
        ),
      ).toBe(true);
    });
  });

  // =============================================================================
  // TRANSACTION AND CONCURRENCY TESTING
  // =============================================================================

  test("handles transactions correctly", async ({ workerDb }) => {
    await withBusinessLogicTest(workerDb, async (db) => {
      const { organizationId, userId } = await createBasicTestData(db);

      // ACT: Execute operations in explicit transaction
      const results = await db.transaction(async (tx) => {
        // Create machine
        const [machine] = await tx
          .insert(schema.machines)
          .values({
            name: "Transaction Test Machine",
            organizationId,
            ownerId: userId,
          })
          .returning();

        // Create multiple related issues
        const issues = await tx
          .insert(schema.issues)
          .values([
            {
              title: "Issue 1",
              machineId: machine.id,
              organizationId,
              createdById: userId,
              priority: "medium",
            },
            {
              title: "Issue 2",
              machineId: machine.id,
              organizationId,
              createdById: userId,
              priority: "high",
            },
          ])
          .returning();

        return { machine, issues };
      });

      // ASSERT: All data committed together
      expect(results.machine).toBeDefined();
      expect(results.issues).toHaveLength(2);

      // VERIFY: Data is accessible outside transaction
      const machineExists = await db.query.machines.findFirst({
        where: eq(schema.machines.id, results.machine.id),
      });

      const issuesExist = await db.query.issues.findMany({
        where: eq(schema.issues.machineId, results.machine.id),
      });

      expect(machineExists).toBeDefined();
      expect(issuesExist).toHaveLength(2);
    });
  });

  test("handles rollback scenarios correctly", async ({ workerDb }) => {
    await withBusinessLogicTest(workerDb, async (db) => {
      const { organizationId, userId } = await createBasicTestData(db);

      // ACT & ASSERT: Transaction rollback
      await expect(
        db.transaction(async (tx) => {
          // Create machine
          await tx.insert(schema.machines).values({
            name: "Rollback Test Machine",
            organizationId,
            ownerId: userId,
          });

          // Intentionally cause error to trigger rollback
          throw new Error("Intentional rollback");
        }),
      ).rejects.toThrow("Intentional rollback");

      // VERIFY: No data was committed
      const machines = await db.query.machines.findMany({
        where: eq(schema.machines.name, "Rollback Test Machine"),
      });

      expect(machines).toHaveLength(0);
    });
  });

  // =============================================================================
  // DATA INTEGRITY AND CONSTRAINTS
  // =============================================================================

  test("enforces foreign key constraints", async ({ workerDb }) => {
    await withBusinessLogicTest(workerDb, async (db) => {
      const { organizationId, userId } = await createBasicTestData(db);

      // ACT & ASSERT: Foreign key constraint violation
      await expect(
        db.insert(schema.issues).values({
          title: "Invalid Machine Issue",
          machineId: "nonexistent-machine-id",
          organizationId,
          createdById: userId,
        }),
      ).rejects.toThrow(); // Should violate foreign key constraint
    });
  });

  test("enforces unique constraints", async ({ workerDb }) => {
    await withBusinessLogicTest(workerDb, async (db) => {
      const { organizationId } = await createBasicTestData(db);

      // ARRANGE: Create first machine
      await db.insert(schema.machines).values({
        name: "Unique Test Machine",
        serialNumber: "UNIQUE-001",
        organizationId,
      });

      // ACT & ASSERT: Unique constraint violation
      await expect(
        db.insert(schema.machines).values({
          name: "Another Machine",
          serialNumber: "UNIQUE-001", // Duplicate serial number
          organizationId,
        }),
      ).rejects.toThrow(); // Should violate unique constraint
    });
  });

  // =============================================================================
  // PERFORMANCE AND OPTIMIZATION
  // =============================================================================

  test("handles large dataset queries efficiently", async ({ workerDb }) => {
    await withBusinessLogicTest(workerDb, async (db) => {
      // ARRANGE: Create large test dataset
      const { organizationId, userId } = await createBasicTestData(db);
      const machineData = Array.from({ length: 50 }, (_, i) => ({
        name: `Performance Test Machine ${i}`,
        organizationId,
        ownerId: userId,
        serialNumber: `PERF-${i.toString().padStart(3, "0")}`,
      }));

      const machines = await db
        .insert(schema.machines)
        .values(machineData)
        .returning();

      // Create issues for each machine
      const issueData = machines.flatMap((machine, machineIndex) =>
        Array.from({ length: 10 }, (_, issueIndex) => ({
          title: `Issue ${issueIndex} for Machine ${machineIndex}`,
          machineId: machine.id,
          organizationId,
          createdById: userId,
          priority: issueIndex % 3 === 0 ? "high" : "medium",
        })),
      );

      await db.insert(schema.issues).values(issueData);

      // ACT: Execute performance query
      const start = performance.now();

      const performanceQuery = await db
        .select({
          machineId: schema.machines.id,
          machineName: schema.machines.name,
          totalIssues: count(schema.issues.id),
          highPriorityIssues: count(
            sql`CASE WHEN ${schema.issues.priority} = 'high' THEN 1 END`,
          ),
        })
        .from(schema.machines)
        .leftJoin(
          schema.issues,
          eq(schema.machines.id, schema.issues.machineId),
        )
        .where(eq(schema.machines.organizationId, organizationId))
        .groupBy(schema.machines.id, schema.machines.name)
        .orderBy(desc(count(schema.issues.id)))
        .limit(20);

      const duration = performance.now() - start;

      // ASSERT: Performance and correctness
      expect(performanceQuery).toHaveLength(20);
      expect(duration).toBeLessThan(500); // Should complete quickly
      expect(performanceQuery[0].totalIssues).toBe(10); // Each machine has 10 issues
      expect(performanceQuery.every((row) => row.totalIssues > 0)).toBe(true);
    });
  });

  // =============================================================================
  // EDGE CASES AND ERROR SCENARIOS
  // =============================================================================

  test("handles edge cases gracefully", async ({ workerDb }) => {
    await withBusinessLogicTest(workerDb, async (db) => {
      // ARRANGE: Create minimal test data
      const { organizationId } = await createBasicTestData(db);

      // ACT & ASSERT: Query with no results
      const noResults = await db.query.issues.findMany({
        where: eq(schema.issues.organizationId, "nonexistent-org"),
      });

      expect(noResults).toHaveLength(0);

      // ACT & ASSERT: Query with complex WHERE conditions
      const complexWhere = await db.query.issues.findMany({
        where: and(
          eq(schema.issues.organizationId, organizationId),
          sql`${schema.issues.priority} IN ('high', 'critical')`,
          sql`${schema.issues.createdAt} >= NOW() - INTERVAL '1 day'`,
        ),
      });

      expect(Array.isArray(complexWhere)).toBe(true);
    });
  });
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

// Helper functions use static SEED_TEST_IDS for predictable test data.
// No dynamic queries needed - static constants provide consistency.
async function createBasicTestData(db: any) {
  const [organization] = await db
    .insert(schema.organizations)
    .values({
      id: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
      name: "Basic Test Organization",
    })
    .returning();

  const [user] = await db
    .insert(schema.users)
    .values({
      id: SEED_TEST_IDS.MOCK_PATTERNS.USER,
      email: "basic@test.com",
      name: "Basic Test User",
    })
    .returning();

  return {
    organizationId: organization.id,
    userId: user.id,
    organization,
    user,
  };
}

async function createComplexTestDataset(db: any) {
  const { organizationId, userId } = await createBasicTestData(db);

  // Create multiple machines
  const machines = await db
    .insert(schema.machines)
    .values([
      {
        name: "Complex Machine 1",
        organizationId,
        ownerId: userId,
        model: "Model A",
        serialNumber: "COMPLEX-001",
      },
      {
        name: "Complex Machine 2",
        organizationId,
        ownerId: userId,
        model: "Model B",
        serialNumber: "COMPLEX-002",
      },
      {
        name: "Complex Machine 3",
        organizationId,
        ownerId: userId,
        model: "Model A",
        serialNumber: "COMPLEX-003",
      },
    ])
    .returning();

  // Create issues for machines
  const issues = await db
    .insert(schema.issues)
    .values([
      {
        title: "Machine 1 - High Priority Issue",
        machineId: machines[0].id,
        organizationId,
        createdById: userId,
        priority: "high",
      },
      {
        title: "Machine 1 - Medium Priority Issue",
        machineId: machines[0].id,
        organizationId,
        createdById: userId,
        priority: "medium",
      },
      {
        title: "Machine 2 - Critical Issue",
        machineId: machines[1].id,
        organizationId,
        createdById: userId,
        priority: "critical",
      },
    ])
    .returning();

  return {
    organizationId,
    userId,
    machines,
    issues,
  };
}

// =============================================================================
// TEMPLATE USAGE INSTRUCTIONS
// =============================================================================

/*
SETUP INSTRUCTIONS:

1. Replace 'YourModule' with your actual module/feature name
2. Update import paths to match your project structure
3. Replace schema references with your actual database schema
4. Customize test scenarios for your specific integration needs
5. Update helper functions for your data requirements
6. Remove unused test cases

INTEGRATION TEST CHARACTERISTICS:
- This template demonstrates correct static constant usage.
- Uses SEED_TEST_IDS.MOCK_PATTERNS for consistent integration testing.
- Tests full database interactions and relationships
- Uses real database operations with PGlite
- Tests complex queries, joins, and aggregations
- Validates data integrity and constraints
- Tests transaction behavior and rollback scenarios

WHEN TO USE THIS TEMPLATE:
✅ Testing database operations and queries
✅ Testing data relationships and foreign keys
✅ Testing complex business workflows with data persistence
✅ Testing transaction behavior and rollback scenarios
✅ Testing database performance and optimization

WHEN NOT TO USE:
❌ Pure business logic without database (use Archetype 2)
❌ React component testing (use Archetype 4)
❌ tRPC router testing (use Archetype 5)
❌ Security/RLS policy testing (use Archetype 7)

BENEFITS OF INTEGRATION_TESTER SIMULATION:
✅ 5x faster execution without RLS evaluation overhead
✅ Direct database access without organizational coordination
✅ Focus on data integrity without security layer complexity
✅ Memory-safe worker-scoped PGlite pattern

EXAMPLE SCENARIOS SUITABLE FOR THIS TEMPLATE:
- Testing issue creation with machine relationships
- Testing complex reporting queries with aggregations
- Testing data migration and transformation logic
- Testing batch operations and bulk data processing
- Testing database constraint enforcement
*/
