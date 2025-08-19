/**
 * TEMPLATE: Archetype 8 - Schema/Database Constraint Test
 * 
 * USE FOR: Testing database schema constraints, triggers, and data integrity
 * RLS IMPACT: ENHANCED - RLS policies add security constraints to test
 * AGENT: security-test-architect
 * 
 * CHARACTERISTICS:
 * - Tests database schema constraints and validation
 * - Tests foreign key relationships and cascade behavior
 * - Tests unique constraints and indexes
 * - Tests triggers, checks, and custom constraints
 * - Tests constraint interaction with RLS policies
 */

import { describe, test, expect } from "vitest";
import { eq, and, sql, count } from "drizzle-orm";
import { 
  test as workerTest, 
  withBusinessLogicTest,
  withRLSAwareTest 
} from "~/test/helpers/worker-scoped-db";
import { testSessions } from "~/test/helpers/session-context";
import * as schema from "~/server/db/schema";

describe("Database Schema and Constraints", () => {
  
  // =============================================================================
  // FOREIGN KEY CONSTRAINT TESTS
  // =============================================================================
  
  test("enforces foreign key constraints on issue creation", async ({ workerDb }) => {
    await withBusinessLogicTest(workerDb, async (db) => {
      // ARRANGE: Create organization first
      const [org] = await db.insert(schema.organizations).values({
        id: "constraint-test-org",
        name: "Constraint Test Organization",
      }).returning();
      
      const [user] = await db.insert(schema.users).values({
        id: "constraint-test-user",
        email: "constraint@test.com",
        name: "Constraint Tester",
      }).returning();
      
      // TEST: Valid foreign key reference succeeds
      const [validIssue] = await db.insert(schema.issues).values({
        title: "Valid FK Issue",
        organizationId: org.id, // Valid FK reference
        createdById: user.id, // Valid FK reference
        priority: "medium",
      }).returning();
      
      expect(validIssue).toBeDefined();
      expect(validIssue.organizationId).toBe(org.id);
      expect(validIssue.createdById).toBe(user.id);
      
      // ASSERT: Invalid foreign key reference fails
      await expect(
        db.insert(schema.issues).values({
          title: "Invalid FK Issue",
          organizationId: "nonexistent-org", // Invalid FK
          createdById: user.id,
          priority: "medium",
        })
      ).rejects.toThrow(/foreign key constraint/i);
      
      await expect(
        db.insert(schema.issues).values({
          title: "Invalid User FK Issue",
          organizationId: org.id,
          createdById: "nonexistent-user", // Invalid FK
          priority: "medium",
        })
      ).rejects.toThrow(/foreign key constraint/i);
    });
  });
  
  test("enforces cascading deletes correctly", async ({ workerDb }) => {
    await withBusinessLogicTest(workerDb, async (db) => {
      // ARRANGE: Create related data hierarchy
      const [org] = await db.insert(schema.organizations).values({
        id: "cascade-test-org",
        name: "Cascade Test Org",
      }).returning();
      
      const [user] = await db.insert(schema.users).values({
        id: "cascade-test-user",
        email: "cascade@test.com",
        name: "Cascade Tester",
      }).returning();
      
      const [machine] = await db.insert(schema.machines).values({
        name: "Cascade Test Machine",
        organizationId: org.id,
        ownerId: user.id,
        serialNumber: "CASCADE-001",
      }).returning();
      
      const [issue] = await db.insert(schema.issues).values({
        title: "Cascade Test Issue",
        machineId: machine.id, // FK to machine
        organizationId: org.id,
        createdById: user.id,
      }).returning();
      
      const [comment] = await db.insert(schema.comments).values({
        content: "Test comment",
        issueId: issue.id, // FK to issue
        createdById: user.id,
        organizationId: org.id,
      }).returning();
      
      // VERIFY: All data exists
      expect(issue).toBeDefined();
      expect(comment).toBeDefined();
      
      // ACT: Delete the machine (should cascade or restrict based on schema)
      try {
        await db.delete(schema.machines).where(eq(schema.machines.id, machine.id));
        
        // If delete succeeded, verify cascade behavior
        const remainingIssues = await db.query.issues.findMany({
          where: eq(schema.issues.machineId, machine.id),
        });
        
        // Depending on your schema: either cascaded delete or set NULL
        expect(remainingIssues.length).toBe(0); // If CASCADE DELETE
        // OR expect(remainingIssues[0].machineId).toBeNull(); // If SET NULL
        
      } catch (error) {
        // If delete failed, verify it's due to FK constraint (RESTRICT)
        expect(error).toBeDefined();
        
        // Machine should still exist
        const machine_still_exists = await db.query.machines.findFirst({
          where: eq(schema.machines.id, machine.id),
        });
        expect(machine_still_exists).toBeDefined();
      }
    });
  });
  
  // =============================================================================
  // UNIQUE CONSTRAINT TESTS
  // =============================================================================
  
  test("enforces unique constraints on machine serial numbers", async ({ workerDb }) => {
    await withBusinessLogicTest(workerDb, async (db) => {
      // ARRANGE: Create organization
      const [org] = await db.insert(schema.organizations).values({
        id: "unique-test-org",
        name: "Unique Test Org",
      }).returning();
      
      // TEST: First machine with serial number succeeds
      const [firstMachine] = await db.insert(schema.machines).values({
        name: "First Machine",
        serialNumber: "UNIQUE-TEST-001",
        organizationId: org.id,
      }).returning();
      
      expect(firstMachine).toBeDefined();
      expect(firstMachine.serialNumber).toBe("UNIQUE-TEST-001");
      
      // ASSERT: Duplicate serial number fails
      await expect(
        db.insert(schema.machines).values({
          name: "Duplicate Machine",
          serialNumber: "UNIQUE-TEST-001", // Duplicate
          organizationId: org.id,
        })
      ).rejects.toThrow(/unique constraint/i);
      
      // TEST: Different serial number succeeds
      const [secondMachine] = await db.insert(schema.machines).values({
        name: "Second Machine",
        serialNumber: "UNIQUE-TEST-002", // Different
        organizationId: org.id,
      }).returning();
      
      expect(secondMachine).toBeDefined();
      expect(secondMachine.serialNumber).toBe("UNIQUE-TEST-002");
    });
  });
  
  test("enforces unique constraints within organizational scope", async ({ workerDb }) => {
    await withBusinessLogicTest(workerDb, async (db) => {
      // ARRANGE: Create two organizations
      const [org1] = await db.insert(schema.organizations).values({
        id: "unique-org-1",
        name: "Unique Org 1",
      }).returning();
      
      const [org2] = await db.insert(schema.organizations).values({
        id: "unique-org-2",
        name: "Unique Org 2",
      }).returning();
      
      // TEST: Same name in different orgs should succeed (if scoped uniqueness)
      const [org1Machine] = await db.insert(schema.machines).values({
        name: "Machine A",
        organizationId: org1.id,
        serialNumber: "ORG1-001",
      }).returning();
      
      const [org2Machine] = await db.insert(schema.machines).values({
        name: "Machine A", // Same name, different org
        organizationId: org2.id,
        serialNumber: "ORG2-001", // Different serial
      }).returning();
      
      expect(org1Machine.name).toBe("Machine A");
      expect(org2Machine.name).toBe("Machine A");
      
      // ASSERT: Same serial across orgs fails (global uniqueness)
      await expect(
        db.insert(schema.machines).values({
          name: "Machine B",
          organizationId: org2.id,
          serialNumber: "ORG1-001", // Duplicate across orgs
        })
      ).rejects.toThrow(/unique constraint/i);
    });
  });
  
  // =============================================================================
  // CHECK CONSTRAINT TESTS
  // =============================================================================
  
  test("enforces check constraints on data validity", async ({ workerDb }) => {
    await withBusinessLogicTest(workerDb, async (db) => {
      // ARRANGE: Setup basic data
      const [org] = await db.insert(schema.organizations).values({
        id: "check-test-org",
        name: "Check Test Org",
      }).returning();
      
      const [user] = await db.insert(schema.users).values({
        id: "check-test-user",
        email: "check@test.com", // Valid email format
        name: "Check Tester",
      }).returning();
      
      // TEST: Valid data passes check constraints
      const [validIssue] = await db.insert(schema.issues).values({
        title: "Valid Issue", // Non-empty title
        priority: "medium", // Valid enum value
        organizationId: org.id,
        createdById: user.id,
      }).returning();
      
      expect(validIssue).toBeDefined();
      expect(validIssue.priority).toBe("medium");
      
      // ASSERT: Invalid enum value fails
      await expect(
        db.insert(schema.issues).values({
          title: "Invalid Priority Issue",
          priority: "invalid-priority" as any, // Invalid enum
          organizationId: org.id,
          createdById: user.id,
        })
      ).rejects.toThrow(); // Should fail enum constraint
      
      // ASSERT: Invalid email format fails (if email validation exists)
      await expect(
        db.insert(schema.users).values({
          id: "invalid-email-user",
          email: "not-an-email", // Invalid email format
          name: "Invalid User",
        })
      ).rejects.toThrow(/check constraint|invalid/i);
    });
  });
  
  test("enforces positive number constraints", async ({ workerDb }) => {
    await withBusinessLogicTest(workerDb, async (db) => {
      // ARRANGE: Setup organization
      const [org] = await db.insert(schema.organizations).values({
        id: "number-test-org",
        name: "Number Test Org",
      }).returning();
      
      // TEST: Valid positive numbers succeed
      const [validMachine] = await db.insert(schema.machines).values({
        name: "Valid Machine",
        organizationId: org.id,
        acquisitionCost: 15000, // Positive number
        maintenanceCost: 500, // Positive number
      }).returning();
      
      expect(validMachine.acquisitionCost).toBe(15000);
      expect(validMachine.maintenanceCost).toBe(500);
      
      // ASSERT: Negative numbers fail (if constraint exists)
      await expect(
        db.insert(schema.machines).values({
          name: "Negative Cost Machine",
          organizationId: org.id,
          acquisitionCost: -1000, // Negative
          maintenanceCost: 100,
        })
      ).rejects.toThrow(/check constraint/i);
    });
  });
  
  // =============================================================================
  // NOT NULL CONSTRAINT TESTS
  // =============================================================================
  
  test("enforces NOT NULL constraints on required fields", async ({ workerDb }) => {
    await withBusinessLogicTest(workerDb, async (db) => {
      // ARRANGE: Setup organization
      const [org] = await db.insert(schema.organizations).values({
        id: "notnull-test-org",
        name: "NotNull Test Org",
      }).returning();
      
      // TEST: All required fields provided succeeds
      const [validIssue] = await db.insert(schema.issues).values({
        title: "Valid Issue", // Required
        organizationId: org.id, // Required
        createdById: "test-user", // Required
        priority: "medium",
      }).returning();
      
      expect(validIssue).toBeDefined();
      expect(validIssue.title).toBe("Valid Issue");
      
      // ASSERT: Missing required field fails
      await expect(
        db.insert(schema.issues).values({
          // title: missing required field
          organizationId: org.id,
          createdById: "test-user",
          priority: "medium",
        } as any)
      ).rejects.toThrow(/not null constraint/i);
      
      await expect(
        db.insert(schema.issues).values({
          title: "Missing Org Issue",
          // organizationId: missing required field
          createdById: "test-user",
          priority: "medium",
        } as any)
      ).rejects.toThrow(/not null constraint/i);
    });
  });
  
  // =============================================================================
  // CONSTRAINT INTERACTION WITH RLS
  // =============================================================================
  
  test("RLS policies work with foreign key constraints", async ({ workerDb, organizationId }) => {
    await withRLSAwareTest(workerDb, organizationId, async (db) => {
      // ARRANGE: Set organizational context
      await testSessions.admin(db, organizationId, "admin-user");
      
      // Create machine in correct org context
      const [machine] = await db.insert(schema.machines).values({
        name: "RLS FK Test Machine",
        organizationId, // Should match RLS context
      }).returning();
      
      // TEST: Issue creation with valid FK and RLS context
      const [issue] = await db.insert(schema.issues).values({
        title: "RLS FK Test Issue",
        machineId: machine.id, // Valid FK
        // organizationId handled by RLS
        createdById: "admin-user",
      }).returning();
      
      expect(issue).toBeDefined();
      expect(issue.machineId).toBe(machine.id);
      expect(issue.organizationId).toBe(organizationId);
      
      // TEST: Cross-org FK reference should fail
      await testSessions.admin(db, "different-org", "different-admin");
      
      await expect(
        db.insert(schema.issues).values({
          title: "Cross-Org FK Issue",
          machineId: machine.id, // FK to machine in different org
          createdById: "different-admin",
        })
      ).rejects.toThrow(); // Should fail either FK constraint or RLS policy
    });
  });
  
  test("unique constraints respect organizational boundaries", async ({ workerDb }) => {
    await withRLSAwareTest(workerDb, "unique-rls-org-1", async (db) => {
      // ARRANGE: Create data in first org
      await testSessions.admin(db, "unique-rls-org-1", "admin-1");
      
      const [org1Machine] = await db.insert(schema.machines).values({
        name: "Unique RLS Machine",
        serialNumber: "RLS-UNIQUE-001",
        organizationId: "unique-rls-org-1",
      }).returning();
      
      expect(org1Machine).toBeDefined();
      
      // SWITCH: To second organization
      await testSessions.admin(db, "unique-rls-org-2", "admin-2");
      
      // TEST: Same serial in different org
      if (/* your schema has org-scoped uniqueness */ false) {
        // Should succeed if uniqueness is scoped to organization
        const [org2Machine] = await db.insert(schema.machines).values({
          name: "Another Unique Machine",
          serialNumber: "RLS-UNIQUE-001", // Same serial, different org
          organizationId: "unique-rls-org-2",
        }).returning();
        
        expect(org2Machine).toBeDefined();
      } else {
        // Should fail if uniqueness is global
        await expect(
          db.insert(schema.machines).values({
            name: "Another Unique Machine",
            serialNumber: "RLS-UNIQUE-001", // Duplicate across orgs
            organizationId: "unique-rls-org-2",
          })
        ).rejects.toThrow(/unique constraint/i);
      }
    });
  });
  
  // =============================================================================
  // INDEX AND PERFORMANCE CONSTRAINT TESTS
  // =============================================================================
  
  test("database indexes improve query performance", async ({ workerDb }) => {
    await withBusinessLogicTest(workerDb, async (db) => {
      // ARRANGE: Create large dataset
      const [org] = await db.insert(schema.organizations).values({
        id: "perf-test-org",
        name: "Performance Test Org",
      }).returning();
      
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        title: `Performance Issue ${i}`,
        organizationId: org.id,
        createdById: "perf-user",
        priority: i % 3 === 0 ? "high" : "medium" as const,
        status: i % 4 === 0 ? "closed" : "open" as const,
      }));
      
      await db.insert(schema.issues).values(largeDataset);
      
      // TEST: Indexed queries perform well
      const start = performance.now();
      
      const indexedQuery = await db.query.issues.findMany({
        where: and(
          eq(schema.issues.organizationId, org.id), // Should use index
          eq(schema.issues.priority, "high"), // Should use index
        ),
        limit: 50,
      });
      
      const duration = performance.now() - start;
      
      // ASSERT: Query completes quickly (assumes proper indexing)
      expect(duration).toBeLessThan(50); // Should be very fast with indexes
      expect(indexedQuery.length).toBeGreaterThan(0);
      expect(indexedQuery.length).toBeLessThanOrEqual(50);
    });
  });
  
  // =============================================================================
  // TRIGGER AND COMPUTED COLUMN TESTS
  // =============================================================================
  
  test("database triggers maintain data consistency", async ({ workerDb }) => {
    await withBusinessLogicTest(workerDb, async (db) => {
      // ARRANGE: Setup data for trigger testing
      const [org] = await db.insert(schema.organizations).values({
        id: "trigger-test-org",
        name: "Trigger Test Org",
      }).returning();
      
      const [user] = await db.insert(schema.users).values({
        id: "trigger-test-user",
        email: "trigger@test.com",
        name: "Trigger Tester",
      }).returning();
      
      // TEST: Insert trigger sets timestamps
      const [issue] = await db.insert(schema.issues).values({
        title: "Trigger Test Issue",
        organizationId: org.id,
        createdById: user.id,
      }).returning();
      
      // ASSERT: Timestamps were set by trigger
      expect(issue.createdAt).toBeInstanceOf(Date);
      expect(issue.updatedAt).toBeInstanceOf(Date);
      expect(issue.createdAt.getTime()).toBeLessThanOrEqual(issue.updatedAt.getTime());
      
      // Sleep briefly to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // TEST: Update trigger updates timestamp
      const [updated] = await db
        .update(schema.issues)
        .set({ title: "Updated by Trigger" })
        .where(eq(schema.issues.id, issue.id))
        .returning();
      
      // ASSERT: Update timestamp was changed
      expect(updated.updatedAt.getTime()).toBeGreaterThan(issue.updatedAt.getTime());
      expect(updated.createdAt.getTime()).toBe(issue.createdAt.getTime()); // Created unchanged
    });
  });
  
  test("computed columns calculate correctly", async ({ workerDb }) => {
    await withBusinessLogicTest(workerDb, async (db) => {
      // ARRANGE: Setup data with computed columns
      const [org] = await db.insert(schema.organizations).values({
        id: "computed-test-org",
        name: "Computed Test Org",
      }).returning();
      
      // TEST: Computed column calculation (if your schema has them)
      const [issue] = await db.insert(schema.issues).values({
        title: "Computed Test Issue",
        organizationId: org.id,
        createdById: "computed-user",
        estimatedHours: 8,
        actualHours: 10,
        // Computed column: variance = actualHours - estimatedHours
      }).returning();
      
      // ASSERT: Computed column is calculated correctly
      if ('hoursVariance' in issue) {
        expect((issue as any).hoursVariance).toBe(2); // 10 - 8 = 2
      }
      
      // TEST: Update recalculates computed column
      const [updated] = await db
        .update(schema.issues)
        .set({ actualHours: 12 })
        .where(eq(schema.issues.id, issue.id))
        .returning();
      
      if ('hoursVariance' in updated) {
        expect((updated as any).hoursVariance).toBe(4); // 12 - 8 = 4
      }
    });
  });
  
  // =============================================================================
  // CONSTRAINT ERROR HANDLING
  // =============================================================================
  
  test("provides meaningful constraint violation errors", async ({ workerDb }) => {
    await withBusinessLogicTest(workerDb, async (db) => {
      // ARRANGE: Setup for constraint violations
      const [org] = await db.insert(schema.organizations).values({
        id: "error-test-org",
        name: "Error Test Org",
      }).returning();
      
      // TEST: Different constraint violations have distinct error messages
      
      // Foreign key violation
      try {
        await db.insert(schema.issues).values({
          title: "FK Violation Issue",
          organizationId: "nonexistent-org",
          createdById: "nonexistent-user",
        });
        expect.fail("Should have thrown FK violation");
      } catch (error: any) {
        expect(error.message).toMatch(/foreign key|constraint/i);
      }
      
      // Unique constraint violation
      await db.insert(schema.machines).values({
        name: "Unique Test Machine",
        serialNumber: "ERROR-TEST-001",
        organizationId: org.id,
      });
      
      try {
        await db.insert(schema.machines).values({
          name: "Duplicate Machine",
          serialNumber: "ERROR-TEST-001", // Duplicate
          organizationId: org.id,
        });
        expect.fail("Should have thrown unique violation");
      } catch (error: any) {
        expect(error.message).toMatch(/unique|duplicate/i);
      }
      
      // Not null violation
      try {
        await db.insert(schema.issues).values({
          // title: missing required field
          organizationId: org.id,
          createdById: "test-user",
        } as any);
        expect.fail("Should have thrown not null violation");
      } catch (error: any) {
        expect(error.message).toMatch(/not null|required/i);
      }
    });
  });
});

