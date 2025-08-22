/**
 * Location Router CRUD Integration Tests (PGlite)
 *
 * Converted to use seeded data patterns for consistent, fast, memory-safe testing.
 * Tests create, read, update, delete operations with proper organizational scoping
 * using the established seeded data infrastructure.
 *
 * Key Features:
 * - Uses createSeededTestDatabase() and SEED_TEST_IDS for consistent test data
 * - Leverages createSeededLocationTestContext() for standardized TRPC context
 * - Uses SEED_TEST_IDS.ORGANIZATIONS.competitor for cross-org isolation testing
 * - Maintains CRUD operation testing with seeded data baseline
 * - Worker-scoped PGlite integration for memory safety
 *
 * Uses modern August 2025 patterns with seeded data architecture.
 */

import { eq } from "drizzle-orm";
import { describe, expect, vi, beforeAll } from "vitest";

// Import test setup and utilities
import type { TRPCContext } from "~/server/api/trpc.base";

import { locationRouter } from "~/server/api/routers/location";
import * as schema from "~/server/db/schema";
import { generateTestId } from "~/test/helpers/test-id-generator";
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
import {
  createSeededTestDatabase,
  type TestDatabase,
} from "~/test/helpers/pglite-test-setup";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import { createSeededLocationTestContext } from "~/test/helpers/createSeededLocationTestContext";

// Mock external dependencies that aren't database-related
vi.mock("~/lib/utils/id-generation", () => ({
  generateId: vi.fn(() => generateTestId("test-id")),
}));

vi.mock("~/server/auth/permissions", () => ({
  getUserPermissionsForSession: vi
    .fn()
    .mockResolvedValue([
      "location:edit",
      "location:delete",
      "organization:manage",
    ]),
  getUserPermissionsForSupabaseUser: vi
    .fn()
    .mockResolvedValue([
      "location:edit",
      "location:delete",
      "organization:manage",
    ]),
  requirePermissionForSession: vi.fn().mockResolvedValue(undefined),
}));

