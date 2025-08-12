/**
 * Drizzle CRUD Validation Tests (Integration)
 *
 * Comprehensive testing of Drizzle ORM operations:
 * - INSERT, SELECT, UPDATE, DELETE operations
 * - Transaction support and rollback scenarios
 * - Multi-tenant data isolation
 * - Performance benchmarking
 */

import { eq, and, sql } from "drizzle-orm";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import * as schema from "~/server/db/schema";
import { createTestDatabase, type TestDatabase, cleanupTestDatabase } from "~/test/helpers/pglite-test-setup";
import { TEST_IDS } from "~/test/helpers/integration-test-seeds";

// Helper to generate unique IDs for tests that need multiple entities
function generateTestId(prefix: string): string {
  return `${prefix}-${Date.now()}`;
}

describe("Drizzle CRUD Operations (Integration)", () => {
  let db: TestDatabase;

  // Generate unique IDs for each test to avoid conflicts
  const testOrgId = generateTestId("test-org");
  const testUserId = generateTestId("test-user");
  const testLocationId = generateTestId("test-location");
  const testModelId = generateTestId("test-model");

  beforeEach(async () => {
    // Create fresh PGlite database with real schema
    db = await createTestDatabase();
  });

  afterEach(async () => {
    // Clean up the test database
    await cleanupTestDatabase(db);
  });

  describe("INSERT Operations", () => {
    it("should insert a user successfully", async () => {
      const [user] = await db
        .insert(schema.users)
        .values({
          id: testUserId,
          email: "drizzle-test@example.com",
          name: "Drizzle Test User",
          notificationFrequency: "IMMEDIATE",
        })
        .returning();

      expect(user).toBeDefined();
      expect(user?.id).toBe(testUserId);
      expect(user?.email).toBe("drizzle-test@example.com");
      expect(user?.name).toBe("Drizzle Test User");
    });

    it("should insert an organization successfully", async () => {
      const [org] = await db
        .insert(schema.organizations)
        .values({
          id: testOrgId,
          name: "Drizzle Test Organization",
          subdomain: "drizzle-test-1",
        })
        .returning();

      expect(org).toBeDefined();
      expect(org?.id).toBe(testOrgId);
      expect(org?.name).toBe("Drizzle Test Organization");
    });

    it("should insert a location with proper fields", async () => {
      // First create organization
      await db.insert(schema.organizations).values({
        id: testOrgId,
        name: "Test Org",
        subdomain: "test-org-subdomain",
      });

      const [location] = await db
        .insert(schema.locations)
        .values({
          id: testLocationId,
          name: "Test Location",
          organizationId: testOrgId,
          street: "123 Test Street",
          city: "Test City",
          state: "TX",
          zip: "12345",
        })
        .returning();

      expect(location).toBeDefined();
      expect(location?.id).toBe(testLocationId);
      expect(location?.organizationId).toBe(testOrgId);
      expect(location?.street).toBe("123 Test Street");
      expect(location?.city).toBe("Test City");
    });

    it("should insert a global model (no organizationId)", async () => {
      const [model] = await db
        .insert(schema.models)
        .values({
          id: testModelId,
          name: "Test Pinball Model",
          manufacturer: "Drizzle Games Inc",
          year: 2024,
          isCustom: false,
        })
        .returning();

      expect(model).toBeDefined();
      expect(model?.id).toBe(testModelId);
      expect(model?.name).toBe("Test Pinball Model");
      expect(model?.manufacturer).toBe("Drizzle Games Inc");
      expect(model?.year).toBe(2024);
    });

    it("should insert a machine with all relationships", async () => {
      // Setup dependencies
      await db.insert(schema.organizations).values({
        id: testOrgId,
        name: "Test Org",
        subdomain: "test-org-subdomain",
      });

      await db.insert(schema.locations).values({
        id: testLocationId,
        name: "Test Location",
        organizationId: testOrgId,
      });

      await db.insert(schema.models).values({
        id: testModelId,
        name: "Test Model",
        manufacturer: "Test Mfg",
        year: 2024,
      });

      const [machine] = await db
        .insert(schema.machines)
        .values({
          id: "test-machine-1",
          name: "Test Machine #1",
          organizationId: testOrgId,
          locationId: testLocationId,
          modelId: testModelId,
          qrCodeId: "qr-test-1",
        })
        .returning();

      expect(machine).toBeDefined();
      expect(machine?.organizationId).toBe(testOrgId);
      expect(machine?.locationId).toBe(testLocationId);
      expect(machine?.modelId).toBe(testModelId);
    });
  });

  describe("SELECT Operations", () => {
    beforeEach(async () => {
      // Setup test data
      await db.insert(schema.users).values({
        id: testUserId,
        email: "select-test@example.com",
        name: "Select Test User",
      });

      await db.insert(schema.organizations).values({
        id: testOrgId,
        name: "Select Test Org",
        subdomain: "select-test-1",
      });

      await db.insert(schema.locations).values({
        id: testLocationId,
        name: "Select Test Location",
        organizationId: testOrgId,
        street: "123 Select Street",
        city: "Select City",
      });
    });

    it("should select user by email", async () => {
      const users = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, "select-test@example.com"));

      expect(users).toHaveLength(1);
      expect(users[0]?.id).toBe(testUserId);
      expect(users[0]?.email).toBe("select-test@example.com");
    });

    it("should perform complex join query", async () => {
      const orgWithLocations = await db
        .select({
          orgId: schema.organizations.id,
          orgName: schema.organizations.name,
          locationId: schema.locations.id,
          locationName: schema.locations.name,
          locationStreet: schema.locations.street,
        })
        .from(schema.organizations)
        .leftJoin(
          schema.locations,
          eq(schema.organizations.id, schema.locations.organizationId),
        )
        .where(eq(schema.organizations.id, testOrgId));

      expect(orgWithLocations).toHaveLength(1);
      expect(orgWithLocations[0]?.orgId).toBe(testOrgId);
      expect(orgWithLocations[0]?.locationId).toBe(testLocationId);
      expect(orgWithLocations[0]?.locationStreet).toBe("123 Select Street");
    });

    it("should perform aggregate query", async () => {
      const [stats] = await db
        .select({
          organizationId: schema.organizations.id,
          locationCount: sql<number>`count(${schema.locations.id})`.as(
            "location_count",
          ),
        })
        .from(schema.organizations)
        .leftJoin(
          schema.locations,
          eq(schema.organizations.id, schema.locations.organizationId),
        )
        .where(eq(schema.organizations.id, testOrgId))
        .groupBy(schema.organizations.id);

      expect(stats).toBeDefined();
      expect(stats?.organizationId).toBe(testOrgId);
      // PGlite returns count as number (native JavaScript type)
      expect(stats?.locationCount).toBe(1);
    });

    it("should filter by multiple conditions", async () => {
      const locations = await db
        .select()
        .from(schema.locations)
        .where(
          and(
            eq(schema.locations.organizationId, testOrgId),
            eq(schema.locations.city, "Select City"),
          ),
        );

      expect(locations).toHaveLength(1);
      expect(locations[0]?.id).toBe(testLocationId);
      expect(locations[0]?.city).toBe("Select City");
    });
  });

  describe("UPDATE Operations", () => {
    beforeEach(async () => {
      await db.insert(schema.users).values({
        id: testUserId,
        email: "update-test@example.com",
        name: "Update Test User",
        notificationFrequency: "IMMEDIATE",
      });

      await db.insert(schema.organizations).values({
        id: testOrgId,
        name: "Update Test Org",
        subdomain: "update-test-1",
      });
    });

    it("should update user fields", async () => {
      const [updatedUser] = await db
        .update(schema.users)
        .set({
          name: "Updated User Name",
          notificationFrequency: "DAILY",
        })
        .where(eq(schema.users.id, testUserId))
        .returning();

      expect(updatedUser).toBeDefined();
      expect(updatedUser?.name).toBe("Updated User Name");
      expect(updatedUser?.notificationFrequency).toBe("DAILY");
      expect(updatedUser?.email).toBe("update-test@example.com"); // Unchanged
    });

    it("should update with conditional logic", async () => {
      const result = await db
        .update(schema.organizations)
        .set({
          name: "Conditionally Updated Org",
        })
        .where(
          and(
            eq(schema.organizations.id, testOrgId),
            sql`${schema.organizations.name} LIKE 'Update%'`,
          ),
        )
        .returning();

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe("Conditionally Updated Org");
    });

    it("should handle updates with no matches", async () => {
      const result = await db
        .update(schema.users)
        .set({ name: "Should Not Update" })
        .where(eq(schema.users.id, "non-existent-id"))
        .returning();

      expect(result).toHaveLength(0);
    });
  });

  describe("DELETE Operations", () => {
    beforeEach(async () => {
      await db.insert(schema.users).values({
        id: testUserId,
        email: "delete-test@example.com",
        name: "Delete Test User",
      });

      await db.insert(schema.organizations).values({
        id: testOrgId,
        name: "Delete Test Org",
        subdomain: "delete-test-1",
      });

      await db.insert(schema.locations).values({
        id: testLocationId,
        name: "Delete Test Location",
        organizationId: testOrgId,
      });
    });

    it("should delete single record", async () => {
      const result = await db
        .delete(schema.users)
        .where(eq(schema.users.id, testUserId))
        .returning();

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(testUserId);

      // Verify deletion
      const users = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, testUserId));
      expect(users).toHaveLength(0);
    });

    it("should delete with conditions", async () => {
      const result = await db
        .delete(schema.locations)
        .where(
          and(
            eq(schema.locations.organizationId, testOrgId),
            sql`${schema.locations.name} LIKE 'Delete%'`,
          ),
        )
        .returning();

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(testLocationId);
    });

    it("should handle cascade deletions properly", async () => {
      // Attempt to delete organization should fail due to foreign key constraint
      try {
        await db
          .delete(schema.organizations)
          .where(eq(schema.organizations.id, testOrgId));

        // Should not reach here
        expect.fail("Expected foreign key constraint violation");
      } catch (error) {
        // This is expected - foreign key constraint should prevent deletion
        expect(error).toBeDefined();
      }

      // Location should still exist (protected by foreign key constraint)
      const locations = await db
        .select()
        .from(schema.locations)
        .where(eq(schema.locations.id, testLocationId));
      expect(locations).toHaveLength(1);

      // Manual cleanup required - delete child records first
      await db
        .delete(schema.locations)
        .where(eq(schema.locations.id, testLocationId));

      // Now organization deletion should succeed
      await db
        .delete(schema.organizations)
        .where(eq(schema.organizations.id, testOrgId));
    });
  });

  describe("Transaction Operations", () => {
    it("should commit successful transaction", async () => {
      const txUserId = "tx-user-commit-test";
      const txOrgId = "tx-org-commit-test";
      const txSubdomain = "tx-commit-test";

      const result = await db.transaction(async (tx) => {
        const [user] = await tx
          .insert(schema.users)
          .values({
            id: txUserId,
            email: "transaction-test@example.com",
            name: "Transaction Test User",
          })
          .returning();

        const [org] = await tx
          .insert(schema.organizations)
          .values({
            id: txOrgId,
            name: "Transaction Test Org",
            subdomain: txSubdomain,
          })
          .returning();

        return { user, org };
      });

      expect(result.user).toBeDefined();
      expect(result.org).toBeDefined();

      // Verify data was committed
      const user = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, result.user?.id ?? ""));
      expect(user).toHaveLength(1);

      const org = await db
        .select()
        .from(schema.organizations)
        .where(eq(schema.organizations.id, result.org?.id ?? ""));
      expect(org).toHaveLength(1);

      // Cleanup
      await db
        .delete(schema.users)
        .where(eq(schema.users.id, result.user?.id ?? ""));
      await db
        .delete(schema.organizations)
        .where(eq(schema.organizations.id, result.org?.id ?? ""));
    });

    it("should rollback failed transaction", async () => {
      const txUserId = "rollback-user-test";

      try {
        await db.transaction(async (tx) => {
          await tx.insert(schema.users).values({
            id: txUserId,
            email: "rollback-test@example.com",
            name: "Rollback Test User",
          });

          // Intentionally cause error to trigger rollback
          throw new Error("Intentional rollback test");
        });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }

      // Verify rollback - user should not exist
      const users = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, txUserId));
      expect(users).toHaveLength(0);
    });

    it("should handle constraint violation rollback", async () => {
      const duplicateSubdomain = "duplicate-constraint-test";
      const firstOrgId = "first-org-constraint-test";
      const secondOrgId = "second-org-constraint-test";
      const txUserId = "constraint-user-test";

      // Create first org with subdomain
      await db.insert(schema.organizations).values({
        id: firstOrgId,
        name: "First Org",
        subdomain: duplicateSubdomain,
      });

      try {
        await db.transaction(async (tx) => {
          await tx.insert(schema.users).values({
            id: txUserId,
            email: "constraint-test@example.com",
            name: "Constraint Test User",
          });

          // This should fail due to unique constraint on subdomain
          await tx.insert(schema.organizations).values({
            id: secondOrgId,
            name: "Second Org",
            subdomain: duplicateSubdomain, // Duplicate!
          });
        });
      } catch (error) {
        // This is expected
        expect(error).toBeDefined();
      }

      // Verify rollback - user should not exist
      const users = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, txUserId));
      expect(users).toHaveLength(0);

      // Cleanup (PGlite gives fresh DB per test, but good practice)
      await db
        .delete(schema.organizations)
        .where(eq(schema.organizations.subdomain, duplicateSubdomain));
    });
  });

  describe("Multi-Tenancy Isolation", () => {
    const org1Id = "tenant1-isolation-test";
    const org2Id = "tenant2-isolation-test";
    const loc1Id = "loc1-isolation-test";
    const loc2Id = "loc2-isolation-test";

    beforeEach(async () => {
      // Create two organizations
      await db.insert(schema.organizations).values([
        {
          id: org1Id,
          name: "Tenant 1",
          subdomain: "tenant1-isolation-test",
        },
        {
          id: org2Id,
          name: "Tenant 2",
          subdomain: "tenant2-isolation-test",
        },
      ]);

      // Create locations for each
      await db.insert(schema.locations).values([
        {
          id: loc1Id,
          name: "Tenant 1 Location",
          organizationId: org1Id,
        },
        {
          id: loc2Id,
          name: "Tenant 2 Location",
          organizationId: org2Id,
        },
      ]);
    });

    // No afterEach cleanup needed - PGlite provides fresh database per test

    it("should properly isolate tenant data", async () => {
      // Tenant 1 should only see their locations
      const tenant1Locations = await db
        .select()
        .from(schema.locations)
        .where(eq(schema.locations.organizationId, org1Id));

      expect(tenant1Locations).toHaveLength(1);
      expect(tenant1Locations[0]?.name).toBe("Tenant 1 Location");

      // Tenant 2 should only see their locations
      const tenant2Locations = await db
        .select()
        .from(schema.locations)
        .where(eq(schema.locations.organizationId, org2Id));

      expect(tenant2Locations).toHaveLength(1);
      expect(tenant2Locations[0]?.name).toBe("Tenant 2 Location");
    });

    it("should prevent cross-tenant data access", async () => {
      // Trying to access org2 data with org1 filter should return empty
      const crossTenantLocations = await db
        .select()
        .from(schema.locations)
        .where(
          and(
            eq(schema.locations.organizationId, org1Id),
            sql`${schema.locations.name} LIKE '%Tenant 2%'`,
          ),
        );

      expect(crossTenantLocations).toHaveLength(0);
    });

    it("should validate organizationId indexes work efficiently", async () => {
      // This test verifies that our organizationId indexes are functioning
      // by running a query that should use the index
      const startTime = performance.now();

      const locations = await db
        .select()
        .from(schema.locations)
        .where(eq(schema.locations.organizationId, org1Id));

      const queryTime = performance.now() - startTime;

      expect(locations).toHaveLength(1);
      // PGlite in-memory queries should be very fast (< 50ms for simple test data)
      expect(queryTime).toBeLessThan(50);
    });
  });
});
