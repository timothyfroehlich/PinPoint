/**
 * Machine Owner Router Business Logic Integration Tests (PGlite)
 *
 * Tests machine owner router functionality and database operations with PGlite in-memory database.
 *
 * ⚠️  SECURITY BOUNDARIES ARE NOT TESTED HERE
 * Security boundary testing is done in pgTAP tests (supabase/tests/rls/)
 * PGlite cannot enforce RLS policies - this tests business logic only
 *
 * What this tests:
 * - Owner assignment router functionality
 * - Database record updates for machine ownership
 * - Error handling for invalid inputs
 * - Data relationships and foreign key constraints
 * - Service integrations and notifications
 *
 * What this does NOT test:
 * - Organizational data isolation (tested in pgTAP)
 * - RLS policy enforcement (impossible in PGlite)
 * - Cross-organizational access prevention (tested in pgTAP)
 * - User membership validation (application-layer security)
 *
 * Uses modern August 2025 patterns with memory-safe PGlite integration.
 */

import { eq } from "drizzle-orm";
import { describe, expect, vi } from "vitest";

import { machineOwnerRouter } from "~/server/api/routers/machine.owner";
import * as schema from "~/server/db/schema";
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import { createPrimaryAdminContext } from "~/test/helpers/createSeededMachineTestContext";
import type { TestDatabase } from "~/test/helpers/pglite-test-setup";

// Mock external dependencies that aren't database-related
vi.mock("~/server/auth/permissions", () => ({
  getUserPermissionsForSession: vi
    .fn()
    .mockResolvedValue([
      "machine:edit",
      "machine:delete",
      "organization:manage",
    ]),
  requirePermissionForSession: vi.fn().mockResolvedValue(undefined),
}));

// Mock the service factory to avoid service dependencies
vi.mock("~/server/services/factory", () => ({
  createServiceFactory: vi.fn(() => ({
    createNotificationService: vi.fn(() => ({
      notifyMachineOwnerOfIssue: vi.fn(),
      notifyMachineOwnerOfStatusChange: vi.fn(),
    })),
    createIssueActivityService: vi.fn(() => ({
      recordActivity: vi.fn(),
    })),
  })),
}));

/**
 * Business Logic Test Setup Helper
 *
 * Tests machine owner router functionality and database operations ONLY.
 *
 * ⚠️  SECURITY BOUNDARIES ARE NOT TESTED HERE
 * Security boundary testing is done in pgTAP tests (supabase/tests/rls/)
 * PGlite cannot enforce RLS policies - this tests business logic only
 *
 * What this tests:
 * - Router function execution
 * - Database record updates for machine ownership
 * - Data relationships and foreign key constraints
 * - Error handling for invalid inputs
 *
 * What this does NOT test:
 * - Organizational data isolation (pgTAP only)
 * - RLS policy enforcement (impossible in PGlite)
 * - Cross-organizational access prevention (pgTAP only)
 */
async function withMachineOwnerBusinessLogicSetup(workerDb, testFn) {
  await withIsolatedTest(workerDb, async (db) => {
    // Set up test data using seeded data - no RLS context needed
    const testData = await setupTestData(db);

    // Direct business logic setup - no RLS context needed
    const ctx = await createPrimaryAdminContext(db);
    const caller = machineOwnerRouter.createCaller(ctx);

    await testFn(db, caller, testData, ctx);
  });
}

// Helper function to set up test data using seeded data
async function setupTestData(db: TestDatabase) {
  // Use seeded data from primary organization
  const organizationId = SEED_TEST_IDS.ORGANIZATIONS.primary;

  // Get seeded users
  const testUser1 = await db.query.users.findFirst({
    where: eq(schema.users.id, SEED_TEST_IDS.USERS.ADMIN),
  });

  const testUser2 = await db.query.users.findFirst({
    where: eq(schema.users.id, SEED_TEST_IDS.USERS.MEMBER1),
  });

  if (!testUser1 || !testUser2) {
    throw new Error("Missing seeded test users");
  }

  return {
    organizationId,
    testUser1,
    testUser2,
    machine: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
    location: SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR,
  };
}