// =============================================================================
// TEMPLATE USAGE INSTRUCTIONS
// =============================================================================

/*
SETUP INSTRUCTIONS:

1. Replace schema references with your actual database tables
2. Update constraint tests to match your specific database schema
3. Customize unique constraints for your organizational scoping needs
4. Add your specific check constraints and validation rules
5. Update trigger and computed column tests if you have them
6. Remove unused test cases and add schema-specific scenarios

SCHEMA/CONSTRAINT TEST CHARACTERISTICS:
- Tests database schema integrity and validation
- Tests foreign key relationships and cascade behavior
- Tests unique constraints and organizational scoping
- Tests check constraints and data validation rules
- Tests interaction between constraints and RLS policies

WHEN TO USE THIS TEMPLATE:
✅ Testing database schema constraints and validation
✅ Testing foreign key relationships and referential integrity
✅ Testing unique constraints and business rules
✅ Testing database triggers and computed columns
✅ Testing constraint interaction with RLS policies

WHEN NOT TO USE:
❌ Testing business logic (use Archetype 2)
❌ Testing application-level validation (use Archetype 5)
❌ Testing RLS policies directly (use Archetype 7)
❌ Testing pure functions (use Archetype 1)

BENEFITS OF RLS INTEGRATION:
✅ Tests how constraints work within organizational contexts
✅ Validates that RLS doesn't break constraint enforcement
✅ Tests constraint scoping (global vs organizational)
✅ Ensures data integrity across multi-tenant boundaries

EXAMPLE CONSTRAINTS TO TEST:
- Foreign key relationships between issues and machines
- Unique serial numbers within organizations
- Check constraints on enum values and data ranges
- Not null constraints on required fields
- Trigger behavior for timestamps and audit trails
*/