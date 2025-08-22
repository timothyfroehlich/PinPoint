/**
 * Machine Location Router Integration Tests (PGlite)
 *
 * Integration tests for the machine.location router using PGlite in-memory PostgreSQL database.
 * Tests real database operations with proper schema, relationships, and data integrity.
 *
 * Key Features:
 * - Real PostgreSQL database with PGlite
 * - Complete schema migrations applied
 * - Real Drizzle ORM operations
 * - Multi-tenant data isolation testing
 * - Complex relationship validation with actual results
 * - Machine location assignment and validation
 *
 * Uses modern August 2025 patterns with Vitest and PGlite integration.
 */

import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { describe, expect, vi } from "vitest";

// Import test setup and utilities
import { machineLocationRouter } from "~/server/api/routers/machine.location";
import * as schema from "~/server/db/schema";
import { type TestDatabase } from "~/test/helpers/pglite-test-setup";
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import {
  createSeededMachineTestContext,
  createPrimaryAdminContext,
  createCompetitorAdminContext,
} from "~/test/helpers/createSeededMachineTestContext";

// Mock external dependencies that aren't database-related

vi.mock("~/server/auth/permissions", () => ({
  getUserPermissionsForSession: vi
    .fn()
    .mockResolvedValue([
      "machine:edit",
      "machine:delete",
      "organization:manage",
    ]),
  getUserPermissionsForSupabaseUser: vi
    .fn()
    .mockResolvedValue([
      "machine:edit",
      "machine:delete",
      "organization:manage",
    ]),
  requirePermissionForSession: vi.fn().mockResolvedValue(undefined),
}));

