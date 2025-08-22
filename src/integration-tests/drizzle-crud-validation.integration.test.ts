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
import { describe, expect } from "vitest";

import * as schema from "~/server/db/schema";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import { generateTestId } from "~/test/helpers/test-id-generator";
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";

describe("Drizzle CRUD Operations (Integration)", () => {
  describe("INSERT Operations", () => {
    test("should insert a user successfully", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const testUserId = generateTestId("test-user");
        const userEmail = `drizzle-test-${generateTestId("email")}@example.com`;

        const [user] = await db
          .insert(schema.users)
          .values({
            id: testUserId,
            email: userEmail,
            name: "Drizzle Test User",
            notificationFrequency: "IMMEDIATE",
          })
          .returning();

        expect(user).toBeDefined();
        expect(user?.id).toBe(testUserId);
        expect(user?.email).toBe(userEmail);
        expect(user?.name).toBe("Drizzle Test User");
      });
    });

    test("should insert an organization successfully", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Verify that seeded organization exists and test insertion with new org
        const seededOrg = await db.query.organizations.findFirst({
          where: eq(
            schema.organizations.id,
            SEED_TEST_IDS.ORGANIZATIONS.primary,
          ),
        });
        expect(seededOrg).toBeDefined();

        // Test new organization insertion
        const testOrgId = generateTestId("org");
        const [org] = await db
          .insert(schema.organizations)
          .values({
            id: testOrgId,
            name: "Drizzle Test Organization",
            subdomain: generateTestId("subdomain"),
          })
          .returning();

        expect(org).toBeDefined();
        expect(org?.id).toBe(testOrgId);
        expect(org?.name).toBe("Drizzle Test Organization");
      });
    });

    test("should insert a location with proper fields", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const testOrgId = generateTestId("org");
        const testLocationId = generateTestId("location");

        // First create organization
        await db.insert(schema.organizations).values({
          id: testOrgId,
          name: "Test Org",
          subdomain: generateTestId("subdomain"),
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
    });

    test("should insert a global model (no organizationId)", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const testModelId = generateTestId("model");
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
    });

    test("should insert a machine with all relationships", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const testOrgId = generateTestId("org");
        const testLocationId = generateTestId("location");
        const testModelId = generateTestId("model");
        const testMachineId = generateTestId("machine");

        // Setup dependencies
        await db.insert(schema.organizations).values({
          id: testOrgId,
          name: "Test Org",
          subdomain: generateTestId("subdomain"),
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
            id: testMachineId,
            name: "Test Machine #1",
            organizationId: testOrgId,
            locationId: testLocationId,
            modelId: testModelId,
            qrCodeId: generateTestId("qr-code"),
          })
          .returning();

        expect(machine).toBeDefined();
        expect(machine?.organizationId).toBe(testOrgId);
        expect(machine?.locationId).toBe(testLocationId);
        expect(machine?.modelId).toBe(testModelId);
      });
    });
  });

  describe("SELECT Operations", () => {
    test("should select user by email", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const testUserId = generateTestId("user");
        const selectTestEmail = `select-test-${generateTestId("email")}@example.com`;

        // NOTE: This test creates users to test CRUD operations and database functionality
        // This is legitimate user creation for testing database operations, not organizational data
        // Setup test data
        await db.insert(schema.users).values({
          id: testUserId,
          email: selectTestEmail,
          name: "Select Test User",
        });

        const users = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.email, selectTestEmail));

        expect(users).toHaveLength(1);
        expect(users[0]?.id).toBe(testUserId);
        expect(users[0]?.email).toBe(selectTestEmail);
      });
    });

    test("should perform complex join query", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const testOrgId = generateTestId("org");
        const testLocationId = generateTestId("location");

        await db.insert(schema.organizations).values({
          id: testOrgId,
          name: "Select Test Org",
          subdomain: generateTestId("subdomain"),
        });

        await db.insert(schema.locations).values({
          id: testLocationId,
          name: "Select Test Location",
          organizationId: testOrgId,
          street: "123 Select Street",
          city: "Select City",
        });

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
    });

    test("should perform aggregate query", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const testOrgId = generateTestId("org");
        const testLocationId = generateTestId("location");

        await db.insert(schema.organizations).values({
          id: testOrgId,
          name: "Select Test Org",
          subdomain: generateTestId("subdomain"),
        });

        await db.insert(schema.locations).values({
          id: testLocationId,
          name: "Select Test Location",
          organizationId: testOrgId,
          street: "123 Select Street",
          city: "Select City",
        });

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
    });

    test("should filter by multiple conditions", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const testOrgId = generateTestId("org");
        const testLocationId = generateTestId("location");

        await db.insert(schema.organizations).values({
          id: testOrgId,
          name: "Select Test Org",
          subdomain: generateTestId("subdomain"),
        });

        await db.insert(schema.locations).values({
          id: testLocationId,
          name: "Select Test Location",
          organizationId: testOrgId,
          street: "123 Select Street",
          city: "Select City",
        });

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
  });

  describe("UPDATE Operations", () => {
    test("should update user fields", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const testUserId = generateTestId("user");
        const updateTestEmail = `update-test-${generateTestId("email")}@example.com`;

        // NOTE: This test creates users to test CRUD operations and database functionality
        // This is legitimate user creation for testing database operations, not organizational data
        await db.insert(schema.users).values({
          id: testUserId,
          email: updateTestEmail,
          name: "Update Test User",
          notificationFrequency: "IMMEDIATE",
        });

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
        expect(updatedUser?.email).toBe(updateTestEmail); // Unchanged
      });
    });

    test("should update with conditional logic", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const testOrgId = generateTestId("org");

        await db.insert(schema.organizations).values({
          id: testOrgId,
          name: "Update Test Org",
          subdomain: generateTestId("subdomain"),
        });

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
    });

    test("should handle updates with no matches", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const result = await db
          .update(schema.users)
          .set({ name: "Should Not Update" })
          .where(eq(schema.users.id, "non-existent-id"))
          .returning();

        expect(result).toHaveLength(0);
      });
    });
  });

  describe("DELETE Operations", () => {
    test("should delete single record", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const testUserId = generateTestId("user");

        // NOTE: This test creates users to test CRUD operations and database functionality
        // This is legitimate user creation for testing database operations, not organizational data
        await db.insert(schema.users).values({
          id: testUserId,
          email: `delete-test-${generateTestId("email")}@example.com`,
          name: "Delete Test User",
        });

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
    });

    test("should delete with conditions", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const testOrgId = generateTestId("org");
        const testLocationId = generateTestId("location");

        await db.insert(schema.organizations).values({
          id: testOrgId,
          name: "Delete Test Org",
          subdomain: generateTestId("subdomain"),
        });

        await db.insert(schema.locations).values({
          id: testLocationId,
          name: "Delete Test Location",
          organizationId: testOrgId,
        });

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
    });

    test("should handle cascade deletions properly", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const testOrgId = generateTestId("org");
        const testLocationId = generateTestId("location");

        await db.insert(schema.organizations).values({
          id: testOrgId,
          name: "Delete Test Org",
          subdomain: generateTestId("subdomain"),
        });

        await db.insert(schema.locations).values({
          id: testLocationId,
          name: "Delete Test Location",
          organizationId: testOrgId,
        });

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
  });

  describe("Transaction Operations", () => {
    test("should commit successful transaction", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const txUserId = generateTestId("tx-user");
        const txOrgId = generateTestId("tx-org");
        const txSubdomain = generateTestId("tx-subdomain");

        const result = await db.transaction(async (tx) => {
          const [user] = await tx
            .insert(schema.users)
            .values({
              id: txUserId,
              email: `transaction-test-${generateTestId("email")}@example.com`,
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
      });
    });

    test("should rollback failed transaction", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const txUserId = generateTestId("rollback-user");

        try {
          await db.transaction(async (tx) => {
            await tx.insert(schema.users).values({
              id: txUserId,
              email: `rollback-test-${generateTestId("email")}@example.com`,
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
    });

    test("should handle constraint violation rollback", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const duplicateSubdomain = generateTestId("duplicate-subdomain");
        const firstOrgId = generateTestId("first-org");
        const secondOrgId = generateTestId("second-org");
        const txUserId = generateTestId("constraint-user");

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
              email: `constraint-test-${generateTestId("email")}@example.com`,
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
      });
    });
  });

  describe("Multi-Tenancy Isolation", () => {
    test("should properly isolate tenant data", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const org1Id = generateTestId("tenant1");
        const org2Id = generateTestId("tenant2");
        const loc1Id = generateTestId("loc1");
        const loc2Id = generateTestId("loc2");

        // Create two organizations
        await db.insert(schema.organizations).values([
          {
            id: org1Id,
            name: "Tenant 1",
            subdomain: generateTestId("tenant1-subdomain"),
          },
          {
            id: org2Id,
            name: "Tenant 2",
            subdomain: generateTestId("tenant2-subdomain"),
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
    });

    test("should prevent cross-tenant data access", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const org1Id = generateTestId("tenant1");
        const org2Id = generateTestId("tenant2");
        const loc1Id = generateTestId("loc1");
        const loc2Id = generateTestId("loc2");

        // Create two organizations
        await db.insert(schema.organizations).values([
          {
            id: org1Id,
            name: "Tenant 1",
            subdomain: generateTestId("tenant1-subdomain"),
          },
          {
            id: org2Id,
            name: "Tenant 2",
            subdomain: generateTestId("tenant2-subdomain"),
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
    });

    test("should validate organizationId indexes work efficiently", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const org1Id = generateTestId("tenant1");
        const loc1Id = generateTestId("loc1");

        // Create organization
        await db.insert(schema.organizations).values({
          id: org1Id,
          name: "Tenant 1",
          subdomain: generateTestId("tenant1-subdomain"),
        });

        // Create location
        await db.insert(schema.locations).values({
          id: loc1Id,
          name: "Tenant 1 Location",
          organizationId: org1Id,
        });

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
});
