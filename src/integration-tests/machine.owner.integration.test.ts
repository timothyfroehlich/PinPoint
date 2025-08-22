/**
 * Machine Owner Router Integration Tests (PGlite)
 *
 * Consolidated integration tests for the machine.owner router using PGlite in-memory PostgreSQL database.
 * Tests real database operations with proper schema, relationships, organizational scoping, and data integrity.
 *
 * Key Features:
 * - Real PostgreSQL database with PGlite
 * - Complete schema migrations applied
 * - Real Drizzle ORM operations
 * - Multi-tenant data isolation testing
 * - Owner assignment and membership validation
 * - Comprehensive organizational scoping and security
 * - Advanced RLS context switching tests
 *
 * Uses modern August 2025 patterns with Vitest and worker-scoped PGlite integration.
 *
 * CONSOLIDATED: Combines comprehensive coverage from router test with integration test patterns.
 */

import { TRPCError } from "@trpc/server";
import { eq, and, sql } from "drizzle-orm";
import { describe, expect, vi } from "vitest";

// Import test setup and utilities
import type { TRPCContext } from "~/server/api/trpc.base";
import type { TestDatabase } from "~/test/helpers/pglite-test-setup";

import { machineOwnerRouter } from "~/server/api/routers/machine.owner";
import * as schema from "~/server/db/schema";
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
  supabaseUserToSession: vi.fn((user) => ({
    user: {
      id: user?.id ?? "fallback-user",
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

    // Create context using seeded data helper
    const ctx = await createPrimaryAdminContext(db);

    return {
      organizationId,
      adminRole: SEED_TEST_IDS.ROLES.ADMIN_PRIMARY,
      memberRole: SEED_TEST_IDS.ROLES.MEMBER_PRIMARY,
      testUser1,
      testUser2,
      model: "model-mm-001",
      location: SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR,
      machine: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      ctx,
    };
  }

  describe("assignOwner mutation", () => {
    describe("success scenarios", () => {
      test("should assign owner to machine successfully", async ({
        workerDb,
      }) => {
        await withIsolatedTest(workerDb, async (db) => {
          const { machine, testUser2, ctx } = await setupTestData(db);

          const caller = machineOwnerRouter.createCaller(ctx);

          const result = await caller.assignOwner({
            machineId: machine,
            ownerId: testUser2.id,
          });

          // Verify the result structure
          expect(result).toMatchObject({
            id: machine,
            ownerId: testUser2.id,
            organizationId: ctx.organization.id,
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
        });
      });

      test("should remove owner from machine successfully", async ({
        workerDb,
      }) => {
        await withIsolatedTest(workerDb, async (db) => {
          const { machine, testUser2, ctx } = await setupTestData(db);

          // First assign an owner
          await db
            .update(schema.machines)
            .set({ ownerId: testUser2.id })
            .where(eq(schema.machines.id, machine));

          const caller = machineOwnerRouter.createCaller(ctx);

          const result = await caller.assignOwner({
            machineId: machine,
            // ownerId is omitted to remove owner
          });

          // Verify the result structure
          expect(result).toMatchObject({
            id: machine,
            ownerId: null,
            organizationId: ctx.organization.id,
          });

          // Verify relationships are loaded but owner is null
          expect(result.model).toBeDefined();
          expect(result.location).toBeDefined();
          expect(result.owner).toBeNull();

          // Verify the database was actually updated
          const updatedMachine = await db.query.machines.findFirst({
            where: eq(schema.machines.id, machine),
          });
          expect(updatedMachine?.ownerId).toBeNull();
        });
      });

      test("should handle reassigning owner to different user", async ({
        workerDb,
      }) => {
        await withIsolatedTest(workerDb, async (db) => {
          const { machine, testUser1, testUser2, ctx } =
            await setupTestData(db);

          // First assign initial owner
          await db
            .update(schema.machines)
            .set({ ownerId: testUser1.id })
            .where(eq(schema.machines.id, machine));

          const caller = machineOwnerRouter.createCaller(ctx);

          // Reassign to different user
          const result = await caller.assignOwner({
            machineId: machine,
            ownerId: testUser2.id,
          });

          // Verify the result structure
          expect(result).toMatchObject({
            id: machine,
            ownerId: testUser2.id,
            organizationId: ctx.organization.id,
          });

          // Verify relationships are loaded with new owner
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

          // Verify old owner is no longer the owner
          expect(updatedMachine?.ownerId).not.toBe(testUser1.id);
        });
      });
    });

    describe("error scenarios", () => {
      test("should throw NOT_FOUND when machine does not exist", async ({
        workerDb,
      }) => {
        await withIsolatedTest(workerDb, async (db) => {
          const { testUser2, ctx } = await setupTestData(db);
          const caller = machineOwnerRouter.createCaller(ctx);

          await expect(
            caller.assignOwner({
              machineId: "nonexistent-machine",
              ownerId: testUser2.id,
            }),
          ).rejects.toThrow(
            new TRPCError({
              code: "NOT_FOUND",
              message: "Machine not found",
            }),
          );
        });
      });

      test("should throw NOT_FOUND when machine belongs to different organization", async ({
        workerDb,
      }) => {
        await withIsolatedTest(workerDb, async (db) => {
          const { testUser2, ctx } = await setupTestData(db);

          // Create a second organization
          const [org2] = await db
            .insert(schema.organizations)
            .values({
              id: generateTestId("org-2"),
              name: "Organization 2",
              subdomain: "org2",
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();

          // Create a location in the second organization
          const [location2] = await db
            .insert(schema.locations)
            .values({
              id: generateTestId("location-2"),
              name: "Location 2",
              organizationId: org2.id,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();

          // Create a model for the machine
          const [model2] = await db
            .insert(schema.models)
            .values({
              id: generateTestId("model-2"),
              name: "Test Model 2",
              manufacturer: "Test Manufacturer 2",
              year: 2024,
            })
            .returning();

          // Create a machine in the second organization
          const [machine2] = await db
            .insert(schema.machines)
            .values({
              id: generateTestId("machine-2"),
              name: "Machine 2",
              modelId: model2.id,
              locationId: location2.id,
              organizationId: org2.id,
              qrCodeId: generateTestId("qr-code-2"),
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();

          const caller = machineOwnerRouter.createCaller(ctx);

          await expect(
            caller.assignOwner({
              machineId: machine2.id, // Machine belongs to org2, but user is in org1
              ownerId: testUser2.id,
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
          const { machine, ctx } = await setupTestData(db);

          // Create a user that's not a member of the organization
          const [nonMemberUser] = await db
            .insert(schema.users)
            .values({
              id: "test-non-member-user",
              name: "Non Member User",
              email: "nonmember@example.com",
              image: null,
              emailVerified: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();

          const caller = machineOwnerRouter.createCaller(ctx);

          await expect(
            caller.assignOwner({
              machineId: machine,
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

    describe("input validation", () => {
      test("should accept valid machineId", async ({ workerDb }) => {
        await withIsolatedTest(workerDb, async (db) => {
          const { machine, testUser2, ctx } = await setupTestData(db);
          const caller = machineOwnerRouter.createCaller(ctx);

          // Should not throw for valid machineId
          await expect(
            caller.assignOwner({
              machineId: machine,
              ownerId: testUser2.id,
            }),
          ).resolves.toBeDefined();
        });
      });

      test("should accept optional ownerId", async ({ workerDb }) => {
        await withIsolatedTest(workerDb, async (db) => {
          const { machine, testUser2, ctx } = await setupTestData(db);

          // First assign an owner
          await db
            .update(schema.machines)
            .set({ ownerId: testUser2.id })
            .where(eq(schema.machines.id, machine));

          const caller = machineOwnerRouter.createCaller(ctx);

          // Should not throw for undefined ownerId (removes owner)
          await expect(
            caller.assignOwner({
              machineId: machine,
              // ownerId is undefined
            }),
          ).resolves.toBeDefined();
        });
      });

      test("should handle empty string ownerId as removal", async ({
        workerDb,
      }) => {
        await withIsolatedTest(workerDb, async (db) => {
          const { machine, testUser2, ctx } = await setupTestData(db);

          // First assign an owner
          await db
            .update(schema.machines)
            .set({ ownerId: testUser2.id })
            .where(eq(schema.machines.id, machine));

          const caller = machineOwnerRouter.createCaller(ctx);

          // Empty string should remove owner
          const result = await caller.assignOwner({
            machineId: machine,
            ownerId: "", // Empty string should be treated as removal
          });

          expect(result.ownerId).toBeNull();
        });
      });
    });

    describe("organizational scoping and security", () => {
      test("should only find machines within user's organization", async ({
        workerDb,
      }) => {
        await withIsolatedTest(workerDb, async (db) => {
          const { machine, testUser2, ctx } = await setupTestData(db);
          const caller = machineOwnerRouter.createCaller(ctx);

          // This should work - machine is in user's organization
          await expect(
            caller.assignOwner({
              machineId: machine,
              ownerId: testUser2.id,
            }),
          ).resolves.toBeDefined();
        });
      });

      test("should only validate membership within user's organization", async ({
        workerDb,
      }) => {
        await withIsolatedTest(workerDb, async (db) => {
          const { machine, testUser2, ctx } = await setupTestData(db);
          const caller = machineOwnerRouter.createCaller(ctx);

          // This should work - both machine and user are in same organization
          await expect(
            caller.assignOwner({
              machineId: machine,
              ownerId: testUser2.id,
            }),
          ).resolves.toBeDefined();
        });
      });

      test("should use correct organization context", async ({ workerDb }) => {
        await withIsolatedTest(workerDb, async (db) => {
          // Set up first organization (with our main test data)
          const {
            machine: machine1,
            testUser2: user1,
            organizationId: org1Id,
          } = await setupTestData(db);

          // Create a second organization with different users
          const org2Id = generateTestId("test-org-2");
          const [org2] = await db
            .insert(schema.organizations)
            .values({
              id: org2Id,
              name: "Test Organization 2",
              subdomain: "test2",
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();

          // Create a role in org2
          const [adminRole2] = await db
            .insert(schema.roles)
            .values({
              id: generateTestId("admin-role-2"),
              name: "Admin",
              organizationId: org2Id,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();

          // Create a user in org2
          const [user2] = await db
            .insert(schema.users)
            .values({
              id: generateTestId("user-2"),
              name: "User 2",
              email: "user2@example.com",
              image: "https://example.com/avatar.jpg",
              emailVerified: null,
            })
            .returning();

          // Create membership in org2
          await db.insert(schema.memberships).values({
            id: generateTestId("membership-org2"),
            userId: user2.id,
            organizationId: org2Id,
            roleId: adminRole2.id,
          });

          // Create location in org2
          const [location2] = await db
            .insert(schema.locations)
            .values({
              id: generateTestId("location-2"),
              name: "Location 2",
              organizationId: org2Id,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();

          // Create model for org2 machine
          const [model2] = await db
            .insert(schema.models)
            .values({
              id: generateTestId("model-2"),
              name: "Model 2",
              manufacturer: "Manufacturer 2",
              year: 2024,
            })
            .returning();

          // Create machine in org2
          const [machine2] = await db
            .insert(schema.machines)
            .values({
              id: generateTestId("machine-2"),
              name: "Machine 2",
              modelId: model2.id,
              locationId: location2.id,
              organizationId: org2Id,
              qrCodeId: generateTestId("qr-code-2"),
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();

          // Context for org1 user trying to access org1 machine (should work)
          const ctx1: TRPCContext = {
            db: db,
            user: {
              id: user1.id,
              email: "user1@example.com",
              name: "User 1",
              user_metadata: {},
              app_metadata: {
                organization_id: org1Id,
              },
            },
            organization: {
              id: org1Id,
              name: "Test Organization",
              subdomain: "test",
            },
            organizationId: org1Id,
            supabase: {} as any,
            headers: new Headers(),
            userPermissions: ["machine:edit", "machine:delete"],
            services: {} as any,
            logger: {
              error: vi.fn(),
              warn: vi.fn(),
              info: vi.fn(),
              debug: vi.fn(),
              trace: vi.fn(),
              child: vi.fn(() => ctx1.logger),
              withRequest: vi.fn(() => ctx1.logger),
              withUser: vi.fn(() => ctx1.logger),
              withOrganization: vi.fn(() => ctx1.logger),
              withContext: vi.fn(() => ctx1.logger),
            } as any,
          } as any;

          // Context for org1 user trying to access org2 machine (should fail)
          const caller = machineOwnerRouter.createCaller(ctx1);

          // Try to assign owner to machine in same organization (should work)
          await expect(
            caller.assignOwner({
              machineId: machine1.id,
              ownerId: user1.id,
            }),
          ).resolves.toBeDefined();

          // Try to assign owner to machine in different organization (should fail)
          await expect(
            caller.assignOwner({
              machineId: machine2.id, // Machine in org2
              ownerId: user1.id, // User in org1
            }),
          ).rejects.toThrow(
            new TRPCError({
              code: "NOT_FOUND",
              message: "Machine not found",
            }),
          );
        });
      });

      test("should enforce organizational boundaries", async ({ workerDb }) => {
        await withIsolatedTest(workerDb, async (db) => {
          const { machine, ctx } = await setupTestData(db);

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
            organizationId: org2.id,
            user: {
              ...ctx.user,
              app_metadata: {
                organization_id: org2.id,
              },
            },
          };

          const caller = machineOwnerRouter.createCaller(org2Ctx);

          await expect(
            caller.assignOwner({
              machineId: machine, // This machine belongs to org1
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

      test("should return only safe user data in owner relationship", async ({
        workerDb,
      }) => {
        await withIsolatedTest(workerDb, async (db) => {
          const { machine, testUser2, ctx } = await setupTestData(db);
          const caller = machineOwnerRouter.createCaller(ctx);

          const result = await caller.assignOwner({
            machineId: machine,
            ownerId: testUser2.id,
          });

          // Should only include id, name, and profilePicture (no email or other sensitive data)
          expect(result.owner).toEqual({
            id: testUser2.id,
            name: testUser2.name,
            profilePicture: null,
          });

          // Make sure no sensitive data is leaked
          expect(result.owner).not.toHaveProperty("email");
          expect(result.owner).not.toHaveProperty("emailVerified");
        });
      });
    });

    describe("relationship loading", () => {
      test("should load machine model relationship", async ({ workerDb }) => {
        await withIsolatedTest(workerDb, async (db) => {
          const { machine, testUser2, ctx } = await setupTestData(db);
          const caller = machineOwnerRouter.createCaller(ctx);

          const result = await caller.assignOwner({
            machineId: machine,
            ownerId: testUser2.id,
          });

          expect(result.model).toBeDefined();
          expect(result.model).toMatchObject({
            id: expect.any(String),
            name: expect.any(String),
            manufacturer: expect.any(String),
          });
          // Year can be null in seeded data
          expect(
            typeof result.model.year === "number" || result.model.year === null,
          ).toBe(true);
        });
      });

      test("should load machine location relationship", async ({
        workerDb,
      }) => {
        await withIsolatedTest(workerDb, async (db) => {
          const { machine, testUser2, ctx } = await setupTestData(db);
          const caller = machineOwnerRouter.createCaller(ctx);

          const result = await caller.assignOwner({
            machineId: machine,
            ownerId: testUser2.id,
          });

          expect(result.location).toBeDefined();
          expect(result.location).toMatchObject({
            id: expect.any(String),
            name: expect.any(String),
            street: expect.any(String),
            city: expect.any(String),
            state: expect.any(String),
            zip: expect.any(String),
          });
        });
      });

      test("should handle null owner relationship", async ({ workerDb }) => {
        await withIsolatedTest(workerDb, async (db) => {
          const { machine, ctx } = await setupTestData(db);
          const caller = machineOwnerRouter.createCaller(ctx);

          // Remove owner
          const result = await caller.assignOwner({
            machineId: machine,
            // ownerId omitted to remove owner
          });

          expect(result.owner).toBeNull();
          expect(result.model).toBeDefined();
          expect(result.location).toBeDefined();
        });
      });
    });

    describe("data integrity and relationships", () => {
      test("should maintain referential integrity", async ({ workerDb }) => {
        await withIsolatedTest(workerDb, async (db) => {
          const { machine, testUser2, ctx } = await setupTestData(db);
          const caller = machineOwnerRouter.createCaller(ctx);

          const result = await caller.assignOwner({
            machineId: machine,
            ownerId: testUser2.id,
          });

          // Verify all relationships exist and are consistent
          expect(result.model.id).toBeDefined();
          expect(result.location.id).toBeDefined();
          expect(result.location.organizationId).toBe(ctx.organizationId);

          // Verify the relationships in the database
          const machineInDb = await db.query.machines.findFirst({
            where: eq(schema.machines.id, machine),
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

      test("should preserve other machine fields during owner assignment", async ({
        workerDb,
      }) => {
        await withIsolatedTest(workerDb, async (db) => {
          const { machine, testUser2, ctx } = await setupTestData(db);

          // Get original machine data
          const originalMachine = await db.query.machines.findFirst({
            where: eq(schema.machines.id, machine),
          });

          const caller = machineOwnerRouter.createCaller(ctx);

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
        });
      });
    });
  });
});