describe("Machine Owner Router Business Logic Integration (PGlite)", () => {
  describe("assignOwner mutation", () => {
    test("should assign owner to machine successfully", async ({
      workerDb,
    }) => {
      await withMachineOwnerBusinessLogicSetup(
        workerDb,
        async (db, caller, { machine, testUser2 }) => {
          const result = await caller.assignOwner({
            machineId: machine,
            ownerId: testUser2.id,
          });

          // Verify the result structure
          expect(result).toMatchObject({
            id: machine,
            ownerId: testUser2.id,
          });

          // Verify relationships are loaded
          expect(result.model).toBeDefined();
          expect(result.model.name).toBeDefined();
          expect(result.location).toBeDefined();
          expect(result.location.name).toBeDefined();
          expect(result.owner).toBeDefined();
          expect(result.owner).toMatchObject({
            id: testUser2.id,
            name: testUser2.name,
            profilePicture: null,
          });

          // Verify the database was actually updated
          const updatedMachine = await db.query.machines.findFirst({
            where: eq(schema.machines.id, machine),
          });
          expect(updatedMachine?.ownerId).toBe(testUser2.id);
        },
      );
    });

    test("should handle reassigning owner", async ({ workerDb }) => {
      await withMachineOwnerBusinessLogicSetup(
        workerDb,
        async (db, caller, { machine, testUser1, testUser2 }) => {
          // First assignment
          await caller.assignOwner({
            machineId: machine,
            ownerId: testUser1.id,
          });

          // Verify first assignment
          const firstAssignment = await db.query.machines.findFirst({
            where: eq(schema.machines.id, machine),
          });
          expect(firstAssignment?.ownerId).toBe(testUser1.id);

          // Reassign to different user
          const result = await caller.assignOwner({
            machineId: machine,
            ownerId: testUser2.id,
          });

          // Verify reassignment result
          expect(result).toMatchObject({
            id: machine,
            ownerId: testUser2.id,
          });

          // Verify database reflects the change
          const reassignment = await db.query.machines.findFirst({
            where: eq(schema.machines.id, machine),
          });
          expect(reassignment?.ownerId).toBe(testUser2.id);
          expect(reassignment?.ownerId).not.toBe(testUser1.id);
        },
      );
    });

    test("should handle null owner assignment (unassign)", async ({
      workerDb,
    }) => {
      await withMachineOwnerBusinessLogicSetup(
        workerDb,
        async (db, caller, { machine, testUser1 }) => {
          // First assign an owner
          await caller.assignOwner({
            machineId: machine,
            ownerId: testUser1.id,
          });

          // Verify assignment
          const assigned = await db.query.machines.findFirst({
            where: eq(schema.machines.id, machine),
          });
          expect(assigned?.ownerId).toBe(testUser1.id);

          // Unassign owner
          const result = await caller.assignOwner({
            machineId: machine,
            ownerId: null,
          });

          // Verify unassignment result
          expect(result).toMatchObject({
            id: machine,
            ownerId: null,
          });

          // Verify database reflects the change
          const unassigned = await db.query.machines.findFirst({
            where: eq(schema.machines.id, machine),
          });
          expect(unassigned?.ownerId).toBeNull();
        },
      );
    });

    test("should preserve other machine fields during owner assignment", async ({
      workerDb,
    }) => {
      await withMachineOwnerBusinessLogicSetup(
        workerDb,
        async (db, caller, { machine, testUser2 }) => {
          // Get original machine data
          const originalMachine = await db.query.machines.findFirst({
            where: eq(schema.machines.id, machine),
          });

          await caller.assignOwner({
            machineId: machine,
            ownerId: testUser2.id,
          });

          // Verify other fields weren't modified
          const updatedMachine = await db.query.machines.findFirst({
            where: eq(schema.machines.id, machine),
          });

          expect(updatedMachine?.name).toBe(originalMachine?.name);
          expect(updatedMachine?.modelId).toBe(originalMachine?.modelId);
          expect(updatedMachine?.locationId).toBe(originalMachine?.locationId);
          expect(updatedMachine?.organizationId).toBe(
            originalMachine?.organizationId,
          );
          expect(updatedMachine?.qrCodeId).toBe(originalMachine?.qrCodeId);
          expect(updatedMachine?.qrCodeUrl).toBe(originalMachine?.qrCodeUrl);

          // Only ownerId should have changed
          expect(updatedMachine?.ownerId).toBe(testUser2.id);
          expect(updatedMachine?.ownerId).not.toBe(originalMachine?.ownerId);
        },
      );
    });

    test("should throw NOT_FOUND for non-existent machine", async ({
      workerDb,
    }) => {
      await withMachineOwnerBusinessLogicSetup(
        workerDb,
        async (db, caller, { testUser1 }) => {
          await expect(
            caller.assignOwner({
              machineId: "non-existent-machine",
              ownerId: testUser1.id,
            }),
          ).rejects.toThrow("Machine not found");
        },
      );
    });

    test("should throw NOT_FOUND for non-existent user", async ({
      workerDb,
    }) => {
      await withMachineOwnerBusinessLogicSetup(
        workerDb,
        async (db, caller, { machine }) => {
          await expect(
            caller.assignOwner({
              machineId: machine,
              ownerId: "non-existent-user",
            }),
          ).rejects.toThrow("User not found");
        },
      );
    });
  });

  describe("getByOwnerId query", () => {
    test("should get machines owned by specific user", async ({ workerDb }) => {
      await withMachineOwnerBusinessLogicSetup(
        workerDb,
        async (db, caller, { machine, testUser1 }) => {
          // Assign owner to machine
          await caller.assignOwner({
            machineId: machine,
            ownerId: testUser1.id,
          });

          // Query machines by owner
          const result = await caller.getByOwnerId({
            ownerId: testUser1.id,
          });

          expect(result).toHaveLength(1);
          expect(result[0]).toMatchObject({
            id: machine,
            ownerId: testUser1.id,
          });

          // Verify relationships are loaded
          expect(result[0].model).toBeDefined();
          expect(result[0].location).toBeDefined();
          expect(result[0].owner).toBeDefined();
        },
      );
    });

    test("should return empty array for user with no machines", async ({
      workerDb,
    }) => {
      await withMachineOwnerBusinessLogicSetup(
        workerDb,
        async (db, caller, { testUser2 }) => {
          const result = await caller.getByOwnerId({
            ownerId: testUser2.id,
          });

          expect(result).toEqual([]);
        },
      );
    });

    test("should handle null ownerId parameter", async ({ workerDb }) => {
      await withMachineOwnerBusinessLogicSetup(
        workerDb,
        async (db, caller, { machine }) => {
          // Ensure machine has no owner
          await caller.assignOwner({
            machineId: machine,
            ownerId: null,
          });

          const result = await caller.getByOwnerId({
            ownerId: null,
          });

          // Should find machines with null ownerId
          expect(result.length).toBeGreaterThanOrEqual(1);
          const foundMachine = result.find((m) => m.id === machine);
          expect(foundMachine).toBeDefined();
          expect(foundMachine?.ownerId).toBeNull();
        },
      );
    });
  });

  describe("Data relationships and constraints", () => {
    test("should maintain referential integrity", async ({ workerDb }) => {
      await withMachineOwnerBusinessLogicSetup(
        workerDb,
        async (db, caller, { machine, testUser1 }) => {
          // Assign owner
          const result = await caller.assignOwner({
            machineId: machine,
            ownerId: testUser1.id,
          });

          // Verify all foreign key relationships load correctly
          expect(result.model).toBeDefined();
          expect(result.model.id).toBeDefined();
          expect(result.location).toBeDefined();
          expect(result.location.id).toBeDefined();
          expect(result.owner).toBeDefined();
          expect(result.owner.id).toBe(testUser1.id);

          // Verify database constraints are respected
          const dbRecord = await db.query.machines.findFirst({
            where: eq(schema.machines.id, machine),
            with: {
              model: true,
              location: true,
              owner: true,
            },
          });

          expect(dbRecord).toBeDefined();
          expect(dbRecord?.model).toBeDefined();
          expect(dbRecord?.location).toBeDefined();
          expect(dbRecord?.owner).toBeDefined();
          expect(dbRecord?.owner?.id).toBe(testUser1.id);
        },
      );
    });
  });
});