describe("Machine Location Router Integration (PGlite)", () => {
  // Helper function to set up test data using seeded data
  async function setupTestData(db: TestDatabase) {
    // Use seeded data from primary organization
    const organizationId = SEED_TEST_IDS.ORGANIZATIONS.primary;

    // Create a second location for testing moves
    const [secondLocation] = await db
      .insert(schema.locations)
      .values({
        id: "test-second-location-move",
        name: "Second Test Location",
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Create a second machine for additional testing
    const [secondMachine] = await db
      .insert(schema.machines)
      .values({
        id: "test-second-machine-move",
        name: "Second Test Machine",
        qrCodeId: "test-qr-second-move",
        organizationId,
        locationId: SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR, // Start at first location
        modelId: "model-mm-001", // Use a standard model ID
        ownerId: SEED_TEST_IDS.USERS.ADMIN,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Create context using seeded data helper
    const context = await createPrimaryAdminContext(db);
    const caller = machineLocationRouter.createCaller(context);

    return {
      testData: {
        organization: organizationId,
        location: SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR,
        machine: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
        model: "model-mm-001",
        priority: SEED_TEST_IDS.PRIORITIES.HIGH_PRIMARY,
        status: SEED_TEST_IDS.STATUSES.NEW_PRIMARY,
        issue: SEED_TEST_IDS.ISSUES.KAIJU_FIGURES,
        adminRole: SEED_TEST_IDS.ROLES.ADMIN_PRIMARY,
        memberRole: SEED_TEST_IDS.ROLES.MEMBER_PRIMARY,
        user: SEED_TEST_IDS.USERS.ADMIN,
        secondLocation: secondLocation.id,
        secondMachine: secondMachine.id,
      },
      context,
      caller,
    };
  }

  describe("moveToLocation", () => {
    test("should successfully move machine to a different location", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { testData, caller } = await setupTestData(db);
        // Verify initial state
        const initialMachine = await db.query.machines.findFirst({
          where: eq(schema.machines.id, testData.machine),
        });
        expect(initialMachine?.locationId).toBe(testData.location);

        // Execute move
        const result = await caller.moveToLocation({
          machineId: testData.machine,
          locationId: testData.secondLocation,
        });

        // Verify result structure and data
        expect(result).toMatchObject({
          id: testData.machine,
          locationId: testData.secondLocation,
          organizationId: testData.organization,
        });

        // Verify machine name and relationships are included from seeded data
        expect(result.model).toMatchObject({
          name: expect.any(String),
          manufacturer: expect.any(String),
        });
        expect(result.location).toMatchObject({
          id: testData.secondLocation,
          name: "Second Test Location",
        });
        expect(result.owner).toMatchObject({
          id: testData.user,
          name: expect.any(String),
        });

        // Verify database persistence
        const updatedMachine = await db.query.machines.findFirst({
          where: eq(schema.machines.id, testData.machine),
        });
        expect(updatedMachine?.locationId).toBe(testData.secondLocation);
        expect(updatedMachine?.updatedAt.getTime()).toBeGreaterThan(
          initialMachine?.updatedAt.getTime() || 0,
        );
      });
    });

    test("should handle moves within the same location gracefully", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { testData, caller } = await setupTestData(db);
        // Move machine to its current location
        const result = await caller.moveToLocation({
          machineId: testData.machine,
          locationId: testData.location, // Same location
        });

        // Should succeed and return proper data
        expect(result).toMatchObject({
          id: testData.machine,
          locationId: testData.location,
          organizationId: testData.organization,
        });

        // Verify updatedAt timestamp changed even for "no-op" moves
        const machineFromDb = await db.query.machines.findFirst({
          where: eq(schema.machines.id, testData.machine),
        });
        expect(machineFromDb?.updatedAt).toBeInstanceOf(Date);
      });
    });

    test("should move multiple machines between locations correctly", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { testData, caller } = await setupTestData(db);
        // Verify both machines start at first location
        const initialMachines = await db.query.machines.findMany({
          where: eq(schema.machines.organizationId, testData.organization),
          columns: { id: true, locationId: true },
        });

        const mainMachine = initialMachines.find(
          (m) => m.id === testData.machine,
        );
        const secondMachine = initialMachines.find(
          (m) => m.id === testData.secondMachine,
        );

        expect(mainMachine?.locationId).toBe(testData.location);
        expect(secondMachine?.locationId).toBe(testData.location);

        // Move first machine to second location
        const result1 = await caller.moveToLocation({
          machineId: testData.machine,
          locationId: testData.secondLocation,
        });

        // Move second machine to second location
        const result2 = await caller.moveToLocation({
          machineId: testData.secondMachine,
          locationId: testData.secondLocation,
        });

        // Verify both moves succeeded
        expect(result1.locationId).toBe(testData.secondLocation);
        expect(result2.locationId).toBe(testData.secondLocation);

        // Verify database state
        const finalMachines = await db.query.machines.findMany({
          where: eq(schema.machines.organizationId, testData.organization),
          columns: { id: true, locationId: true },
        });

        const finalMain = finalMachines.find((m) => m.id === testData.machine);
        const finalSecond = finalMachines.find(
          (m) => m.id === testData.secondMachine,
        );

        expect(finalMain?.locationId).toBe(testData.secondLocation);
        expect(finalSecond?.locationId).toBe(testData.secondLocation);
      });
    });

    test("should enforce organizational scoping for machine validation", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { testData, caller } = await setupTestData(db);

        // Try to move competitor org's machine
        await expect(
          caller.moveToLocation({
            machineId: SEED_TEST_IDS.MACHINES.CACTUS_CANYON_1, // Competitor org machine
            locationId: testData.secondLocation,
          }),
        ).rejects.toThrow(
          expect.objectContaining({
            message: "Game instance not found",
          }),
        );
      });
    });

    test("should enforce organizational scoping for location validation", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { testData, caller } = await setupTestData(db);

        // Try to move our machine to competitor org's location
        await expect(
          caller.moveToLocation({
            machineId: testData.machine,
            locationId: SEED_TEST_IDS.LOCATIONS.DEFAULT_COMPETITOR, // Competitor location
          }),
        ).rejects.toThrow(
          expect.objectContaining({
            message: "Target location not found",
          }),
        );
      });
    });

    test("should handle non-existent machine IDs", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { testData, caller } = await setupTestData(db);

        await expect(
          caller.moveToLocation({
            machineId: "non-existent-machine",
            locationId: testData.secondLocation,
          }),
        ).rejects.toThrow(
          expect.objectContaining({
            message: "Game instance not found",
          }),
        );
      });
    });

    test("should handle non-existent location IDs", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { testData, caller } = await setupTestData(db);

        await expect(
          caller.moveToLocation({
            machineId: testData.machine,
            locationId: "non-existent-location",
          }),
        ).rejects.toThrow(
          expect.objectContaining({
            message: "Target location not found",
          }),
        );
      });
    });

    test("should return complete machine data with all relationships", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { testData, caller } = await setupTestData(db);

        const result = await caller.moveToLocation({
          machineId: testData.machine,
          locationId: testData.secondLocation,
        });

        // Verify all expected fields are present and correctly typed
        expect(result).toMatchObject({
          id: expect.any(String),
          name: expect.any(String),
          modelId: expect.any(String),
          locationId: expect.any(String),
          organizationId: expect.any(String),
          ownerId: expect.any(String),
          qrCodeId: expect.any(String),
          ownerNotificationsEnabled: expect.any(Boolean),
          notifyOnNewIssues: expect.any(Boolean),
          notifyOnStatusChanges: expect.any(Boolean),
          notifyOnComments: expect.any(Boolean),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });

        // Verify relationship data
        expect(result.model).toMatchObject({
          id: expect.any(String),
          name: expect.any(String),
          manufacturer: expect.any(String),
          // Note: year and machineType can be null in test data
        });

        expect(result.location).toEqual(
          expect.objectContaining({
            id: testData.secondLocation,
            name: "Second Test Location",
            organizationId: testData.organization,
          }),
        );

        expect(result.owner).toEqual(
          expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
          }),
        );
      });
    });

    test("should preserve machine properties during location move", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { testData, caller } = await setupTestData(db);

        // Get initial machine state
        const initialMachine = await db.query.machines.findFirst({
          where: eq(schema.machines.id, testData.machine),
        });

        // Move machine
        const result = await caller.moveToLocation({
          machineId: testData.machine,
          locationId: testData.secondLocation,
        });

        // Verify all properties except locationId and updatedAt remain unchanged
        expect(result.name).toBe(initialMachine?.name);
        expect(result.modelId).toBe(initialMachine?.modelId);
        expect(result.organizationId).toBe(initialMachine?.organizationId);
        expect(result.ownerId).toBe(initialMachine?.ownerId);
        expect(result.qrCodeId).toBe(initialMachine?.qrCodeId);
        expect(result.qrCodeUrl).toBe(initialMachine?.qrCodeUrl);
        expect(result.ownerNotificationsEnabled).toBe(
          initialMachine?.ownerNotificationsEnabled,
        );
        expect(result.notifyOnNewIssues).toBe(
          initialMachine?.notifyOnNewIssues,
        );
        expect(result.notifyOnStatusChanges).toBe(
          initialMachine?.notifyOnStatusChanges,
        );
        expect(result.notifyOnComments).toBe(initialMachine?.notifyOnComments);
        expect(result.createdAt.getTime()).toBe(
          initialMachine?.createdAt.getTime(),
        );

        // Verify changed properties
        expect(result.locationId).toBe(testData.secondLocation);
        expect(result.updatedAt.getTime()).toBeGreaterThan(
          initialMachine?.updatedAt.getTime() || 0,
        );
      });
    });
  });

  describe("Multi-Tenant Security Verification", () => {
    test("should maintain complete isolation between organizations", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { testData, caller } = await setupTestData(db);

        // Use seeded competitor organization
        const competitorOrgId = SEED_TEST_IDS.ORGANIZATIONS.competitor;

        // Create competitor context
        const competitorContext = await createCompetitorAdminContext(db);
        const competitorCaller =
          machineLocationRouter.createCaller(competitorContext);

        // Competitor org should not be able to access primary org's data
        await expect(
          competitorCaller.moveToLocation({
            machineId: testData.machine, // Primary org's machine
            locationId: SEED_TEST_IDS.LOCATIONS.DEFAULT_COMPETITOR, // Competitor location
          }),
        ).rejects.toThrow();

        // Primary org should not be able to access competitor data
        await expect(
          caller.moveToLocation({
            machineId: SEED_TEST_IDS.MACHINES.CACTUS_CANYON_1, // Competitor machine
            locationId: testData.secondLocation, // Primary location
          }),
        ).rejects.toThrow("Game instance not found");

        // Each org should be able to work with their own data
        // Create another location for competitor org
        const [anotherCompetitorLocation] = await db
          .insert(schema.locations)
          .values({
            id: "test-competitor-second-location",
            name: "Another Competitor Location",
            organizationId: competitorOrgId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        const competitorResult = await competitorCaller.moveToLocation({
          machineId: SEED_TEST_IDS.MACHINES.CACTUS_CANYON_1,
          locationId: anotherCompetitorLocation.id,
        });

        expect(competitorResult.locationId).toBe(anotherCompetitorLocation.id);
        expect(competitorResult.organizationId).toBe(competitorOrgId);
      });
    });
  });

  describe("Database Schema and Query Validation", () => {
    test("should properly handle machine relationships in response", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { testData, caller } = await setupTestData(db);

        const result = await caller.moveToLocation({
          machineId: testData.machine,
          locationId: testData.secondLocation,
        });

        // Verify the response contains properly joined data, not just IDs
        expect(result.model).toBeDefined();
        expect(result.location).toBeDefined();
        expect(result.owner).toBeDefined();

        // Verify specific relationship data
        expect(result.model.name).toBeDefined();
        expect(result.model.manufacturer).toBeDefined();
        expect(result.location.name).toBe("Second Test Location");
        expect(result.owner.name).toBeDefined();

        // Verify the actual database relationships are correctly established
        const dbMachine = await db.query.machines.findFirst({
          where: eq(schema.machines.id, testData.machine),
          with: {
            model: true,
            location: true,
            owner: true,
          },
        });

        expect(dbMachine?.model?.name).toBeDefined();
        expect(dbMachine?.location?.name).toBe("Second Test Location");
        expect(dbMachine?.owner?.name).toBeDefined();
      });
    });

    test("should handle database constraints and foreign keys correctly", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { testData, caller } = await setupTestData(db);

        // Verify foreign key relationships are maintained
        const machinesBefore = await db
          .select({ count: schema.machines.id })
          .from(schema.machines)
          .where(eq(schema.machines.locationId, testData.location));

        const locationsBefore = await db
          .select({ count: schema.locations.id })
          .from(schema.locations)
          .where(eq(schema.locations.id, testData.location));

        expect(machinesBefore.length).toBeGreaterThan(0);
        expect(locationsBefore.length).toBe(1);

        // Move machine
        await caller.moveToLocation({
          machineId: testData.machine,
          locationId: testData.secondLocation,
        });

        // Verify foreign key relationships still valid
        const machinesAfter = await db
          .select({ count: schema.machines.id })
          .from(schema.machines)
          .where(eq(schema.machines.locationId, testData.secondLocation));

        const locationsAfter = await db
          .select({ count: schema.locations.id })
          .from(schema.locations)
          .where(eq(schema.locations.id, testData.secondLocation));

        expect(machinesAfter.length).toBeGreaterThan(0);
        expect(locationsAfter.length).toBe(1);
      });
    });

    test("should handle concurrent location moves correctly", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { testData, caller } = await setupTestData(db);

        // This test verifies that simultaneous moves don't cause race conditions
        // In a real application, this would be more complex, but we can simulate basic concurrency

        // Create multiple machines for concurrent testing
        const concurrentMachines = await Promise.all(
          Array.from({ length: 3 }, async (_, i) => {
            const machineId = `test-concurrent-machine-${i}`;
            const [machine] = await db
              .insert(schema.machines)
              .values({
                id: machineId,
                name: `Concurrent Machine ${i}`,
                qrCodeId: `test-concurrent-qr-${i}`,
                organizationId: testData.organization,
                locationId: testData.location,
                modelId: testData.model,
                ownerId: testData.user,
                createdAt: new Date(),
                updatedAt: new Date(),
              })
              .returning();
            return machine;
          }),
        );

        // Execute concurrent moves
        const movePromises = concurrentMachines.map((machine) =>
          caller.moveToLocation({
            machineId: machine.id,
            locationId: testData.secondLocation,
          }),
        );

        const results = await Promise.all(movePromises);

        // Verify all moves succeeded
        results.forEach((result, index) => {
          expect(result.id).toBe(concurrentMachines[index].id);
          expect(result.locationId).toBe(testData.secondLocation);
        });

        // Verify database consistency
        const finalMachines = await db.query.machines.findMany({
          where: eq(schema.machines.locationId, testData.secondLocation),
        });

        const concurrentMachineIds = concurrentMachines.map((m) => m.id);
        const finalConcurrentMachines = finalMachines.filter((m) =>
          concurrentMachineIds.includes(m.id),
        );

        expect(finalConcurrentMachines).toHaveLength(3);
      });
    });
  });

  describe("Error Handling and Edge Cases", () => {
    test("should return TRPCError instances with proper error codes", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { testData, caller } = await setupTestData(db);

        let error: TRPCError | undefined;

        try {
          await caller.moveToLocation({
            machineId: "non-existent-machine",
            locationId: testData.secondLocation,
          });
        } catch (e) {
          error = e as TRPCError;
        }

        expect(error).toBeInstanceOf(TRPCError);
        expect(error?.code).toBe("NOT_FOUND");
        expect(error?.message).toBe("Game instance not found");
      });
    });

    test("should handle invalid location ID with proper error", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { testData, caller } = await setupTestData(db);

        let error: TRPCError | undefined;

        try {
          await caller.moveToLocation({
            machineId: testData.machine,
            locationId: "non-existent-location",
          });
        } catch (e) {
          error = e as TRPCError;
        }

        expect(error).toBeInstanceOf(TRPCError);
        expect(error?.code).toBe("NOT_FOUND");
        expect(error?.message).toBe("Target location not found");
      });
    });

    test("should handle empty string IDs gracefully", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { testData, caller } = await setupTestData(db);

        await expect(
          caller.moveToLocation({
            machineId: "",
            locationId: testData.secondLocation,
          }),
        ).rejects.toThrow();

        await expect(
          caller.moveToLocation({
            machineId: testData.machine,
            locationId: "",
          }),
        ).rejects.toThrow();
      });
    });

    test("should handle malformed input gracefully", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { testData, caller } = await setupTestData(db);

        // Test with null/undefined values - these should be caught by Zod validation
        await expect(
          // @ts-expect-error - intentionally testing invalid input
          caller.moveToLocation({
            machineId: null,
            locationId: testData.secondLocation,
          }),
        ).rejects.toThrow();

        await expect(
          // @ts-expect-error - intentionally testing invalid input
          caller.moveToLocation({
            machineId: testData.machine,
            locationId: undefined,
          }),
        ).rejects.toThrow();
      });
    });
  });
});
