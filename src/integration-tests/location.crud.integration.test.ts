/**
 * Location Router CRUD Integration Tests (PGlite)
 *
 * Integration tests for basic CRUD operations on the location router.
 * Tests create, read, update, delete operations with proper organizational scoping.
 *
 * Key Features:
 * - Real PostgreSQL database with PGlite
 * - Complete schema migrations applied
 * - Real Drizzle ORM operations
 * - Multi-tenant data isolation testing
 * - Basic location management operations
 *
 * Uses modern August 2025 patterns with worker-scoped PGlite integration.
 */

import { eq } from "drizzle-orm";
import { describe, expect, vi } from "vitest";

// Import test setup and utilities
import type { TRPCContext } from "~/server/api/trpc.base";

import { locationRouter } from "~/server/api/routers/location";
import * as schema from "~/server/db/schema";
import { generateTestId } from "~/test/helpers/test-id-generator";
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";

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
  async function createTestContext(db: any) {
    // Create test organization
    const [organization] = await db
      .insert(schema.organizations)
      .values({
        id: generateTestId("test-org-crud"),
        name: "Test Organization CRUD",
        subdomain: generateTestId("test-org-crud"),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Create test user
    const [user] = await db
      .insert(schema.users)
      .values({
        id: generateTestId("test-user-crud"),
        name: "Test User",
        email: "test@example.com",
        profilePicture: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Create test roles and permissions
    const [adminRole] = await db
      .insert(schema.roles)
      .values({
        id: "admin-role-crud",
        name: "Admin",
        organizationId: organization.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Create membership for the test user
    await db.insert(schema.memberships).values({
      id: generateTestId("test-membership-crud"),
      userId: user.id,
      organizationId: organization.id,
      roleId: adminRole.id,
    });

    // Create machine model for relationships
    const [model] = await db
      .insert(schema.models)
      .values({
        id: generateTestId("test-model-crud"),
        name: "Test Model",
        manufacturer: "Test Manufacturer",
      })
      .returning();

    // Create test location
    const [location] = await db
      .insert(schema.locations)
      .values({
        id: generateTestId("test-location-crud"),
        name: "Test Arcade CRUD",
        organizationId: organization.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Create test context with real database
    const context: TRPCContext = {
      user: {
        id: user.id,
        email: user.email,
        user_metadata: { name: user.name },
        app_metadata: { organization_id: organization.id, role: "Admin" },
      },
      organization: {
        id: organization.id,
        name: organization.name,
        subdomain: organization.subdomain,
      },
      db: db,
      supabase: {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      } as any,
      services: {
        createPinballMapService: vi.fn(() => ({
          syncLocation: vi.fn().mockResolvedValue({
            success: true,
            data: { synced: true, machinesUpdated: 2 },
          }),
        })),
        createNotificationService: vi.fn(),
        createCollectionService: vi.fn(),
        createIssueActivityService: vi.fn(),
        createCommentCleanupService: vi.fn(),
        createQRCodeService: vi.fn(),
      },
      headers: new Headers(),
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        trace: vi.fn(),
        child: vi.fn(() => context.logger),
        withRequest: vi.fn(() => context.logger),
        withUser: vi.fn(() => context.logger),
        withOrganization: vi.fn(() => context.logger),
        withContext: vi.fn(() => context.logger),
      },
      userPermissions: [
        "location:edit",
        "location:delete",
        "organization:manage",
      ],
    } as any;

    const caller = locationRouter.createCaller(context);

    return {
      organization,
      user,
      location,
      model,
      adminRole,
      context,
      caller,
    };
  }

  describe("create", () => {
    test("should create location with real database operations", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { caller, organization } = await createTestContext(db);

        const result = await caller.create({ name: "New Arcade Location" });

        expect(result).toMatchObject({
          name: "New Arcade Location",
          organizationId: organization.id,
        });
        expect(result.id).toMatch(/^test-id-/);

        // Verify in database
        const dbLocation = await db.query.locations.findFirst({
          where: eq(schema.locations.id, result.id),
        });

        expect(dbLocation).toMatchObject({
          id: result.id,
          name: "New Arcade Location",
          organizationId: organization.id,
        });
        expect(dbLocation?.createdAt).toBeInstanceOf(Date);
        expect(dbLocation?.updatedAt).toBeInstanceOf(Date);
      });
    });

    test("should enforce organizational isolation on create", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { caller, context } = await createTestContext(db);

        // Create location in test org
        const _result = await caller.create({ name: "Org1 Location" });

        // Try to query from different organization context
        const otherOrgContext = {
          ...context,
          organization: {
            id: "other-org",
            name: "Other Org",
            subdomain: "other",
          },
        };
        const otherCaller = locationRouter.createCaller(otherOrgContext as any);

        // Should fail due to lack of membership in other org
        await expect(otherCaller.getAll()).rejects.toThrow(
          "You don't have permission to access this organization",
        );
      });
    });
  });

  describe("getAll", () => {
    test("should get locations with machine relationships", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { caller, location, organization, model, user } =
          await createTestContext(db);

        // Create a machine for the location
        const machineId = generateTestId("test-machine-crud");
        await db.insert(schema.machines).values({
          id: machineId,
          name: "Test Machine",
          qrCodeId: "qr-test-crud",
          organizationId: organization.id,
          locationId: location.id,
          modelId: model.id,
          ownerId: user.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const result = await caller.getAll();

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          id: location.id,
          organizationId: organization.id,
          machines: expect.arrayContaining([
            expect.objectContaining({
              id: machineId,
              locationId: location.id,
            }),
          ]),
        });

        // Verify relationships are properly loaded
        expect(result[0].machines).toHaveLength(1);
        expect(result[0].machines[0].id).toBe(machineId);
      });
    });

    test("should order locations by name", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { caller, organization } = await createTestContext(db);

        // Insert additional locations
        await db.insert(schema.locations).values([
          {
            id: "loc-zebra",
            name: "Zebra Arcade",
            organizationId: organization.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "loc-alpha",
            name: "Alpha Games",
            organizationId: organization.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        const result = await caller.getAll();

        expect(result).toHaveLength(3);
        // Check that locations are ordered by name (first is Alpha, last is Zebra)
        expect(result[0].name).toBe("Alpha Games");
        expect(result[result.length - 1].name).toBe("Zebra Arcade");
      });
    });

    test("should maintain organizational scoping with multiple orgs", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { caller, organization } = await createTestContext(db);

        // Insert another organization and location
        const otherOrgId = "other-org-id";
        await db.insert(schema.organizations).values({
          id: otherOrgId,
          name: "Other Organization",
          subdomain: "other-org",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await db.insert(schema.locations).values({
          id: "other-org-location",
          name: "Other Org Location",
          organizationId: otherOrgId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const result = await caller.getAll();

        // Should only get locations from our org
        expect(result).toHaveLength(1);
        expect(result[0].organizationId).toBe(organization.id);
        expect(
          result.find((l) => l.organizationId === otherOrgId),
        ).toBeUndefined();
      });
    });
  });

  describe("update", () => {
    test("should update location with real database persistence", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { caller, location } = await createTestContext(db);

        const result = await caller.update({
          id: location.id,
          name: "Updated Test Arcade",
        });

        expect(result).toMatchObject({
          id: location.id,
          name: "Updated Test Arcade",
          organizationId: location.organizationId,
        });

        // Verify in database
        const dbLocation = await db.query.locations.findFirst({
          where: eq(schema.locations.id, location.id),
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
        const { location, context } = await createTestContext(db);

        // Try to update location from different organization
        const otherOrgContext = {
          ...context,
          organization: {
            id: "other-org",
            name: "Other Org",
            subdomain: "other",
          },
        };
        const otherCaller = locationRouter.createCaller(otherOrgContext as any);

        await expect(
          otherCaller.update({ id: location.id, name: "Hacked Name" }),
        ).rejects.toThrow(
          "You don't have permission to access this organization",
        );

        // Verify original name unchanged
        const dbLocation = await db.query.locations.findFirst({
          where: eq(schema.locations.id, location.id),
        });
        expect(dbLocation).toBeDefined();
        if (!dbLocation)
          throw new Error("Location not found in database after failed update");

        expect(dbLocation.name).toBe("Test Arcade CRUD");
      });
    });

    test("should handle partial updates correctly", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { caller, location } = await createTestContext(db);

        const originalData = await db.query.locations.findFirst({
          where: eq(schema.locations.id, location.id),
        });

        const result = await caller.update({ id: location.id }); // No name provided

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
        const { caller, location, organization, model, user } =
          await createTestContext(db);

        // Create a machine with owner relationship
        await db.insert(schema.machines).values({
          id: generateTestId("test-machine-getbyid"),
          name: "Test Machine GetById",
          qrCodeId: "qr-test-getbyid",
          organizationId: organization.id,
          locationId: location.id,
          modelId: model.id,
          ownerId: user.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const result = await caller.getById({ id: location.id });

        expect(result).toMatchObject({
          id: location.id,
          organizationId: organization.id,
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
          id: user.id,
          name: "Test User",
          profilePicture: null,
        });
      });
    });

    test("should enforce organizational scoping", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { caller, location } = await createTestContext(db);

        // Create location in another org
        const otherOrgId = "other-org-getbyid";
        await db.insert(schema.organizations).values({
          id: otherOrgId,
          name: "Other Organization",
          subdomain: "other-org",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

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
        const result = await caller.getById({ id: location.id });
        expect(result.id).toBe(location.id);
      });
    });
  });

  describe("delete", () => {
    test("should delete location after proper dependency cleanup", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { caller, location, organization, model, user } =
          await createTestContext(db);

        // Create dependencies for referential integrity test
        const [machine] = await db
          .insert(schema.machines)
          .values({
            id: generateTestId("test-machine-delete"),
            name: "Test Machine Delete",
            qrCodeId: "qr-test-delete",
            organizationId: organization.id,
            locationId: location.id,
            modelId: model.id,
            ownerId: user.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Due to foreign key constraints, delete dependencies first
        await db
          .delete(schema.machines)
          .where(eq(schema.machines.id, machine.id));

        // Now delete the location
        const result = await caller.delete({ id: location.id });

        expect(result).toMatchObject({
          id: location.id,
          organizationId: organization.id,
          name: "Test Arcade CRUD",
        });

        // Verify location deletion in database
        const dbLocation = await db.query.locations.findFirst({
          where: eq(schema.locations.id, location.id),
        });
        expect(dbLocation).toBeUndefined();
      });
    });

    test("should prevent cross-organizational deletion", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { location, context } = await createTestContext(db);

        const otherOrgContext = {
          ...context,
          organization: {
            id: "other-org-delete",
            name: "Other Org",
            subdomain: "other",
          },
        };
        const otherCaller = locationRouter.createCaller(otherOrgContext as any);

        await expect(otherCaller.delete({ id: location.id })).rejects.toThrow(
          "You don't have permission to access this organization",
        );

        // Verify location still exists
        const dbLocation = await db.query.locations.findFirst({
          where: eq(schema.locations.id, location.id),
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
        const { caller, location } = await createTestContext(db);

        const result = await caller.setPinballMapId({
          locationId: location.id,
          pinballMapId: 12345,
        });

        expect(result.pinballMapId).toBe(12345);

        // Verify in database
        const dbLocation = await db.query.locations.findFirst({
          where: eq(schema.locations.id, location.id),
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
        const { location, context } = await createTestContext(db);

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
            locationId: location.id,
            pinballMapId: 999,
          }),
        ).rejects.toThrow(
          "You don't have permission to access this organization",
        );

        // Verify pinballMapId unchanged
        const dbLocation = await db.query.locations.findFirst({
          where: eq(schema.locations.id, location.id),
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