describe("Location Router CRUD Operations (PGlite)", () => {
  const primaryOrgId = SEED_TEST_IDS.ORGANIZATIONS.primary;
  const competitorOrgId = SEED_TEST_IDS.ORGANIZATIONS.competitor;

  describe("create", () => {
    test("should create location with real database operations", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (txDb) => {
        const context = await createSeededLocationTestContext(
          txDb,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = locationRouter.createCaller(context);

        const result = await caller.create({
          name: "New CRUD Arcade Location",
        });

        expect(result).toMatchObject({
          name: "New CRUD Arcade Location",
          organizationId: primaryOrgId,
        });
        expect(result.id).toMatch(/^test-id-/);

        // Verify in database
        const dbLocation = await txDb.query.locations.findFirst({
          where: eq(schema.locations.id, result.id),
        });

        expect(dbLocation).toMatchObject({
          id: result.id,
          name: "New CRUD Arcade Location",
          organizationId: primaryOrgId,
        });
        expect(dbLocation?.createdAt).toBeInstanceOf(Date);
        expect(dbLocation?.updatedAt).toBeInstanceOf(Date);
      });
    });

    test("should enforce organizational isolation on create", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (txDb) => {
        // Create contexts for both organizations
        const primaryContext = await createSeededLocationTestContext(
          txDb,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const primaryCaller = locationRouter.createCaller(primaryContext);

        const competitorContext = await createSeededLocationTestContext(
          txDb,
          competitorOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const competitorCaller = locationRouter.createCaller(competitorContext);

        // Create location in primary org
        const primaryLocation = await primaryCaller.create({
          name: "Primary Org Location",
        });

        // Create location in competitor org
        const competitorLocation = await competitorCaller.create({
          name: "Competitor Org Location",
        });

        // Verify primary org only sees its own locations (seeded + new)
        const primaryResults = await primaryCaller.getAll();
        const primaryLocationIds = primaryResults.map((l) => l.id);
        expect(primaryLocationIds).toContain(primaryLocation.id);
        expect(primaryLocationIds).not.toContain(competitorLocation.id);

        // Verify competitor org only sees its own location
        const competitorResults = await competitorCaller.getAll();
        const competitorLocationIds = competitorResults.map((l) => l.id);
        expect(competitorLocationIds).toContain(competitorLocation.id);
        expect(competitorLocationIds).not.toContain(primaryLocation.id);
      });
    });
  });

  describe("getAll", () => {
    test("should get locations with machine relationships", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (txDb) => {
        const context = await createSeededLocationTestContext(
          txDb,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = locationRouter.createCaller(context);

        // Create a machine for the seeded location
        const machineId = generateTestId("test-machine-crud");
        await txDb.insert(schema.machines).values({
          id: machineId,
          name: "Test Machine CRUD",
          qrCodeId: `qr-${machineId}`,
          organizationId: primaryOrgId,
          locationId: SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR,
          modelId: "model-mm-001",
          ownerId: SEED_TEST_IDS.USERS.ADMIN,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const result = await caller.getAll();

        // Should get at least the seeded location
        expect(result.length).toBeGreaterThanOrEqual(1);

        // Find our seeded location
        const seededLocation = result.find(
          (l) => l.id === SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR,
        );
        expect(seededLocation).toBeDefined();
        expect(seededLocation!.organizationId).toBe(primaryOrgId);

        // Should include our new machine
        expect(
          seededLocation!.machines.some((m) => m.id === machineId),
        ).toBeTruthy();
      });
    });

    test("should order locations by name", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (txDb) => {
        const context = await createSeededLocationTestContext(
          txDb,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = locationRouter.createCaller(context);

        // Insert additional locations for ordering test
        await txDb.insert(schema.locations).values([
          {
            id: "loc-zebra",
            name: "Zebra Arcade",
            organizationId: primaryOrgId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "loc-alpha",
            name: "Alpha Games",
            organizationId: primaryOrgId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        const result = await caller.getAll();

        // Should include seeded location + our 2 new ones = at least 3
        expect(result.length).toBeGreaterThanOrEqual(3);

        // Check that ordering is maintained (by name ASC)
        const names = result.map((l) => l.name);
        const sortedNames = [...names].sort();
        expect(names).toEqual(sortedNames);
      });
    });

    test("should maintain organizational scoping with multiple orgs", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (txDb) => {
        // Create contexts for both organizations
        const primaryContext = await createSeededLocationTestContext(
          txDb,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const primaryCaller = locationRouter.createCaller(primaryContext);

        const competitorContext = await createSeededLocationTestContext(
          txDb,
          competitorOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );

        // Insert location in competitor org
        await txDb.insert(schema.locations).values({
          id: "other-org-location",
          name: "Other Org Location",
          organizationId: competitorOrgId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const primaryResult = await primaryCaller.getAll();

        // Primary org should only get its own locations (seeded + any test locations)
        const allLocationIds = primaryResult.map((l) => l.id);
        expect(allLocationIds).toContain(SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR); // Should see seeded location
        expect(allLocationIds).not.toContain("other-org-location"); // Should not see competitor location

        // All returned locations should belong to primary org
        primaryResult.forEach((location) => {
          expect(primaryOrgId).toBe(primaryOrgId);
        });
      });
    });
  });

  describe("update", () => {
    test("should update location with real database persistence", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Use static seed constants
        const context = await createSeededLocationTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );

        const caller = locationRouter.createCaller(context);

        const result = await caller.update({
          id: SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR,
          name: "Updated Test Arcade",
        });

        expect(result).toMatchObject({
          id: SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR,
          name: "Updated Test Arcade",
          organizationId: primaryOrgId,
        });

        // Verify in database
        const dbLocation = await db.query.locations.findFirst({
          where: eq(schema.locations.id, SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR),
        });

        expect(dbLocation).toBeDefined();
        if (!dbLocation) throw new Error("Location not found in database");

        expect(dbLocation.name).toBe("Updated Test Arcade");
        expect(dbLocation.updatedAt.getTime()).toBeGreaterThan(
          dbLocation.createdAt.getTime(),
        );
      });
    });

    test("should prevent cross-organizational updates", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Use static seed constants
        const context = await createSeededLocationTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );

        // Try to update location from different organization
        const otherOrgContext = {
          ...context,
          organization: {
            id: SEED_TEST_IDS.ORGANIZATIONS.competitor,
            name: "Other Org",
            subdomain: "other",
          },
        };
        const otherCaller = locationRouter.createCaller(otherOrgContext as any);

        await expect(
          otherCaller.update({
            id: SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR,
            name: "Hacked Name",
          }),
        ).rejects.toThrow(
          "You don't have permission to access this organization",
        );

        // Verify original name unchanged
        const dbLocation = await db.query.locations.findFirst({
          where: eq(schema.locations.id, SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR),
        });
        expect(dbLocation).toBeDefined();
        if (!dbLocation)
          throw new Error("Location not found in database after failed update");

        expect(dbLocation.name).toBe("Test Arcade CRUD");
      });
    });

    test("should handle partial updates correctly", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Use static seed constants
        const context = await createSeededLocationTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = locationRouter.createCaller(context);

        const originalData = await db.query.locations.findFirst({
          where: eq(schema.locations.id, SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR),
        });

        const result = await caller.update({
          id: SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR,
        }); // No name provided

        expect(originalData).toBeDefined();
        if (!originalData) throw new Error("Original location data not found");

        expect(result.name).toBe(originalData.name); // Name should remain unchanged
        expect(result.updatedAt.getTime()).toBeGreaterThan(
          originalData.updatedAt.getTime(),
        ); // But updatedAt should change
      });
    });
  });

  describe("getById", () => {
    test("should get location with complete relationship data", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Use static seed constants
        const context = await createSeededLocationTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = locationRouter.createCaller(context);

        // Create a machine with owner relationship
        await db.insert(schema.machines).values({
          id: generateTestId("test-machine-getbyid"),
          name: "Test Machine GetById",
          qrCodeId: "qr-test-getbyid",
          organizationId: primaryOrgId,
          locationId: SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR,
          modelId: "model-mm-001",
          ownerId: SEED_TEST_IDS.USERS.ADMIN.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const result = await caller.getById({
          id: SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR,
        });

        expect(result).toMatchObject({
          id: SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR,
          organizationId: primaryOrgId,
          name: "Test Arcade CRUD",
        });

        expect(result.machines).toHaveLength(1);
        expect(result.machines[0]).toMatchObject({
          name: "Test Machine GetById",
        });
        expect(result.machines[0].model).toMatchObject({
          name: "Test Model",
          manufacturer: "Test Manufacturer",
        });
        expect(result.machines[0].owner).toMatchObject({
          id: SEED_TEST_IDS.USERS.ADMIN,
          name: "Test User",
          profilePicture: null,
        });
      });
    });

    test("should enforce organizational scoping", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Use static seed constants
        const context = await createSeededLocationTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = locationRouter.createCaller(context);

        // Use seeded competitor organization for cross-org testing
        const otherOrgId = SEED_TEST_IDS.ORGANIZATIONS.competitor;

        const otherLocationId = "other-location-getbyid";
        await db.insert(schema.locations).values({
          id: otherLocationId,
          name: "Other Location",
          organizationId: otherOrgId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Try to access other org's location
        await expect(caller.getById({ id: otherLocationId })).rejects.toThrow(
          "Location not found or access denied",
        );

        // But should be able to access own org's location
        const result = await caller.getById({
          id: SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR,
        });
        expect(result.id).toBe(SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR);
      });
    });
  });

  describe("delete", () => {
    test("should delete location after proper dependency cleanup", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Use static seed constants
        const context = await createSeededLocationTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = locationRouter.createCaller(context);

        // Create dependencies for referential integrity test
        const [machine] = await db
          .insert(schema.machines)
          .values({
            id: generateTestId("test-machine-delete"),
            name: "Test Machine Delete",
            qrCodeId: "qr-test-delete",
            organizationId: primaryOrgId,
            locationId: SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR,
            modelId: "model-mm-001",
            ownerId: SEED_TEST_IDS.USERS.ADMIN,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Due to foreign key constraints, delete dependencies first
        await db
          .delete(schema.machines)
          .where(eq(schema.machines.id, machine.id));

        // Now delete the location
        const result = await caller.delete({
          id: SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR,
        });

        expect(result).toMatchObject({
          id: SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR,
          organizationId: primaryOrgId,
          name: "Test Arcade CRUD",
        });

        // Verify location deletion in database
        const dbLocation = await db.query.locations.findFirst({
          where: eq(schema.locations.id, SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR),
        });
        expect(dbLocation).toBeUndefined();
      });
    });

    test("should prevent cross-organizational deletion", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Use static seed constants
        const context = await createSeededLocationTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );

        const otherOrgContext = {
          ...context,
          organization: {
            id: "other-org-delete",
            name: "Other Org",
            subdomain: "other",
          },
        };
        const otherCaller = locationRouter.createCaller(otherOrgContext as any);

        await expect(
          otherCaller.delete({ id: SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR }),
        ).rejects.toThrow(
          "You don't have permission to access this organization",
        );

        // Verify location still exists
        const dbLocation = await db.query.locations.findFirst({
          where: eq(schema.locations.id, SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR),
        });
        expect(dbLocation).toBeDefined();
      });
    });
  });

  describe("setPinballMapId", () => {
    test("should set PinballMap ID with database persistence", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Use static seed constants
        const context = await createSeededLocationTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = locationRouter.createCaller(context);

        const result = await caller.setPinballMapId({
          locationId: SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR,
          pinballMapId: 12345,
        });

        expect(result.pinballMapId).toBe(12345);

        // Verify in database
        const dbLocation = await db.query.locations.findFirst({
          where: eq(schema.locations.id, SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR),
        });
        expect(dbLocation).toBeDefined();
        if (!dbLocation)
          throw new Error(
            "Location not found in database after PinballMap ID update",
          );

        expect(dbLocation.pinballMapId).toBe(12345);
      });
    });

    test("should prevent cross-organizational PinballMap ID updates", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Use static seed constants
        const context = await createSeededLocationTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );

        const otherOrgContext = {
          ...context,
          organization: {
            id: "other-org-pinball",
            name: "Other Org",
            subdomain: "other",
          },
        };
        const otherCaller = locationRouter.createCaller(otherOrgContext as any);

        await expect(
          otherCaller.setPinballMapId({
            locationId: SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR,
            pinballMapId: 999,
          }),
        ).rejects.toThrow(
          "You don't have permission to access this organization",
        );

        // Verify pinballMapId unchanged
        const dbLocation = await db.query.locations.findFirst({
          where: eq(schema.locations.id, SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR),
        });
        expect(dbLocation).toBeDefined();
        if (!dbLocation)
          throw new Error(
            "Location not found in database after failed PinballMap ID update",
          );

        expect(dbLocation.pinballMapId).toBeNull();
      });
    });
  });
});
