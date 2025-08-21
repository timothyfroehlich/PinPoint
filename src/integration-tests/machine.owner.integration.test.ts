/**
 * Machine Owner Router Integration Tests (PGlite)
 *
 * Integration tests for the machine.owner router using PGlite in-memory PostgreSQL database.
 * Tests real database operations with proper schema, relationships, and data integrity.
 *
 * Key Features:
 * - Real PostgreSQL database with PGlite
 * - Complete schema migrations applied
 * - Real Drizzle ORM operations
 * - Multi-tenant data isolation testing
 * - Owner assignment and membership validation
 * - Uses seeded data infrastructure for predictable, fast testing
 *
 * Uses modern August 2025 patterns with Vitest and PGlite integration.
 */

import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, vi } from "vitest";

import { machineOwnerRouter } from "~/server/api/routers/machine.owner";
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
  generateId: vi.fn(() => generateTestId("test-id")),
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
  supabaseUserToSession: vi.fn((user) => ({
    user: {
      id: user?.id ?? generateTestId("fallback-user"),
      email: user?.email ?? "test@example.com",
      name: user?.name ?? "Test User",
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  })),
}));

describe("machine.owner router integration tests", () => {
  // Shared test database and seeded data
  let workerDb: TestDatabase;
  let seededData: Awaited<ReturnType<typeof getSeededTestData>>;

  beforeAll(async () => {
    // Create seeded test database
    const { db, organizationId } = await createSeededTestDatabase();
    workerDb = db;
    
    // Get seeded test data for primary organization
    seededData = await getSeededTestData(db, organizationId);
  });

  describe("assignOwner mutation", () => {
    describe("success scenarios", () => {
      test("should assign owner to machine successfully", async () => {
        await withIsolatedTest(workerDb, async (db) => {
          // Create test context using seeded data
          const context = await createSeededMachineTestContext(
            db,
            seededData.organization,
            seededData.user!,
          );
          const caller = machineOwnerRouter.createCaller(context);

          // Create test model for machine
          const [testModel] = await db
            .insert(schema.models)
            .values({
              id: generateTestId("model"),
              name: "Test Model",
              manufacturer: "Test Manufacturer",
              year: 2024,
            })
            .returning();

          // Create test machine (initially without owner)
          const [testMachine] = await db
            .insert(schema.machines)
            .values({
              id: generateTestId("machine"),
              name: "Test Machine",
              qrCodeId: generateTestId("qr"),
              organizationId: seededData.organization,
              locationId: seededData.location!,
              modelId: testModel.id,
              ownerId: null, // No initial owner
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();

          // Create a test user to assign as owner
          const [testUser2] = await db
            .insert(schema.users)
            .values({
              id: "test-user-2",
              name: "Test User 2",
              email: "user2@example.com",
              image: "https://example.com/avatar2.jpg",
              emailVerified: null,
            })
            .returning();

          // Create membership for test user 2
          await db.insert(schema.memberships).values({
            id: "test-membership-2",
            userId: testUser2.id,
            organizationId: seededData.organization,
            roleId: seededData.memberRole!,
          });

          // Verify machine has no owner initially
          const initialMachine = await db.query.machines.findFirst({
            where: eq(schema.machines.id, testMachine.id),
          });
          expect(initialMachine?.ownerId).toBeNull();

          const result = await caller.assignOwner({
            machineId: testMachine.id,
            ownerId: testUser2.id,
          });

          // Verify the result structure
          expect(result).toMatchObject({
            id: testMachine.id,
            ownerId: testUser2.id,
            organizationId: seededData.organization,
          });

          // Verify relationships are loaded
          expect(result.model).toBeDefined();
          expect(result.model.id).toBe(testModel.id);
          expect(result.location).toBeDefined();
          expect(result.location.id).toBe(seededData.location);
          expect(result.owner).toBeDefined();
          expect(result.owner).toMatchObject({
            id: testUser2.id,
            name: "Test User 2",
            image: "https://example.com/avatar2.jpg",
          });

          // Verify the database was actually updated
          const updatedMachine = await db.query.machines.findFirst({
            where: eq(schema.machines.id, testMachine.id),
          });
          expect(updatedMachine?.ownerId).toBe(testUser2.id);
        });
      });

      test("should remove owner from machine successfully", async () => {
        await withIsolatedTest(workerDb, async (db) => {
          // Create test context using seeded data
          const context = await createSeededMachineTestContext(
            db,
            seededData.organization,
            seededData.user!,
          );
          const caller = machineOwnerRouter.createCaller(context);

          // Create a test user and assign as owner first
          const [testUser2] = await db
            .insert(schema.users)
            .values({
              id: "test-user-2",
              name: "Test User 2",
              email: "user2@example.com",
              image: "https://example.com/avatar2.jpg",
              emailVerified: null,
            })
            .returning();

          // First assign an owner
          await db
            .update(schema.machines)
            .set({ ownerId: testUser2.id })
            .where(eq(schema.machines.id, seededData.machine!));

          const result = await caller.assignOwner({
            machineId: seededData.machine!,
            // ownerId is omitted to remove owner
          });

          // Verify the result structure
          expect(result).toMatchObject({
            id: seededData.machine,
            ownerId: null,
            organizationId: seededData.organization,
          });

          // Verify relationships are loaded but owner is null
          expect(result.model).toBeDefined();
          expect(result.location).toBeDefined();
          expect(result.owner).toBeNull();

          // Verify the database was actually updated
          const updatedMachine = await db.query.machines.findFirst({
            where: eq(schema.machines.id, seededData.machine!),
          });
          expect(updatedMachine?.ownerId).toBeNull();
        });
      });
    });

    describe("error scenarios", () => {
      test("should throw NOT_FOUND when machine does not exist", async () => {
        await withIsolatedTest(workerDb, async (db) => {
          // Create test context using seeded data
          const context = await createSeededMachineTestContext(
            db,
            seededData.organization,
            seededData.user!,
          );
          const caller = machineOwnerRouter.createCaller(context);

          await expect(
            caller.assignOwner({
              machineId: "nonexistent-machine",
              ownerId: "test-user-2",
            }),
          ).rejects.toThrow(
            new TRPCError({
              code: "NOT_FOUND",
              message: "Machine not found",
            }),
          );
        });
      });

      test("should throw FORBIDDEN when user is not a member of organization", async () => {
        await withIsolatedTest(workerDb, async (db) => {
          // Create test context using seeded data
          const context = await createSeededMachineTestContext(
            db,
            seededData.organization,
            seededData.user!,
          );
          const caller = machineOwnerRouter.createCaller(context);

          // Create a user that's not a member of the organization
          const [nonMemberUser] = await db
            .insert(schema.users)
            .values({
              id: "non-member-user",
              name: "Non Member User",
              email: "nonmember@example.com",
              image: null,
              emailVerified: null,
            })
            .returning();

          await expect(
            caller.assignOwner({
              machineId: seededData.machine!,
              ownerId: nonMemberUser.id,
            }),
          ).rejects.toThrow(
            new TRPCError({
              code: "FORBIDDEN",
              message: "User is not a member of this organization",
            }),
          );
        });
      });
    });

    describe("organizational scoping and security", () => {
      test("should enforce organizational boundaries", async () => {
        await withIsolatedTest(workerDb, async (db) => {
          // Create test context using seeded data
          const context = await createSeededMachineTestContext(
            db,
            seededData.organization,
            seededData.user!,
          );
          const caller = machineOwnerRouter.createCaller(context);

          // Create a competitor organization context using the seeded competitor org
          const competitorOrgId = SEED_TEST_IDS.ORGANIZATIONS.competitor;

          // Ensure competitor organization exists
          await db.insert(schema.organizations).values({
            id: competitorOrgId,
            name: "Competitor Organization",
            subdomain: "competitor",
            createdAt: new Date(),
            updatedAt: new Date(),
          }).onConflictDoNothing();

          // Create competitor context
          const competitorContext = await createSeededMachineTestContext(
            db,
            competitorOrgId,
            seededData.user!,
          );
          const competitorCaller = machineOwnerRouter.createCaller(competitorContext);

          // Try to access primary org's machine from competitor org context
          await expect(
            competitorCaller.assignOwner({
              machineId: seededData.machine!, // This machine belongs to primary org
              ownerId: seededData.user!,
            }),
          ).rejects.toThrow(
            new TRPCError({
              code: "NOT_FOUND",
              message: "Machine not found",
            }),
          );
        });
      });

      test("should return only safe user data in owner relationship", async () => {
        await withIsolatedTest(workerDb, async (db) => {
          // Create test context using seeded data
          const context = await createSeededMachineTestContext(
            db,
            seededData.organization,
            seededData.user!,
          );
          const caller = machineOwnerRouter.createCaller(context);

          // Create a test user to assign as owner
          const [testUser2] = await db
            .insert(schema.users)
            .values({
              id: "test-user-2",
              name: "Test User 2",
              email: "user2@example.com",
              image: "https://example.com/avatar2.jpg",
              emailVerified: null,
            })
            .returning();

          // Create membership for test user 2
          await db.insert(schema.memberships).values({
            id: "test-membership-2",
            userId: testUser2.id,
            organizationId: seededData.organization,
            roleId: seededData.memberRole!,
          });

          const result = await caller.assignOwner({
            machineId: seededData.machine!,
            ownerId: testUser2.id,
          });

          // Should only include id, name, and image (no email or other sensitive data)
          expect(result.owner).toEqual({
            id: testUser2.id,
            name: "Test User 2",
            image: "https://example.com/avatar2.jpg",
          });

          // Make sure no sensitive data is leaked
          expect(result.owner).not.toHaveProperty("email");
          expect(result.owner).not.toHaveProperty("emailVerified");
        });
      });
    });

    describe("data integrity and relationships", () => {
      test("should maintain referential integrity", async () => {
        await withIsolatedTest(workerDb, async (db) => {
          // Create test context using seeded data
          const context = await createSeededMachineTestContext(
            db,
            seededData.organization,
            seededData.user!,
          );
          const caller = machineOwnerRouter.createCaller(context);

          // Create a test user to assign as owner
          const [testUser2] = await db
            .insert(schema.users)
            .values({
              id: "test-user-2",
              name: "Test User 2",
              email: "user2@example.com",
              image: "https://example.com/avatar2.jpg",
              emailVerified: null,
            })
            .returning();

          // Create membership for test user 2
          await db.insert(schema.memberships).values({
            id: "test-membership-2",
            userId: testUser2.id,
            organizationId: seededData.organization,
            roleId: seededData.memberRole!,
          });

          const result = await caller.assignOwner({
            machineId: seededData.machine!,
            ownerId: testUser2.id,
          });

          // Verify all relationships exist and are consistent
          expect(result.model.id).toBe(seededData.model);
          expect(result.location.id).toBe(seededData.location);
          expect(result.location.organizationId).toBe(seededData.organization);

          // Verify the relationships in the database
          const machineInDb = await db.query.machines.findFirst({
            where: eq(schema.machines.id, seededData.machine!),
            with: {
              model: true,
              location: true,
              owner: true,
            },
          });

          expect(machineInDb?.model?.id).toBe(result.model.id);
          expect(machineInDb?.location?.id).toBe(result.location.id);
          expect(machineInDb?.owner?.id).toBe(result.owner?.id);
        });
      });
    });
  });
});
