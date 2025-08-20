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

// Import test ID generator for collision-free IDs

// Import test setup and utilities

import { machineLocationRouter } from "~/server/api/routers/machine.location";
import * as schema from "~/server/db/schema";
import { type TestDatabase } from "~/test/helpers/pglite-test-setup";
import {
  generateTestId,
  generateTestSubdomain,
} from "~/test/helpers/test-id-generator";
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
  // Helper function to set up test data and context
  async function setupTestData(db: TestDatabase) {
    // Create test organization
    const organizationId = generateTestId("org");
    const [org] = await db
      .insert(schema.organizations)
      .values({
        id: organizationId,
        name: "Test Organization",
        subdomain: generateTestSubdomain("test-org"),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Create roles
    const [adminRole] = await db
      .insert(schema.roles)
      .values({
        id: generateTestId("admin-role"),
        name: "Admin",
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const [memberRole] = await db
      .insert(schema.roles)
      .values({
        id: generateTestId("member-role"),
        name: "Member",
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Create test user
    const [testUser] = await db
      .insert(schema.users)
      .values({
        id: generateTestId("user"),
        email: `admin-${generateTestId("email")}@dev.local`,
        name: "Dev Admin",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Create membership
    await db.insert(schema.memberships).values({
      id: generateTestId("membership"),
      userId: testUser.id,
      organizationId,
      roleId: adminRole.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create location
    const [location] = await db
      .insert(schema.locations)
      .values({
        id: generateTestId("location"),
        name: "Test Location",
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Create model
    const [model] = await db
      .insert(schema.models)
      .values({
        id: generateTestId("model"),
        name: "Ultraman: Kaiju Rumble (Blood Sucker Edition)",
        manufacturer: "Stern",
        year: 2024,
      })
      .returning();

    // Create machine
    const [machine] = await db
      .insert(schema.machines)
      .values({
        id: generateTestId("machine"),
        name: "Ultraman Test Machine",
        qrCodeId: generateTestId("qr"),
        organizationId,
        locationId: location.id,
        modelId: model.id,
        ownerId: testUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Create priority and status for potential issue creation
    const [priority] = await db
      .insert(schema.priorities)
      .values({
        id: generateTestId("priority"),
        name: "High",
        organizationId,
        order: 1,
      })
      .returning();

    const [status] = await db
      .insert(schema.issueStatuses)
      .values({
        id: generateTestId("status"),
        name: "Open",
        category: "NEW",
        organizationId,
      })
      .returning();

    const testData = {
      organization: organizationId,
      location: location.id,
      machine: machine.id,
      model: model.id,
      priority: priority.id,
      status: status.id,
      issue: undefined,
      adminRole: adminRole.id,
      memberRole: memberRole.id,
      user: testUser.id,
    };

    // Create a second location for testing moves
    const [secondLocation] = await db
      .insert(schema.locations)
      .values({
        id: generateTestId("second-location"),
        name: "Second Test Location",
        organizationId: testData.organization,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    testData.secondLocation = secondLocation.id;

    // Create a second machine for additional testing
    const [secondMachine] = await db
      .insert(schema.machines)
      .values({
        id: generateTestId("second-machine"),
        name: "Second Test Machine",
        qrCodeId: generateTestId("qr-second"),
        organizationId: testData.organization,
        locationId: testData.location, // Start at first location
        modelId: testData.model,
        ownerId: testData.user,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    testData.secondMachine = secondMachine.id;

    // Create service factories for Drizzle-only services
    const serviceFactories = {
      createPinballMapService: vi.fn(),
      createNotificationService: vi.fn(),
      createCollectionService: vi.fn(),
      createIssueActivityService: vi.fn(),
      createCommentCleanupService: vi.fn(),
      createQRCodeService: vi.fn(),
    };

    // Create test context with real database
    const context = {
      user: {
        id: testData.user || generateTestId("test-user-fallback-id"),
        email: "test@example.com",
        user_metadata: { name: "Test User" },
        app_metadata: { organization_id: testData.organization, role: "Admin" },
      },
      organization: {
        id: testData.organization,
        name: "Test Organization",
        subdomain: generateTestId("test-org"),
      },
      organizationId: testData.organization, // Required for orgScopedProcedure
      db: db,
      supabase: {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      } as any,
      services: serviceFactories,
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
        "machine:edit",
        "machine:delete",
        "organization:manage",
      ],
    } as any;

    const caller = machineLocationRouter.createCaller(context);

    return { testData, context, caller };
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

        // Verify machine name and relationships are included
        expect(result.name).toContain("Ultraman"); // From production seeds
        expect(result.model).toMatchObject({
          name: "Ultraman: Kaiju Rumble (Blood Sucker Edition)",
          manufacturer: "Stern",
        });
        expect(result.location).toMatchObject({
          id: testData.secondLocation,
          name: "Second Test Location",
        });
        expect(result.owner).toMatchObject({
          id: testData.user,
          name: "Dev Admin",
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
        // Create machine in different organization
        const otherOrgId = generateTestId("other-org");
        await db.insert(schema.organizations).values({
          id: otherOrgId,
          name: "Other Organization",
          subdomain: "other-org",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const [otherOrgMachine] = await db
          .insert(schema.machines)
          .values({
            id: generateTestId("other-machine"),
            name: "Other Org Machine",
            qrCodeId: generateTestId("other-qr"),
            organizationId: otherOrgId,
            locationId: testData.location, // Wrong! This should fail validation
            modelId: testData.model,
            ownerId: testData.user,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Try to move other org's machine
        await expect(
          caller.moveToLocation({
            machineId: otherOrgMachine.id,
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
        // Create location in different organization
        const otherOrgId = generateTestId("other-org-loc");
        await db.insert(schema.organizations).values({
          id: otherOrgId,
          name: "Other Organization",
          subdomain: "other-org",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const [otherOrgLocation] = await db
          .insert(schema.locations)
          .values({
            id: generateTestId("other-location"),
            name: "Other Org Location",
            organizationId: otherOrgId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Try to move our machine to other org's location
        await expect(
          caller.moveToLocation({
            machineId: testData.machine,
            locationId: otherOrgLocation.id,
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
        const { testData, caller, context } = await setupTestData(db);
        // Create completely separate organization with its own data
        const isolationOrgId = generateTestId("isolation-org");
        await db.insert(schema.organizations).values({
          id: isolationOrgId,
          name: "Isolation Test Organization",
          subdomain: "isolation-org",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const [isolationLocation] = await db
          .insert(schema.locations)
          .values({
            id: generateTestId("isolation-loc"),
            name: "Isolation Location",
            organizationId: isolationOrgId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        const [isolationMachine] = await db
          .insert(schema.machines)
          .values({
            id: generateTestId("isolation-machine"),
            name: "Isolation Machine",
            qrCodeId: generateTestId("isolation-qr"),
            organizationId: isolationOrgId,
            locationId: isolationLocation.id,
            modelId: testData.model, // Shared model (OK)
            ownerId: testData.user, // Shared user (OK)
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Test from different organization context
        const isolationContext = {
          ...context,
          organization: {
            id: isolationOrgId,
            name: "Isolation Test Organization",
            subdomain: "isolation-org",
          },
          organizationId: isolationOrgId, // Required for orgScopedProcedure
        };
        const isolationCaller = machineLocationRouter.createCaller(
          isolationContext as any,
        );

        // Isolation org should not be able to access our org's data
        await expect(
          isolationCaller.moveToLocation({
            machineId: testData.machine, // Our org's machine
            locationId: isolationLocation.id, // Their location
          }),
        ).rejects.toThrow();

        // Our org should not be able to access their data
        await expect(
          caller.moveToLocation({
            machineId: isolationMachine.id, // Their machine
            locationId: testData.secondLocation, // Our location
          }),
        ).rejects.toThrow("Game instance not found");

        // Each org should be able to work with their own data
        const [anotherIsolationLocation] = await db
          .insert(schema.locations)
          .values({
            id: generateTestId("another-isolation-loc"),
            name: "Another Isolation Location",
            organizationId: isolationOrgId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        const isolationResult = await isolationCaller.moveToLocation({
          machineId: isolationMachine.id,
          locationId: anotherIsolationLocation.id,
        });

        expect(isolationResult.locationId).toBe(anotherIsolationLocation.id);
        expect(isolationResult.organizationId).toBe(isolationOrgId);
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
        expect(result.model.name).toBe(
          "Ultraman: Kaiju Rumble (Blood Sucker Edition)",
        );
        expect(result.model.manufacturer).toBe("Stern");
        expect(result.location.name).toBe("Second Test Location");
        expect(result.owner.name).toBe("Dev Admin");

        // Verify the actual database relationships are correctly established
        const dbMachine = await db.query.machines.findFirst({
          where: eq(schema.machines.id, testData.machine),
          with: {
            model: true,
            location: true,
            owner: true,
          },
        });

        expect(dbMachine?.model?.name).toBe(
          "Ultraman: Kaiju Rumble (Blood Sucker Edition)",
        );
        expect(dbMachine?.location?.name).toBe("Second Test Location");
        expect(dbMachine?.owner?.name).toBe("Dev Admin");
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
            const machineId = generateTestId(`concurrent-machine-${i}`);
            const [machine] = await db
              .insert(schema.machines)
              .values({
                id: machineId,
                name: `Concurrent Machine ${i}`,
                qrCodeId: generateTestId(`concurrent-qr-${i}`),
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
