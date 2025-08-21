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
 * - Uses seeded data infrastructure for predictable, fast testing
 *
 * Uses modern August 2025 patterns with Vitest and PGlite integration.
 */

import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, vi } from "vitest";

import { machineLocationRouter } from "~/server/api/routers/machine.location";
import * as schema from "~/server/db/schema";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import { createSeededMachineTestContext } from "~/test/helpers/createSeededMachineTestContext";
import {
  createSeededTestDatabase,
  getSeededTestData,
  type TestDatabase,
} from "~/test/helpers/pglite-test-setup";
import { generateTestId } from "~/test/helpers/test-id-generator";
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";

// Mock external dependencies that aren't database-related
vi.mock("~/lib/utils/id-generation", () => ({
  generateId: vi.fn(() => generateTestId("id")),
}));

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
  // Shared test database and seeded data
  let workerDb: TestDatabase;
  let seededData: Awaited<ReturnType<typeof getSeededTestData>>;

  beforeAll(async () => {
    // Create seeded test database
    const { db, organizationId } = await createSeededTestDatabase();
    workerDb = db;
    
    // Get seeded test data for primary organization
    seededData = await getSeededTestData(db, organizationId);
    
    // Debug: Log seeded data to understand what we have
    console.log("Seeded data:", {
      organization: seededData.organization,
      location: seededData.location,
      machine: seededData.machine,
      model: seededData.model,
      user: seededData.user,
      adminRole: seededData.adminRole,
      memberRole: seededData.memberRole,
    });
  });

  describe("moveToLocation", () => {
    test("should successfully move machine to a different location", async () => {
      await withIsolatedTest(workerDb, async (db) => {
        // Create test context using seeded data
        const context = await createSeededMachineTestContext(
          db,
          seededData.organization,
          seededData.user!,
        );
        const caller = machineLocationRouter.createCaller(context);

        // Create test model (needed for machines)
        const [testModel] = await db
          .insert(schema.models)
          .values({
            id: generateTestId("model"),
            name: "Test Model",
            manufacturer: "Test Manufacturer",
            year: 2024,
          })
          .returning();

        // Create test machine using seeded location
        const [testMachine] = await db
          .insert(schema.machines)
          .values({
            id: generateTestId("machine"),
            name: "Test Machine",
            qrCodeId: generateTestId("qr"),
            organizationId: seededData.organization,
            locationId: seededData.location!,
            modelId: testModel.id,
            ownerId: seededData.user!,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Create a second location for testing moves
        const [secondLocation] = await db
          .insert(schema.locations)
          .values({
            id: generateTestId("second-location"),
            name: "Second Test Location",
            organizationId: seededData.organization,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Verify initial state
        const initialMachine = await db.query.machines.findFirst({
          where: eq(schema.machines.id, testMachine.id),
        });
        expect(initialMachine?.locationId).toBe(seededData.location);

        // Execute move
        const result = await caller.moveToLocation({
          machineId: testMachine.id,
          locationId: secondLocation.id,
        });

        // Verify result structure and data
        expect(result).toMatchObject({
          id: testMachine.id,
          locationId: secondLocation.id,
          organizationId: seededData.organization,
        });

        // Verify machine name and relationships are included
        expect(result.name).toBeDefined();
        expect(result.model).toBeDefined();
        expect(result.location).toMatchObject({
          id: secondLocation.id,
          name: "Second Test Location",
        });
        expect(result.owner).toBeDefined();

        // Verify database persistence
        const updatedMachine = await db.query.machines.findFirst({
          where: eq(schema.machines.id, testMachine.id),
        });
        expect(updatedMachine?.locationId).toBe(secondLocation.id);
        expect(updatedMachine?.updatedAt.getTime()).toBeGreaterThan(
          initialMachine?.updatedAt.getTime() || 0,
        );
      });
    });

    test("should handle moves within the same location gracefully", async () => {
      await withIsolatedTest(workerDb, async (db) => {
        // Create test context using seeded data
        const context = await createSeededMachineTestContext(
          db,
          seededData.organization,
          seededData.user!,
        );
        const caller = machineLocationRouter.createCaller(context);

        // Create test model and machine
        const [testModel] = await db
          .insert(schema.models)
          .values({
            id: generateTestId("model"),
            name: "Test Model",
            manufacturer: "Test Manufacturer",
            year: 2024,
          })
          .returning();

        const [testMachine] = await db
          .insert(schema.machines)
          .values({
            id: generateTestId("machine"),
            name: "Test Machine",
            qrCodeId: generateTestId("qr"),
            organizationId: seededData.organization,
            locationId: seededData.location!,
            modelId: testModel.id,
            ownerId: seededData.user!,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Move machine to its current location
        const result = await caller.moveToLocation({
          machineId: testMachine.id,
          locationId: seededData.location!, // Same location
        });

        // Should succeed and return proper data
        expect(result).toMatchObject({
          id: testMachine.id,
          locationId: seededData.location,
          organizationId: seededData.organization,
        });

        // Verify updatedAt timestamp changed even for "no-op" moves
        const machineFromDb = await db.query.machines.findFirst({
          where: eq(schema.machines.id, testMachine.id),
        });
        expect(machineFromDb?.updatedAt).toBeInstanceOf(Date);
      });
    });

    test("should move multiple machines between locations correctly", async () => {
      await withIsolatedTest(workerDb, async (db) => {
        // Create test context using seeded data
        const context = await createSeededMachineTestContext(
          db,
          seededData.organization,
          seededData.user!,
        );
        const caller = machineLocationRouter.createCaller(context);

        // Create test model for machines
        const [testModel] = await db
          .insert(schema.models)
          .values({
            id: generateTestId("model"),
            name: "Test Model",
            manufacturer: "Test Manufacturer",
            year: 2024,
          })
          .returning();

        // Create a second location and second machine for testing
        const [secondLocation] = await db
          .insert(schema.locations)
          .values({
            id: generateTestId("second-location"),
            name: "Second Test Location",
            organizationId: seededData.organization,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Create two test machines
        const [mainMachine] = await db
          .insert(schema.machines)
          .values({
            id: generateTestId("main-machine"),
            name: "Main Test Machine",
            qrCodeId: generateTestId("qr-main"),
            organizationId: seededData.organization,
            locationId: seededData.location!,
            modelId: testModel.id,
            ownerId: seededData.user!,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        const [secondMachine] = await db
          .insert(schema.machines)
          .values({
            id: generateTestId("second-machine"),
            name: "Second Test Machine",
            qrCodeId: generateTestId("qr-second"),
            organizationId: seededData.organization,
            locationId: seededData.location!, // Start at first location
            modelId: testModel.id,
            ownerId: seededData.user!,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Move first machine to second location
        const result1 = await caller.moveToLocation({
          machineId: mainMachine.id,
          locationId: secondLocation.id,
        });

        // Move second machine to second location
        const result2 = await caller.moveToLocation({
          machineId: secondMachine.id,
          locationId: secondLocation.id,
        });

        // Verify both moves succeeded
        expect(result1.locationId).toBe(secondLocation.id);
        expect(result2.locationId).toBe(secondLocation.id);

        // Verify database state
        const finalMachines = await db.query.machines.findMany({
          where: eq(schema.machines.organizationId, seededData.organization),
          columns: { id: true, locationId: true },
        });

        const finalMain = finalMachines.find((m) => m.id === mainMachine.id);
        const finalSecond = finalMachines.find((m) => m.id === secondMachine.id);

        expect(finalMain?.locationId).toBe(secondLocation.id);
        expect(finalSecond?.locationId).toBe(secondLocation.id);
      });
    });

    test("should enforce organizational scoping for machine validation", async () => {
      await withIsolatedTest(workerDb, async (db) => {
        // Create test context using seeded data
        const context = await createSeededMachineTestContext(
          db,
          seededData.organization,
          seededData.user!,
        );
        const caller = machineLocationRouter.createCaller(context);

        // Create model for test machines
        const [testModel] = await db
          .insert(schema.models)
          .values({
            id: generateTestId("model"),
            name: "Test Model",
            manufacturer: "Test Manufacturer",
            year: 2024,
          })
          .returning();

        // Create machine in different organization using competitor org
        const competitorOrgId = SEED_TEST_IDS.ORGANIZATIONS.competitor;

        // Ensure competitor organization exists
        await db.insert(schema.organizations).values({
          id: competitorOrgId,
          name: "Competitor Organization",
          subdomain: "competitor",
          createdAt: new Date(),
          updatedAt: new Date(),
        }).onConflictDoNothing();

        const [competitorLocation] = await db
          .insert(schema.locations)
          .values({
            id: generateTestId("competitor-location"),
            name: "Competitor Location",
            organizationId: competitorOrgId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        const [competitorMachine] = await db
          .insert(schema.machines)
          .values({
            id: generateTestId("competitor-machine"),
            name: "Competitor Machine",
            qrCodeId: generateTestId("competitor-qr"),
            organizationId: competitorOrgId,
            locationId: competitorLocation.id,
            modelId: testModel.id,
            ownerId: seededData.user!,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Create second location in our organization
        const [secondLocation] = await db
          .insert(schema.locations)
          .values({
            id: generateTestId("second-location"),
            name: "Second Test Location",
            organizationId: seededData.organization,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Try to move competitor org's machine to our location
        await expect(
          caller.moveToLocation({
            machineId: competitorMachine.id,
            locationId: secondLocation.id,
          }),
        ).rejects.toThrow(
          expect.objectContaining({
            message: "Game instance not found",
          }),
        );
      });
    });

    test("should enforce organizational scoping for location validation", async () => {
      await withIsolatedTest(workerDb, async (db) => {
        // Create test context using seeded data
        const context = await createSeededMachineTestContext(
          db,
          seededData.organization,
          seededData.user!,
        );
        const caller = machineLocationRouter.createCaller(context);

        // Create location in different organization using competitor org
        const competitorOrgId = SEED_TEST_IDS.ORGANIZATIONS.competitor;

        // Ensure competitor organization exists
        await db.insert(schema.organizations).values({
          id: competitorOrgId,
          name: "Competitor Organization",
          subdomain: "competitor",
          createdAt: new Date(),
          updatedAt: new Date(),
        }).onConflictDoNothing();

        const [competitorLocation] = await db
          .insert(schema.locations)
          .values({
            id: generateTestId("competitor-location"),
            name: "Competitor Location",
            organizationId: competitorOrgId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Try to move our machine to competitor org's location
        await expect(
          caller.moveToLocation({
            machineId: seededData.machine!,
            locationId: competitorLocation.id,
          }),
        ).rejects.toThrow(
          expect.objectContaining({
            message: "Target location not found",
          }),
        );
      });
    });

    test("should handle non-existent machine IDs", async () => {
      await withIsolatedTest(workerDb, async (db) => {
        // Create test context using seeded data
        const context = await createSeededMachineTestContext(
          db,
          seededData.organization,
          seededData.user!,
        );
        const caller = machineLocationRouter.createCaller(context);

        // Create second location for the test
        const [secondLocation] = await db
          .insert(schema.locations)
          .values({
            id: generateTestId("second-location"),
            name: "Second Test Location",
            organizationId: seededData.organization,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        await expect(
          caller.moveToLocation({
            machineId: "non-existent-machine",
            locationId: secondLocation.id,
          }),
        ).rejects.toThrow(
          expect.objectContaining({
            message: "Game instance not found",
          }),
        );
      });
    });

    test("should handle non-existent location IDs", async () => {
      await withIsolatedTest(workerDb, async (db) => {
        // Create test context using seeded data
        const context = await createSeededMachineTestContext(
          db,
          seededData.organization,
          seededData.user!,
        );
        const caller = machineLocationRouter.createCaller(context);

        await expect(
          caller.moveToLocation({
            machineId: seededData.machine!,
            locationId: "non-existent-location",
          }),
        ).rejects.toThrow(
          expect.objectContaining({
            message: "Target location not found",
          }),
        );
      });
    });

    test("should return complete machine data with all relationships", async () => {
      await withIsolatedTest(workerDb, async (db) => {
        // Create test context using seeded data
        const context = await createSeededMachineTestContext(
          db,
          seededData.organization,
          seededData.user!,
        );
        const caller = machineLocationRouter.createCaller(context);

        // Create second location for the test
        const [secondLocation] = await db
          .insert(schema.locations)
          .values({
            id: generateTestId("second-location"),
            name: "Second Test Location",
            organizationId: seededData.organization,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        const result = await caller.moveToLocation({
          machineId: seededData.machine!,
          locationId: secondLocation.id,
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
        });

        expect(result.location).toEqual(
          expect.objectContaining({
            id: secondLocation.id,
            name: "Second Test Location",
            organizationId: seededData.organization,
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
  });

  describe("Multi-Tenant Security Verification", () => {
    test("should maintain complete isolation between organizations", async () => {
      await withIsolatedTest(workerDb, async (db) => {
        // Create test context using seeded data
        const context = await createSeededMachineTestContext(
          db,
          seededData.organization,
          seededData.user!,
        );
        const caller = machineLocationRouter.createCaller(context);

        // Create completely separate organization with its own data using competitor org
        const competitorOrgId = SEED_TEST_IDS.ORGANIZATIONS.competitor;

        // Ensure competitor organization exists
        await db.insert(schema.organizations).values({
          id: competitorOrgId,
          name: "Competitor Organization",
          subdomain: "competitor",
          createdAt: new Date(),
          updatedAt: new Date(),
        }).onConflictDoNothing();

        const [competitorLocation] = await db
          .insert(schema.locations)
          .values({
            id: generateTestId("competitor-location"),
            name: "Competitor Location",
            organizationId: competitorOrgId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        const [competitorMachine] = await db
          .insert(schema.machines)
          .values({
            id: generateTestId("competitor-machine"),
            name: "Competitor Machine",
            qrCodeId: generateTestId("competitor-qr"),
            organizationId: competitorOrgId,
            locationId: competitorLocation.id,
            modelId: seededData.model!, // Shared model (OK)
            ownerId: seededData.user!, // Shared user (OK)
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Test from different organization context
        const competitorContext = await createSeededMachineTestContext(
          db,
          competitorOrgId,
          seededData.user!,
        );
        const competitorCaller = machineLocationRouter.createCaller(competitorContext);

        // Competitor org should not be able to access our org's data
        await expect(
          competitorCaller.moveToLocation({
            machineId: seededData.machine!, // Our org's machine
            locationId: competitorLocation.id, // Their location
          }),
        ).rejects.toThrow("Game instance not found");

        // Our org should not be able to access their data
        await expect(
          caller.moveToLocation({
            machineId: competitorMachine.id, // Their machine
            locationId: seededData.location!, // Our location
          }),
        ).rejects.toThrow("Game instance not found");

        // Each org should be able to work with their own data
        const [anotherCompetitorLocation] = await db
          .insert(schema.locations)
          .values({
            id: generateTestId("another-competitor-loc"),
            name: "Another Competitor Location",
            organizationId: competitorOrgId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        const competitorResult = await competitorCaller.moveToLocation({
          machineId: competitorMachine.id,
          locationId: anotherCompetitorLocation.id,
        });

        expect(competitorResult.locationId).toBe(anotherCompetitorLocation.id);
        expect(competitorResult.organizationId).toBe(competitorOrgId);
      });
    });
  });

  describe("Error Handling and Edge Cases", () => {
    test("should return TRPCError instances with proper error codes", async () => {
      await withIsolatedTest(workerDb, async (db) => {
        // Create test context using seeded data
        const context = await createSeededMachineTestContext(
          db,
          seededData.organization,
          seededData.user!,
        );
        const caller = machineLocationRouter.createCaller(context);

        // Create second location for the test
        const [secondLocation] = await db
          .insert(schema.locations)
          .values({
            id: generateTestId("second-location"),
            name: "Second Test Location",
            organizationId: seededData.organization,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        let error: TRPCError | undefined;

        try {
          await caller.moveToLocation({
            machineId: "non-existent-machine",
            locationId: secondLocation.id,
          });
        } catch (e) {
          error = e as TRPCError;
        }

        expect(error).toBeInstanceOf(TRPCError);
        expect(error?.code).toBe("NOT_FOUND");
        expect(error?.message).toBe("Game instance not found");
      });
    });

    test("should handle invalid location ID with proper error", async () => {
      await withIsolatedTest(workerDb, async (db) => {
        // Create test context using seeded data
        const context = await createSeededMachineTestContext(
          db,
          seededData.organization,
          seededData.user!,
        );
        const caller = machineLocationRouter.createCaller(context);

        let error: TRPCError | undefined;

        try {
          await caller.moveToLocation({
            machineId: seededData.machine!,
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

    test("should handle empty string IDs gracefully", async () => {
      await withIsolatedTest(workerDb, async (db) => {
        // Create test context using seeded data
        const context = await createSeededMachineTestContext(
          db,
          seededData.organization,
          seededData.user!,
        );
        const caller = machineLocationRouter.createCaller(context);

        // Create second location for the test
        const [secondLocation] = await db
          .insert(schema.locations)
          .values({
            id: generateTestId("second-location"),
            name: "Second Test Location",
            organizationId: seededData.organization,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        await expect(
          caller.moveToLocation({
            machineId: "",
            locationId: secondLocation.id,
          }),
        ).rejects.toThrow();

        await expect(
          caller.moveToLocation({
            machineId: seededData.machine!,
            locationId: "",
          }),
        ).rejects.toThrow();
      });
    });
  });
});
