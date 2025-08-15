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
 *
 * Uses modern August 2025 patterns with Vitest and PGlite integration.
 */

import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { describe, expect, vi } from "vitest";

// Import test setup and utilities
import type { TRPCContext } from "~/server/api/trpc.base";
import type { TestDatabase } from "~/test/helpers/pglite-test-setup";

import { machineOwnerRouter } from "~/server/api/routers/machine.owner";
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

describe("machine.owner router integration tests", () => {
  // Helper function to set up test data and context
  async function setupTestData(db: TestDatabase) {
    // Create seed data first
    const organizationId = generateTestId("test-org");

    // Create organization
    const [org] = await db
      .insert(schema.organizations)
      .values({
        id: organizationId,
        name: "Test Organization",
        subdomain: "test",
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
        name: "Test Model",
        manufacturer: "Test Manufacturer",
        year: 2024,
      })
      .returning();

    // Create a test user to be the initial owner
    const [testUser] = await db
      .insert(schema.users)
      .values({
        id: "test-user-1",
        name: "Test User 1",
        email: `user1-${generateTestId("user")}@example.com`,
        image: "https://example.com/avatar1.jpg",
        emailVerified: null,
      })
      .returning();

    // Create machine (initially without owner)
    const [machine] = await db
      .insert(schema.machines)
      .values({
        id: "test-machine",
        name: "Test Machine",
        qrCodeId: generateTestId("qr"),
        organizationId,
        locationId: location.id,
        modelId: model.id,
        ownerId: null, // No initial owner
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Create membership for the main test user
    await db.insert(schema.memberships).values({
      id: "test-membership-1",
      userId: testUser.id,
      organizationId,
      roleId: adminRole.id, // Make the main user an admin so they can assign owners
    });

    // Create test data object with the created infrastructure
    const testData = {
      organization: organizationId,
      location: location.id,
      machine: machine.id,
      model: model.id,
      priority: undefined,
      status: undefined,
      issue: undefined,
      adminRole: adminRole.id,
      memberRole: memberRole.id,
      user: testUser.id,
    };

    // Create additional test users for testing membership scenarios
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
      organizationId: organizationId,
      roleId: testData.memberRole,
    });

    // Create test context with real database
    const ctx: TRPCContext = {
      db: db,
      user: {
        id: testData.user ?? "test-user-fallback",
        email: "test@example.com",
        name: "Test User",
        user_metadata: {},
        app_metadata: {
          organization_id: organizationId,
        },
      },
      organization: {
        id: organizationId,
        name: "Test Organization",
        subdomain: "test",
      },
      supabase: {} as any, // Not used in this router
      headers: new Headers(),
      userPermissions: [
        "machine:edit",
        "machine:delete",
        "organization:manage",
      ],
      services: {} as any, // Not used in this router
      logger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        trace: vi.fn(),
        child: vi.fn(() => ctx.logger),
        withRequest: vi.fn(() => ctx.logger),
        withUser: vi.fn(() => ctx.logger),
        withOrganization: vi.fn(() => ctx.logger),
        withContext: vi.fn(() => ctx.logger),
      } as any,
    };

    return { testData, ctx, organizationId };
  }

  describe("assignOwner mutation", () => {
    describe("success scenarios", () => {
      test("should assign owner to machine successfully", async ({
        workerDb,
      }) => {
        await withIsolatedTest(workerDb, async (db) => {
          const { testData, ctx, organizationId } = await setupTestData(db);

          // First ensure machine has no owner
          await db
            .update(schema.machines)
            .set({ ownerId: null })
            .where(eq(schema.machines.id, testData.machine ?? "test-machine"));

          const caller = machineOwnerRouter.createCaller(ctx);

          // Verify machine has no owner initially
          const initialMachine = await db.query.machines.findFirst({
            where: eq(schema.machines.id, testData.machine ?? "test-machine"),
          });
          expect(initialMachine?.ownerId).toBeNull();

          const result = await caller.assignOwner({
            machineId: testData.machine ?? "test-machine",
            ownerId: "test-user-2",
          });

          // Verify the result structure
          expect(result).toMatchObject({
            id: testData.machine ?? "test-machine",
            ownerId: "test-user-2",
            organizationId: organizationId,
          });

          // Verify relationships are loaded
          expect(result.model).toBeDefined();
          expect(result.model.id).toBe(testData.model);
          expect(result.location).toBeDefined();
          expect(result.location.id).toBe(testData.location);
          expect(result.owner).toBeDefined();
          expect(result.owner).toMatchObject({
            id: "test-user-2",
            name: "Test User 2",
            image: "https://example.com/avatar2.jpg",
          });

          // Verify the database was actually updated
          const updatedMachine = await db.query.machines.findFirst({
            where: eq(schema.machines.id, testData.machine ?? "test-machine"),
          });
          expect(updatedMachine?.ownerId).toBe("test-user-2");
        });
      });

      test("should remove owner from machine successfully", async ({
        workerDb,
      }) => {
        await withIsolatedTest(workerDb, async (db) => {
          const { testData, ctx, organizationId } = await setupTestData(db);

          // First assign an owner
          await db
            .update(schema.machines)
            .set({ ownerId: "test-user-2" })
            .where(eq(schema.machines.id, testData.machine ?? "test-machine"));

          const caller = machineOwnerRouter.createCaller(ctx);

          const result = await caller.assignOwner({
            machineId: testData.machine ?? "test-machine",
            // ownerId is omitted to remove owner
          });

          // Verify the result structure
          expect(result).toMatchObject({
            id: testData.machine ?? "test-machine",
            ownerId: null,
            organizationId: organizationId,
          });

          // Verify relationships are loaded but owner is null
          expect(result.model).toBeDefined();
          expect(result.location).toBeDefined();
          expect(result.owner).toBeNull();

          // Verify the database was actually updated
          const updatedMachine = await db.query.machines.findFirst({
            where: eq(schema.machines.id, testData.machine ?? "test-machine"),
          });
          expect(updatedMachine?.ownerId).toBeNull();
        });
      });
    });

    describe("error scenarios", () => {
      test("should throw NOT_FOUND when machine does not exist", async ({
        workerDb,
      }) => {
        await withIsolatedTest(workerDb, async (db) => {
          const { ctx } = await setupTestData(db);
          const caller = machineOwnerRouter.createCaller(ctx);

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

      test("should throw FORBIDDEN when user is not a member of organization", async ({
        workerDb,
      }) => {
        await withIsolatedTest(workerDb, async (db) => {
          const { testData, ctx } = await setupTestData(db);

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

          const caller = machineOwnerRouter.createCaller(ctx);

          await expect(
            caller.assignOwner({
              machineId: testData.machine ?? "test-machine",
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
      test("should enforce organizational boundaries", async ({ workerDb }) => {
        await withIsolatedTest(workerDb, async (db) => {
          const { testData, ctx } = await setupTestData(db);

          // Create a second organization
          const [org2] = await db
            .insert(schema.organizations)
            .values({
              id: "org-2",
              name: "Organization 2",
              subdomain: "org2",
            })
            .returning();

          // Update context to use different organization
          const org2Ctx = {
            ...ctx,
            organization: {
              id: org2.id,
              name: org2.name,
              subdomain: org2.subdomain,
            },
            user: {
              ...ctx.user,
              app_metadata: {
                organization_id: org2.id,
              },
            },
            db: {
              membership: {
                findFirst: async (_args: any) => {
                  // Return null since user is not a member of org2
                  return null;
                },
              },
            } as any,
          };

          const caller = machineOwnerRouter.createCaller(org2Ctx);

          await expect(
            caller.assignOwner({
              machineId: testData.machine ?? "test-machine", // This machine belongs to org1
              ownerId: "test-user-2",
            }),
          ).rejects.toThrow(
            new TRPCError({
              code: "FORBIDDEN",
              message: "You don't have permission to access this organization",
            }),
          );
        });
      });

      test("should return only safe user data in owner relationship", async ({
        workerDb,
      }) => {
        await withIsolatedTest(workerDb, async (db) => {
          const { testData, ctx } = await setupTestData(db);
          const caller = machineOwnerRouter.createCaller(ctx);

          const result = await caller.assignOwner({
            machineId: testData.machine ?? "test-machine",
            ownerId: "test-user-2",
          });

          // Should only include id, name, and image (no email or other sensitive data)
          expect(result.owner).toEqual({
            id: "test-user-2",
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
      test("should maintain referential integrity", async ({ workerDb }) => {
        await withIsolatedTest(workerDb, async (db) => {
          const { testData, ctx, organizationId } = await setupTestData(db);
          const caller = machineOwnerRouter.createCaller(ctx);

          const result = await caller.assignOwner({
            machineId: testData.machine ?? "test-machine",
            ownerId: "test-user-2",
          });

          // Verify all relationships exist and are consistent
          expect(result.model.id).toBe(testData.model);
          expect(result.location.id).toBe(testData.location);
          expect(result.location.organizationId).toBe(organizationId);

          // Verify the relationships in the database
          const machineInDb = await db.query.machines.findFirst({
            where: eq(schema.machines.id, testData.machine ?? "test-machine"),
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
