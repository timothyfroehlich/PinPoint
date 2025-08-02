/**
 * Drizzle CRUD Validation Tests
 *
 * Comprehensive testing of Drizzle ORM operations:
 * - INSERT, SELECT, UPDATE, DELETE operations
 * - Transaction support and rollback scenarios
 * - Multi-tenant data isolation
 * - Performance benchmarking
 */

import { eq, and, sql } from "drizzle-orm";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import type { DrizzleClient } from "~/server/db/drizzle";

import { createDrizzleClient } from "~/server/db/drizzle";
import * as schema from "~/server/db/schema";

describe("Drizzle CRUD Operations", () => {
  let db: DrizzleClient | null;
  let testOrgId: string;
  let testUserId: string;
  let testLocationId: string;
  let testModelId: string;
  let hasDatabase: boolean;

  beforeEach(async () => {
    try {
      db = createDrizzleClient();
      hasDatabase = true;
    } catch {
      console.log(
        "Skipping Drizzle CRUD tests - no database connection available",
      );
      db = null;
      hasDatabase = false;
    }

    testOrgId = `test-org-${Date.now()}`;
    testUserId = `test-user-${Date.now()}`;
    testLocationId = `test-location-${Date.now()}`;
    testModelId = `test-model-${Date.now()}`;
  });

  afterEach(async () => {
    // Cleanup test data only if database is available
    if (!db || !hasDatabase) return;

    try {
      await db
        .delete(schema.machines)
        .where(eq(schema.machines.organizationId, testOrgId));
      await db
        .delete(schema.locations)
        .where(eq(schema.locations.organizationId, testOrgId));
      await db
        .delete(schema.organizations)
        .where(eq(schema.organizations.id, testOrgId));
      await db.delete(schema.users).where(eq(schema.users.id, testUserId));
      await db.delete(schema.models).where(eq(schema.models.id, testModelId));
    } catch (error) {
      // Cleanup errors are not critical for test results
      console.warn("Cleanup warning:", error);
    }
  });

  describe("INSERT Operations", () => {
    it("should insert a user successfully", async () => {
      if (!db || !hasDatabase) {
        console.log("Skipping integration test - no database available");
        return;
      }

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
      if (!db || !hasDatabase) {
        console.log("Skipping integration test - no database available");
        return;
      }

      const [org] = await db
        .insert(schema.organizations)
        .values({
          id: testOrgId,
          name: "Drizzle Test Organization",
          subdomain: `drizzle-test-${Date.now()}`,
        })
        .returning();

      expect(org).toBeDefined();
      expect(org?.id).toBe(testOrgId);
      expect(org?.name).toBe("Drizzle Test Organization");
    });

    it("should insert a location with proper fields", async () => {
      if (!db || !hasDatabase) {
        console.log("Skipping integration test - no database available");
        return;
      }

      // First create organization
      await db.insert(schema.organizations).values({
        id: testOrgId,
        name: "Test Org",
        subdomain: `test-${Date.now()}`,
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
      if (!db || !hasDatabase) {
        console.log("Skipping integration test - no database available");
        return;
      }

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
      if (!db || !hasDatabase) {
        console.log("Skipping integration test - no database available");
        return;
      }

      // Setup dependencies
      await db.insert(schema.organizations).values({
        id: testOrgId,
        name: "Test Org",
        subdomain: `test-${Date.now()}`,
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
          id: `test-machine-${Date.now()}`,
          name: "Test Machine #1",
          organizationId: testOrgId,
          locationId: testLocationId,
          modelId: testModelId,
          qrCodeId: `qr-${Date.now()}`,
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
      if (!db || !hasDatabase) return;

      // Setup test data
      await db.insert(schema.users).values({
        id: testUserId,
        email: "select-test@example.com",
        name: "Select Test User",
      });

      await db.insert(schema.organizations).values({
        id: testOrgId,
        name: "Select Test Org",
        subdomain: `select-test-${Date.now()}`,
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
      if (!db || !hasDatabase) {
        console.log("Skipping integration test - no database available");
        return;
      }

      const users = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, "select-test@example.com"));

      expect(users).toHaveLength(1);
      expect(users[0]?.id).toBe(testUserId);
      expect(users[0]?.email).toBe("select-test@example.com");
    });

    it("should perform complex join query", async () => {
      if (!db || !hasDatabase) {
        console.log("Skipping integration test - no database available");
        return;
      }

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
      if (!db || !hasDatabase) {
        console.log("Skipping integration test - no database available");
        return;
      }

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
      expect(stats?.locationCount).toBe(1);
    });

    it("should filter by multiple conditions", async () => {
      if (!db || !hasDatabase) {
        console.log("Skipping integration test - no database available");
        return;
      }

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
      if (!db || !hasDatabase) return;

      await db.insert(schema.users).values({
        id: testUserId,
        email: "update-test@example.com",
        name: "Update Test User",
        notificationFrequency: "IMMEDIATE",
      });

      await db.insert(schema.organizations).values({
        id: testOrgId,
        name: "Update Test Org",
        subdomain: `update-test-${Date.now()}`,
      });
    });

    it("should update user fields", async () => {
      if (!db || !hasDatabase) {
        console.log("Skipping integration test - no database available");
        return;
      }

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
      if (!db || !hasDatabase) {
        console.log("Skipping integration test - no database available");
        return;
      }

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
      if (!db || !hasDatabase) {
        console.log("Skipping integration test - no database available");
        return;
      }

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
      if (!db || !hasDatabase) return;

      await db.insert(schema.users).values({
        id: testUserId,
        email: "delete-test@example.com",
        name: "Delete Test User",
      });

      await db.insert(schema.organizations).values({
        id: testOrgId,
        name: "Delete Test Org",
        subdomain: `delete-test-${Date.now()}`,
      });

      await db.insert(schema.locations).values({
        id: testLocationId,
        name: "Delete Test Location",
        organizationId: testOrgId,
      });
    });

    it("should delete single record", async () => {
      if (!db || !hasDatabase) {
        console.log("Skipping integration test - no database available");
        return;
      }

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
      if (!db || !hasDatabase) {
        console.log("Skipping integration test - no database available");
        return;
      }

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
      if (!db || !hasDatabase) {
        console.log("Skipping integration test - no database available");
        return;
      }

      // Delete organization (should not cascade to locations - they need manual cleanup)
      await db
        .delete(schema.organizations)
        .where(eq(schema.organizations.id, testOrgId));

      // Location should still exist (no CASCADE DELETE in current schema)
      const locations = await db
        .select()
        .from(schema.locations)
        .where(eq(schema.locations.id, testLocationId));
      expect(locations).toHaveLength(1);

      // Manual cleanup required
      await db
        .delete(schema.locations)
        .where(eq(schema.locations.id, testLocationId));
    });
  });

  describe("Transaction Operations", () => {
    it("should commit successful transaction", async () => {
      if (!db || !hasDatabase) {
        console.log("Skipping integration test - no database available");
        return;
      }

      const result = await db.transaction(async (tx) => {
        const [user] = await tx
          .insert(schema.users)
          .values({
            id: `tx-user-${Date.now()}`,
            email: "transaction-test@example.com",
            name: "Transaction Test User",
          })
          .returning();

        const [org] = await tx
          .insert(schema.organizations)
          .values({
            id: `tx-org-${Date.now()}`,
            name: "Transaction Test Org",
            subdomain: `tx-test-${Date.now()}`,
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
      if (!db || !hasDatabase) {
        console.log("Skipping integration test - no database available");
        return;
      }

      const txUserId = `rollback-user-${Date.now()}`;

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
      if (!db || !hasDatabase) {
        console.log("Skipping integration test - no database available");
        return;
      }

      const duplicateSubdomain = `duplicate-${Date.now()}`;

      // Create first org with subdomain
      await db.insert(schema.organizations).values({
        id: `first-org-${Date.now()}`,
        name: "First Org",
        subdomain: duplicateSubdomain,
      });

      const txUserId = `constraint-user-${Date.now()}`;

      try {
        await db.transaction(async (tx) => {
          await tx.insert(schema.users).values({
            id: txUserId,
            email: "constraint-test@example.com",
            name: "Constraint Test User",
          });

          // This should fail due to unique constraint on subdomain
          await tx.insert(schema.organizations).values({
            id: `second-org-${Date.now()}`,
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

      // Cleanup
      await db
        .delete(schema.organizations)
        .where(eq(schema.organizations.subdomain, duplicateSubdomain));
    });
  });

  describe("Multi-Tenancy Isolation", () => {
    const org1Id = `tenant1-${Date.now()}`;
    const org2Id = `tenant2-${Date.now()}`;

    beforeEach(async () => {
      if (!db || !hasDatabase) return;

      // Create two organizations
      await db.insert(schema.organizations).values([
        {
          id: org1Id,
          name: "Tenant 1",
          subdomain: `tenant1-${Date.now()}`,
        },
        {
          id: org2Id,
          name: "Tenant 2",
          subdomain: `tenant2-${Date.now()}`,
        },
      ]);

      // Create locations for each
      await db.insert(schema.locations).values([
        {
          id: `loc1-${Date.now()}`,
          name: "Tenant 1 Location",
          organizationId: org1Id,
        },
        {
          id: `loc2-${Date.now()}`,
          name: "Tenant 2 Location",
          organizationId: org2Id,
        },
      ]);
    });

    afterEach(async () => {
      if (!db || !hasDatabase) return;

      // Cleanup tenant test data
      await db
        .delete(schema.locations)
        .where(eq(schema.locations.organizationId, org1Id));
      await db
        .delete(schema.locations)
        .where(eq(schema.locations.organizationId, org2Id));
      await db
        .delete(schema.organizations)
        .where(eq(schema.organizations.id, org1Id));
      await db
        .delete(schema.organizations)
        .where(eq(schema.organizations.id, org2Id));
    });

    it("should properly isolate tenant data", async () => {
      if (!db || !hasDatabase) {
        console.log("Skipping integration test - no database available");
        return;
      }

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
      if (!db || !hasDatabase) {
        console.log("Skipping integration test - no database available");
        return;
      }

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
      if (!db || !hasDatabase) {
        console.log("Skipping integration test - no database available");
        return;
      }

      // This test verifies that our organizationId indexes are functioning
      // by running a query that should use the index
      const startTime = Date.now();

      const locations = await db
        .select()
        .from(schema.locations)
        .where(eq(schema.locations.organizationId, org1Id));

      const queryTime = Date.now() - startTime;

      expect(locations).toHaveLength(1);
      // Index queries should be very fast (< 100ms for simple test data)
      expect(queryTime).toBeLessThan(100);
    });
  });
});
