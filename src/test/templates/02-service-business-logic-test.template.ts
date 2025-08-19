/**
 * TEMPLATE: Archetype 2 - Service Business Logic Test
 * 
 * USE FOR: Testing service layer business logic with database interactions
 * RLS IMPACT: MASSIVELY SIMPLIFIED - No organizationId parameters needed
 * AGENT: integration-test-architect
 * 
 * CHARACTERISTICS:
 * - Tests service layer business logic
 * - Uses PGlite with integration_tester simulation (RLS bypassed)
 * - Focuses on business rules and workflows
 * - Fast execution (5x faster than RLS-enabled)
 * - Worker-scoped database for memory efficiency
 */

import { describe, test, expect, beforeAll } from "vitest";
import { eq, sql } from "drizzle-orm";
import { test as workerTest, withBusinessLogicTest } from "~/test/helpers/worker-scoped-db";
import { getSeededTestData } from "~/test/helpers/pglite-test-setup";
import * as schema from "~/server/db/schema";

// Import the service to test
// import { YourService } from "../path/to/your/service";

describe("YourService Business Logic", () => {
  
  // =============================================================================
  // SERVICE INSTANCE CREATION TESTS
  // =============================================================================
  
  test("creates service instance correctly", async ({ workerDb }) => {
    await withBusinessLogicTest(workerDb, async (db) => {
      // ARRANGE: Create service instance
      const service = new YourService(db);
      
      // ASSERT: Service is properly initialized
      expect(service).toBeDefined();
      expect(service.db).toBe(db);
    });
  });
  
  // =============================================================================
  // BUSINESS LOGIC CORE FUNCTIONALITY
  // =============================================================================
  
  test("creates resource with correct business logic", async ({ workerDb }) => {
    await withBusinessLogicTest(workerDb, async (db) => {
      // ARRANGE: Set up test data (direct creation - RLS bypassed)
      const [org] = await db.insert(schema.organizations).values({
        id: "test-org-service",
        name: "Service Test Organization",
      }).returning();
      
      const [user] = await db.insert(schema.users).values({
        id: "test-user-service",
        email: "service@test.com",
        name: "Service Tester",
      }).returning();
      
      const service = new YourService(db);
      
      // ACT: Call service method
      const result = await service.createResource({
        name: "Test Resource",
        organizationId: org.id, // Explicit assignment (no RLS coordination)
        createdById: user.id,
        // Add other required fields
      });
      
      // ASSERT: Business logic applied correctly
      expect(result).toBeDefined();
      expect(result.name).toBe("Test Resource");
      expect(result.organizationId).toBe(org.id);
      expect(result.createdById).toBe(user.id);
      
      // Verify business logic side effects
      expect(result.status).toBe("active"); // Default status applied
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.id).toBeDefined();
    });
  });
  
  test("updates resource with business validation", async ({ workerDb }) => {
    await withBusinessLogicTest(workerDb, async (db) => {
      // ARRANGE: Create initial data
      const { organizationId, user } = await createTestData(db);
      const service = new YourService(db);
      
      const [resource] = await db.insert(schema.yourTable).values({
        name: "Original Name",
        organizationId,
        createdById: user,
        status: "active",
      }).returning();
      
      // ACT: Update with business validation
      const updated = await service.updateResource(resource.id, {
        name: "Updated Name",
        description: "New description",
      });
      
      // ASSERT: Business logic validation applied
      expect(updated.name).toBe("Updated Name");
      expect(updated.description).toBe("New description");
      expect(updated.updatedAt).toBeInstanceOf(Date);
      expect(updated.updatedAt.getTime()).toBeGreaterThan(resource.createdAt.getTime());
      
      // Verify business invariants maintained
      expect(updated.organizationId).toBe(organizationId); // Unchanged
      expect(updated.createdById).toBe(user); // Unchanged
      expect(updated.id).toBe(resource.id); // Unchanged
    });
  });
  
  // =============================================================================
  // BUSINESS RULE VALIDATION
  // =============================================================================
  
  test("enforces business rule constraints", async ({ workerDb }) => {
    await withBusinessLogicTest(workerDb, async (db) => {
      const { organizationId, user } = await createTestData(db);
      const service = new YourService(db);
      
      // ACT & ASSERT: Test business rule violation
      await expect(
        service.createResource({
          name: "", // Invalid: empty name
          organizationId,
          createdById: user,
        })
      ).rejects.toThrow("Name cannot be empty");
      
      // Test another business rule
      await expect(
        service.createResource({
          name: "Valid Name",
          organizationId: "nonexistent-org", // Invalid org
          createdById: user,
        })
      ).rejects.toThrow("Organization not found");
    });
  });
  
  test("applies business logic calculations", async ({ workerDb }) => {
    await withBusinessLogicTest(workerDb, async (db) => {
      const { organizationId, user } = await createTestData(db);
      const service = new YourService(db);
      
      // ACT: Create resource with calculated fields
      const result = await service.createResourceWithCalculations({
        name: "Test Resource",
        organizationId,
        createdById: user,
        inputValue: 100,
        multiplier: 1.5,
      });
      
      // ASSERT: Calculations applied correctly
      expect(result.calculatedValue).toBe(150); // 100 * 1.5
      expect(result.category).toBe("high"); // Based on calculated value
      expect(result.priority).toBe("normal"); // Based on business rules
    });
  });
  
  // =============================================================================
  // COMPLEX BUSINESS WORKFLOWS
  // =============================================================================
  
  test("handles complex workflow correctly", async ({ workerDb }) => {
    await withBusinessLogicTest(workerDb, async (db) => {
      const { organizationId, user } = await createTestData(db);
      const service = new YourService(db);
      
      // ARRANGE: Multi-step workflow setup
      const [initialResource] = await db.insert(schema.yourTable).values({
        name: "Workflow Resource",
        organizationId,
        createdById: user,
        status: "draft",
        workflowStage: 1,
      }).returning();
      
      // ACT: Execute workflow progression
      const step1Result = await service.progressWorkflow(initialResource.id, {
        action: "submit",
        reviewerNotes: "Ready for review",
      });
      
      expect(step1Result.status).toBe("pending_review");
      expect(step1Result.workflowStage).toBe(2);
      
      const step2Result = await service.progressWorkflow(initialResource.id, {
        action: "approve",
        reviewerNotes: "Approved by reviewer",
      });
      
      expect(step2Result.status).toBe("approved");
      expect(step2Result.workflowStage).toBe(3);
      
      // ASSERT: Workflow side effects created
      const workflowHistory = await db.query.workflowHistory.findMany({
        where: eq(schema.workflowHistory.resourceId, initialResource.id),
      });
      
      expect(workflowHistory).toHaveLength(2);
      expect(workflowHistory[0].action).toBe("submit");
      expect(workflowHistory[1].action).toBe("approve");
    });
  });
  
  // =============================================================================
  // ERROR HANDLING AND EDGE CASES
  // =============================================================================
  
  test("handles resource not found gracefully", async ({ workerDb }) => {
    await withBusinessLogicTest(workerDb, async (db) => {
      const service = new YourService(db);
      
      await expect(
        service.getResourceById("nonexistent-id")
      ).rejects.toThrow("Resource not found");
      
      await expect(
        service.updateResource("nonexistent-id", { name: "New Name" })
      ).rejects.toThrow("Resource not found");
    });
  });
  
  test("handles concurrent modifications", async ({ workerDb }) => {
    await withBusinessLogicTest(workerDb, async (db) => {
      const { organizationId, user } = await createTestData(db);
      const service1 = new YourService(db);
      const service2 = new YourService(db);
      
      // ARRANGE: Create resource
      const [resource] = await db.insert(schema.yourTable).values({
        name: "Concurrent Test",
        organizationId,
        createdById: user,
        version: 1,
      }).returning();
      
      // ACT: Simulate concurrent updates
      const update1 = service1.updateResource(resource.id, {
        name: "Update 1",
        expectedVersion: 1,
      });
      
      const update2 = service2.updateResource(resource.id, {
        name: "Update 2", 
        expectedVersion: 1,
      });
      
      // ASSERT: One succeeds, one fails with version conflict
      const results = await Promise.allSettled([update1, update2]);
      const successes = results.filter(r => r.status === "fulfilled").length;
      const failures = results.filter(r => r.status === "rejected").length;
      
      expect(successes).toBe(1);
      expect(failures).toBe(1);
    });
  });
  
  // =============================================================================
  // PERFORMANCE AND OPTIMIZATION
  // =============================================================================
  
  test("bulk operations perform efficiently", async ({ workerDb }) => {
    await withBusinessLogicTest(workerDb, async (db) => {
      const { organizationId, user } = await createTestData(db);
      const service = new YourService(db);
      
      // ARRANGE: Prepare bulk data
      const bulkData = Array.from({ length: 100 }, (_, i) => ({
        name: `Bulk Resource ${i}`,
        organizationId,
        createdById: user,
      }));
      
      // ACT: Execute bulk operation
      const start = performance.now();
      const results = await service.bulkCreateResources(bulkData);
      const duration = performance.now() - start;
      
      // ASSERT: Performance and correctness
      expect(results).toHaveLength(100);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
      expect(results.every(r => r.organizationId === organizationId)).toBe(true);
    });
  });
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function createTestData(db: any) {
  const [org] = await db.insert(schema.organizations).values({
    id: `test-org-${Date.now()}`,
    name: "Service Test Org",
  }).returning();
  
  const [user] = await db.insert(schema.users).values({
    id: `test-user-${Date.now()}`,
    email: `test-${Date.now()}@example.com`,
    name: "Test User",
  }).returning();
  
  return {
    organizationId: org.id,
    user: user.id,
    organization: org,
    userRecord: user,
  };
}

// =============================================================================
// TEMPLATE USAGE INSTRUCTIONS
// =============================================================================

/*
SETUP INSTRUCTIONS:

1. Replace 'YourService' with your actual service class name
2. Update import paths for your service and schema
3. Replace 'yourTable' with your actual database table/schema
4. Customize business logic tests for your specific service
5. Update helper functions for your data requirements
6. Remove unused test cases

SERVICE CHARACTERISTICS:
- Business logic layer between tRPC and database
- Handles complex business rules and validations  
- Manages workflows and state transitions
- Enforces business constraints and invariants
- Provides abstraction over database operations

WHEN TO USE THIS TEMPLATE:
✅ Testing service classes with business logic
✅ Testing complex business workflows
✅ Testing business rule validation
✅ Testing state transitions and workflows
✅ Testing business calculations and derivations

WHEN NOT TO USE:
❌ Pure functions without database interaction (use Archetype 1)
❌ React components (use Archetype 4)
❌ tRPC routers (use Archetype 5)
❌ Database schema tests (use Archetype 8)

BENEFITS OF RLS BYPASS IN THIS ARCHETYPE:
✅ 5x faster execution without RLS overhead
✅ Direct data creation without organizational setup
✅ Focus purely on business logic without security concerns
✅ Simplified test setup and data management

EXAMPLE SERVICES SUITABLE FOR THIS TEMPLATE:
- IssueService: Business logic for issue management
- MachineService: Business logic for machine operations
- UserService: Business logic for user management
- ReportingService: Business logic for report generation
- NotificationService: Business logic for notifications
*/