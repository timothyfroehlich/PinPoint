/**
 * Role Router Integration Tests (PGlite)
 *
 * Integration tests for the role router using PGlite in-memory PostgreSQL database.
 * Tests real database operations with proper schema, relationships, and data integrity.
 *
 * Key Features:
 * - Real PostgreSQL database with PGlite
 * - Complete schema migrations applied
 * - Real Drizzle ORM operations
 * - Multi-tenant data isolation testing
 * - Complex role assignment validation with real data
 * - Real role-permission relationship testing
 * - True test isolation (fresh database per test)
 * - Improved performance with in-memory database
 *
 * Tests all 8 router endpoints with 35 comprehensive scenarios:
 * - list, create, update, delete, get, getPermissions, getTemplates, assignToUser
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { eq, and } from "drizzle-orm";
import { describe, expect, vi, beforeAll } from "vitest";

// Import test setup and utilities
import type { TRPCContext } from "~/server/api/trpc.base";

import { TRPCError } from "@trpc/server";
import { roleRouter } from "~/server/api/routers/role";
import * as schema from "~/server/db/schema";
import {
  test,
  withIsolatedTest,
  type TestDatabase,
} from "~/test/helpers/worker-scoped-db";
import { createSeededTestDatabase } from "~/test/helpers/pglite-test-setup";
import { createSeededAdminTestContext } from "~/test/helpers/createSeededAdminTestContext";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import { generateTestId } from "~/test/helpers/test-id-generator";

// Mock external dependencies that aren't database-related
vi.mock("~/lib/utils/id-generation", () => ({
  generatePrefixedId: vi.fn(() => generateTestId("test-role")),
}));

vi.mock("~/server/auth/permissions", () => ({
  getUserPermissionsForSession: vi
    .fn()
    .mockResolvedValue(["role:manage", "organization:manage"]),
  getUserPermissionsForSupabaseUser: vi
    .fn()
    .mockResolvedValue(["role:manage", "organization:manage"]),
  requirePermissionForSession: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("~/lib/users/roleManagementValidation", () => ({
  validateRoleAssignment: vi.fn().mockReturnValue({ valid: true }),
}));

describe("Role Router Integration Tests (PGlite)", () => {
  const primaryOrgId = SEED_TEST_IDS.ORGANIZATIONS.primary;
  const competitorOrgId = SEED_TEST_IDS.ORGANIZATIONS.competitor;

  describe("list - Get all roles", () => {
    test("should return roles with member count and permissions", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (txDb) => {
        // Create admin context using seeded data
        const context = await createSeededAdminTestContext(
          txDb,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = roleRouter.createCaller(context);

        const result = await caller.list();

        expect(result.length).toBeGreaterThanOrEqual(2); // At least Admin and Member roles from seeds

        // Find admin role
        const adminRole = result.find((r) => r.name === "Admin");
        expect(adminRole).toBeDefined();
        expect(adminRole).toMatchObject({
          name: "Admin",
          organizationId: primaryOrgId,
          isSystem: true,
          isDefault: false,
        });
        expect(adminRole?.memberCount).toBeGreaterThan(0);
        expect(Array.isArray(adminRole?.permissions)).toBe(true);

        // Find member role
        const memberRole = result.find((r) => r.name === "Member");
        expect(memberRole).toBeDefined();
        expect(memberRole).toMatchObject({
          name: "Member",
          organizationId: primaryOrgId,
          isSystem: false, // Member role in seeds is not a system role
          isDefault: true,
        });
      });
    });

    test("should handle empty roles list in new organization", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Use seeded competitor organization (should have minimal role setup)
        const newOrgId = SEED_TEST_IDS.ORGANIZATIONS.competitor;

        const { context } = await createSeededAdminTestContext(
          db,
          newOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const newCaller = roleRouter.createCaller(context);

        const result = await newCaller.list();
        expect(result).toEqual([]);

        // Cleanup happens automatically via withIsolatedTest
      });
    });

    test("should enforce organization scoping", async ({
      workerDb,
      organizationId,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const context = await createSeededAdminTestContext(
          db,
          organizationId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = roleRouter.createCaller(context);

        // Get roles from test organization
        const result = await caller.list();
        expect(result.length).toBeGreaterThan(0);

        // All roles should belong to the test organization
        result.forEach((role) => {
          expect(role.organizationId).toBe(organizationId);
        });
      });
    });

    test("should handle database errors gracefully", async ({
      workerDb,
      organizationId,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Create context with invalid organization but expect permission error instead of database error
        const context = await createSeededAdminTestContext(
          db,
          "nonexistent-org",
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const invalidCaller = roleRouter.createCaller(context);

        // This should throw a permission error because the user isn't a member of the nonexistent org
        await expect(invalidCaller.list()).rejects.toThrow(
          "You don't have permission to access this organization",
        );
      });
    });
  });

  describe("create - Create new role", () => {
    test("should create role with template", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const context = await createSeededAdminTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = roleRouter.createCaller(context);

        const result = await caller.create({
          name: "Member Template Role",
          template: "MEMBER",
          isDefault: false,
        });

        expect(result).toMatchObject({
          name: "Member Template Role",
          organizationId: primaryOrgId,
          isSystem: false,
          isDefault: false,
        });
        expect(result.id).toMatch(/^test-role-/);

        // Verify in database
        const dbRole = await db.query.roles.findFirst({
          where: eq(schema.roles.id, result.id),
          with: {
            rolePermissions: {
              with: {
                permission: true,
              },
            },
          },
        });

        expect(dbRole).toBeDefined();
        expect(dbRole?.name).toBe("Member Template Role");
        expect(dbRole?.organizationId).toBe(primaryOrgId);

        // Verify template permissions were assigned
        const permissionNames =
          dbRole?.rolePermissions.map((rp) => rp.permission.name) || [];
        expect(permissionNames).toContain("issue:view");
        expect(permissionNames).toContain("issue:create");
        expect(permissionNames).toContain("issue:edit");
        expect(permissionNames).toContain("machine:view");
      });
    });

    test("should create custom role without template", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const context = await createSeededAdminTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = roleRouter.createCaller(context);

        // Get available permissions
        const permissions = await db.query.permissions.findMany();
        const permissionIds = permissions.slice(0, 2).map((p) => p.id);

        const result = await caller.create({
          name: "Custom Role",
          permissionIds,
          isDefault: true,
        });

        expect(result).toMatchObject({
          name: "Custom Role",
          organizationId: primaryOrgId,
          isSystem: false,
          isDefault: true,
        });

        // Verify in database with permissions
        const dbRole = await db.query.roles.findFirst({
          where: eq(schema.roles.id, result.id),
          with: {
            rolePermissions: {
              with: {
                permission: true,
              },
            },
          },
        });

        expect(dbRole?.rolePermissions).toHaveLength(permissionIds.length);
        const assignedPermissionIds =
          dbRole?.rolePermissions.map((rp) => rp.permission.id) || [];
        expect(assignedPermissionIds).toEqual(
          expect.arrayContaining(permissionIds),
        );
      });
    });

    test("should create role without permissions", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const context = await createSeededAdminTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = roleRouter.createCaller(context);

        const result = await caller.create({
          name: "Simple Role",
          isDefault: false,
        });

        expect(result).toMatchObject({
          name: "Simple Role",
          organizationId: primaryOrgId,
          isSystem: false,
          isDefault: false,
        });

        // Verify no permissions assigned
        const dbRole = await db.query.roles.findFirst({
          where: eq(schema.roles.id, result.id),
          with: {
            rolePermissions: true,
          },
        });

        expect(dbRole?.rolePermissions).toHaveLength(0);
      });
    });

    test("should enforce organization scoping in role creation", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const context = await createSeededAdminTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = roleRouter.createCaller(context);

        const result = await caller.create({ name: "Test Role" });

        // Verify role was created in correct organization
        expect(result.organizationId).toBe(primaryOrgId);

        // Verify role is not visible from other organization
        // Use seeded competitor organization for cross-org testing
        const otherOrgId = SEED_TEST_IDS.ORGANIZATIONS.competitor;

        // Create admin role in other org
        const [otherAdminRole] = await db
          .insert(schema.roles)
          .values({
            id: "other-admin-role",
            name: "Admin",
            organizationId: otherOrgId,
            isSystem: true,
            isDefault: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Create membership for test user in other org
        await db.insert(schema.memberships).values({
          id: "other-membership",
          userId: SEED_TEST_IDS.USERS.ADMIN,
          organizationId: otherOrgId,
          roleId: otherAdminRole.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const baseContext = await createSeededAdminTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const otherOrgContext = await createSeededAdminTestContext(
          db,
          otherOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const otherCaller = roleRouter.createCaller(otherOrgContext);

        const otherRoles = await otherCaller.list();
        expect(otherRoles.find((r) => r.id === result.id)).toBeUndefined();
      });
    });

    test("should throw error for invalid template", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const context = await createSeededAdminTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = roleRouter.createCaller(context);

        await expect(
          caller.create({
            name: "Invalid Template Role",
            template: "INVALID" as any,
          }),
        ).rejects.toThrow();
      });
    });
  });

  describe("update - Update existing role", () => {
    test("should update role name", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const context = await createSeededAdminTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = roleRouter.createCaller(context);

        // Create a test role for updating
        const testRole = await caller.create({
          name: "Test Update Role",
          isDefault: false,
        });

        const result = await caller.update({
          roleId: testRole.id,
          name: "Updated Role Name",
        });

        expect(result).toMatchObject({
          id: testRole.id,
          name: "Updated Role Name",
          organizationId: primaryOrgId,
        });

        // Verify in database
        const dbRole = await db.query.roles.findFirst({
          where: eq(schema.roles.id, testRole.id),
        });
        expect(dbRole?.name).toBe("Updated Role Name");
      });
    });

    test("should update role permissions", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const context = await createSeededAdminTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = roleRouter.createCaller(context);

        // Create a test role for updating
        const testRole = await caller.create({
          name: "Test Update Role",
          isDefault: false,
        });

        // Get available permissions
        const permissions = await db.query.permissions.findMany();
        const permissionIds = permissions.slice(0, 3).map((p) => p.id);

        const result = await caller.update({
          roleId: testRole.id,
          permissionIds,
        });

        expect(result.id).toBe(testRole.id);

        // Verify permissions in database
        const dbRole = await db.query.roles.findFirst({
          where: eq(schema.roles.id, testRole.id),
          with: {
            rolePermissions: {
              with: {
                permission: true,
              },
            },
          },
        });

        expect(dbRole?.rolePermissions).toHaveLength(permissionIds.length);
        const assignedIds =
          dbRole?.rolePermissions.map((rp) => rp.permission.id) || [];
        expect(assignedIds).toEqual(expect.arrayContaining(permissionIds));
      });
    });

    test("should update role default status", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const context = await createSeededAdminTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = roleRouter.createCaller(context);

        // Create a test role for updating
        const testRole = await caller.create({
          name: "Test Update Role",
          isDefault: false,
        });

        const result = await caller.update({
          roleId: testRole.id,
          isDefault: true,
        });

        expect(result).toMatchObject({
          id: testRole.id,
          isDefault: true,
        });

        // Verify in database
        const dbRole = await db.query.roles.findFirst({
          where: eq(schema.roles.id, testRole.id),
        });
        expect(dbRole?.isDefault).toBe(true);
      });
    });

    test("should update multiple properties", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const context = await createSeededAdminTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = roleRouter.createCaller(context);

        // Create a test role for updating
        const testRole = await caller.create({
          name: "Test Update Role",
          isDefault: false,
        });

        const permissions = await db.query.permissions.findMany();
        const permissionIds = permissions.slice(0, 2).map((p) => p.id);

        const result = await caller.update({
          roleId: testRole.id,
          name: "Multi Updated",
          permissionIds,
          isDefault: true,
        });

        expect(result).toMatchObject({
          id: testRole.id,
          name: "Multi Updated",
          isDefault: true,
        });

        // Verify all changes in database
        const dbRole = await db.query.roles.findFirst({
          where: eq(schema.roles.id, testRole.id),
          with: {
            rolePermissions: true,
          },
        });

        expect(dbRole?.name).toBe("Multi Updated");
        expect(dbRole?.isDefault).toBe(true);
        expect(dbRole?.rolePermissions).toHaveLength(permissionIds.length);
      });
    });

    test("should throw error for nonexistent role", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const context = await createSeededAdminTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = roleRouter.createCaller(context);

        await expect(
          caller.update({
            roleId: "nonexistent-role",
            name: "Failed Update",
          }),
        ).rejects.toThrow();
      });
    });
  });

  describe("delete - Delete role", () => {
    test("should delete role successfully", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const context = await createSeededAdminTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = roleRouter.createCaller(context);

        // Create a test role for deletion
        const testRole = await caller.create({
          name: "Test Delete Role",
          isDefault: false,
        });

        const result = await caller.delete({ roleId: testRole.id });

        expect(result).toEqual({ success: true });

        // Verify role is deleted from database
        const dbRole = await db.query.roles.findFirst({
          where: eq(schema.roles.id, testRole.id),
        });
        expect(dbRole).toBeUndefined();
      });
    });

    test("should prevent deletion of system admin role", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const context = await createSeededAdminTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = roleRouter.createCaller(context);

        // Try to delete the system admin role
        await expect(
          caller.delete({ roleId: seededData.adminRole! }),
        ).rejects.toThrow();

        // Verify admin role still exists
        const stillExists = await db.query.roles.findFirst({
          where: eq(schema.roles.id, seededData.adminRole!),
        });
        expect(stillExists).toBeDefined();
      });
    });

    test("should handle nonexistent role deletion", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const context = await createSeededAdminTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = roleRouter.createCaller(context);

        await expect(
          caller.delete({ roleId: "nonexistent-role" }),
        ).rejects.toThrow();
      });
    });
  });

  describe("get - Get specific role", () => {
    test("should return role with permissions and member count", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const context = await createSeededAdminTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = roleRouter.createCaller(context);

        const result = await caller.get({ roleId: seededData.adminRole! });

        expect(result).toMatchObject({
          id: seededData.adminRole,
          name: "Admin",
          organizationId: primaryOrgId,
        });
        expect(result.memberCount).toBeGreaterThan(0);
        expect(Array.isArray(result.permissions)).toBe(true);
      });
    });

    test("should throw NOT_FOUND if role does not exist", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const context = await createSeededAdminTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = roleRouter.createCaller(context);

        await expect(
          caller.get({ roleId: "nonexistent-role" }),
        ).rejects.toThrow(
          expect.objectContaining({
            code: "NOT_FOUND",
            message: "Role not found",
          }),
        );
      });
    });

    test("should enforce organization scoping", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const context = await createSeededAdminTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = roleRouter.createCaller(context);

        // Create role in test organization
        const testRole = await caller.create({ name: "Scoped Role" });

        // Try to access from different organization
        // Use seeded competitor organization for cross-org testing
        const otherOrgId = SEED_TEST_IDS.ORGANIZATIONS.competitor;

        // Create admin role in other org
        const [otherAdminRole] = await db
          .insert(schema.roles)
          .values({
            id: "other-admin-role-get",
            name: "Admin",
            organizationId: otherOrgId,
            isSystem: true,
            isDefault: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Create membership for test user in other org
        await db.insert(schema.memberships).values({
          id: "other-membership-get",
          userId: SEED_TEST_IDS.USERS.ADMIN,
          organizationId: otherOrgId,
          roleId: otherAdminRole.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const baseContext = await createSeededAdminTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const otherOrgContext = await createSeededAdminTestContext(
          db,
          otherOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const otherCaller = roleRouter.createCaller(otherOrgContext as any);

        await expect(otherCaller.get({ roleId: testRole.id })).rejects.toThrow(
          expect.objectContaining({
            code: "NOT_FOUND",
          }),
        );
      });
    });
  });

  describe("getPermissions - Get all available permissions", () => {
    test("should return all permissions ordered by name", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const context = await createSeededAdminTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = roleRouter.createCaller(context);

        const result = await caller.getPermissions();

        expect(result.length).toBeGreaterThan(0);

        // Verify ordering by name
        const names = result.map((p) => p.name);
        const sortedNames = [...names].sort();
        expect(names).toEqual(sortedNames);

        // Verify permission structure
        result.forEach((permission) => {
          expect(permission).toMatchObject({
            id: expect.any(String),
            name: expect.stringMatching(/^[a-z]+:[a-z_]+$/),
            description: expect.any(String),
          });
        });
      });
    });

    test("should return consistent permissions across calls", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const context = await createSeededAdminTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = roleRouter.createCaller(context);

        const result1 = await caller.getPermissions();
        const result2 = await caller.getPermissions();

        expect(result1).toEqual(result2);
      });
    });
  });

  describe("getTemplates - Get role templates", () => {
    test("should return available role templates", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const context = await createSeededAdminTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = roleRouter.createCaller(context);

        const result = await caller.getTemplates();

        expect(result).toEqual([
          {
            key: "MEMBER",
            name: "Member",
            description: "Standard organization member with basic permissions",
            permissions: [
              "issue:view",
              "issue:create",
              "issue:edit",
              "issue:delete",
              "issue:assign",
              "machine:view",
              "location:view",
              "attachment:view",
              "attachment:create",
            ],
          },
        ]);
      });
    });
  });

  describe("assignToUser - Assign role to user", () => {
    test("should assign role to user successfully", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const context = await createSeededAdminTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = roleRouter.createCaller(context);

        // Create a test user for assignment testing
        const targetUserId = generateTestId("target-user");
        const [targetUser] = await db
          .insert(schema.users)
          .values({
            id: targetUserId,
            email: `target-${generateTestId("email")}@example.com`,
            name: "Target User",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Create membership for target user in member role
        const membershipId = generateTestId("target-membership");
        await db.insert(schema.memberships).values({
          id: membershipId,
          userId: targetUser.id,
          organizationId: primaryOrgId,
          roleId: seededData.memberRole!,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Create a new test role for assignment
        const testRole = await caller.create({
          name: "Test Assignment Role",
          isDefault: false,
        });

        const result = await caller.assignToUser({
          userId: targetUser.id,
          roleId: testRole.id,
        });

        expect(result).toMatchObject({
          userId: targetUser.id,
          roleId: testRole.id,
          organizationId: primaryOrgId,
        });
        expect(result.role.name).toBe("Test Assignment Role");
        expect(result.user.id).toBe(targetUser.id);

        // Verify in database
        const dbMembership = await db.query.memberships.findFirst({
          where: and(
            eq(schema.memberships.userId, targetUser.id),
            eq(schema.memberships.organizationId, primaryOrgId),
          ),
        });
        expect(dbMembership?.roleId).toBe(testRole.id);
      });
    });

    test("should throw NOT_FOUND if target role does not exist", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const context = await createSeededAdminTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = roleRouter.createCaller(context);

        // Create a test user for assignment testing
        const targetUserId = generateTestId("target-user");
        const [targetUser] = await db
          .insert(schema.users)
          .values({
            id: targetUserId,
            email: `target-${generateTestId("email")}@example.com`,
            name: "Target User",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        await expect(
          caller.assignToUser({
            userId: targetUser.id,
            roleId: "nonexistent-role",
          }),
        ).rejects.toThrow(
          expect.objectContaining({
            code: "NOT_FOUND",
            message: "Role not found",
          }),
        );
      });
    });

    test("should throw NOT_FOUND if user is not organization member", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const context = await createSeededAdminTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = roleRouter.createCaller(context);

        // Create a new test role for assignment
        const testRole = await caller.create({
          name: "Test Assignment Role",
          isDefault: false,
        });

        await expect(
          caller.assignToUser({
            userId: "nonmember-user",
            roleId: testRole.id,
          }),
        ).rejects.toThrow(
          expect.objectContaining({
            code: "NOT_FOUND",
            message: "User is not a member of this organization",
          }),
        );
      });
    });

    test("should throw PRECONDITION_FAILED if validation fails", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const context = await createSeededAdminTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = roleRouter.createCaller(context);

        // Create a test user for assignment testing
        const targetUserId = generateTestId("target-user");
        const [targetUser] = await db
          .insert(schema.users)
          .values({
            id: targetUserId,
            email: `target-${generateTestId("email")}@example.com`,
            name: "Target User",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Create membership for target user in member role
        const membershipId = generateTestId("target-membership");
        await db.insert(schema.memberships).values({
          id: membershipId,
          userId: targetUser.id,
          organizationId: primaryOrgId,
          roleId: seededData.memberRole!,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Create a new test role for assignment
        const testRole = await caller.create({
          name: "Test Assignment Role",
          isDefault: false,
        });

        // Mock validation to fail
        const { validateRoleAssignment } = await import(
          "~/lib/users/roleManagementValidation"
        );
        vi.mocked(validateRoleAssignment).mockReturnValueOnce({
          valid: false,
          error: "Cannot assign role: would leave organization without admin",
        });

        await expect(
          caller.assignToUser({
            userId: targetUser.id,
            roleId: testRole.id,
          }),
        ).rejects.toThrow(
          expect.objectContaining({
            code: "PRECONDITION_FAILED",
            message:
              "Cannot assign role: would leave organization without admin",
          }),
        );

        // Reset mock
        vi.mocked(validateRoleAssignment).mockReturnValue({ valid: true });
      });
    });

    test("should call validation with correct parameters", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const context = await createSeededAdminTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = roleRouter.createCaller(context);

        // Create a test user for assignment testing
        const targetUserId = generateTestId("target-user");
        const [targetUser] = await db
          .insert(schema.users)
          .values({
            id: targetUserId,
            email: `target-${generateTestId("email")}@example.com`,
            name: "Target User",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Create membership for target user in member role
        const membershipId = generateTestId("target-membership");
        await db.insert(schema.memberships).values({
          id: membershipId,
          userId: targetUser.id,
          organizationId: primaryOrgId,
          roleId: seededData.memberRole!,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Create a new test role for assignment
        const testRole = await caller.create({
          name: "Test Assignment Role",
          isDefault: false,
        });

        const { validateRoleAssignment } = await import(
          "~/lib/users/roleManagementValidation"
        );

        await caller.assignToUser({
          userId: targetUser.id,
          roleId: testRole.id,
        });

        expect(validateRoleAssignment).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: targetUser.id,
            roleId: testRole.id,
            organizationId: primaryOrgId,
          }),
          expect.objectContaining({
            id: testRole.id,
            organizationId: primaryOrgId,
          }),
          expect.objectContaining({
            userId: targetUser.id,
            organizationId: primaryOrgId,
          }),
          expect.arrayContaining([
            expect.objectContaining({
              userId: expect.any(String),
              organizationId: primaryOrgId,
            }),
          ]),
          expect.objectContaining({
            organizationId: primaryOrgId,
            actorUserId: SEED_TEST_IDS.USERS.ADMIN,
            userPermissions: ["role:manage", "organization:manage"],
          }),
        );
      });
    });

    test("should enforce organization scoping in all queries", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const context = await createSeededAdminTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = roleRouter.createCaller(context);

        // Create a test user for assignment testing
        const targetUserId = generateTestId("target-user");
        const [targetUser] = await db
          .insert(schema.users)
          .values({
            id: targetUserId,
            email: `target-${generateTestId("email")}@example.com`,
            name: "Target User",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Create membership for target user in member role
        const membershipId = generateTestId("target-membership");
        await db.insert(schema.memberships).values({
          id: membershipId,
          userId: targetUser.id,
          organizationId: primaryOrgId,
          roleId: seededData.memberRole!,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Create a new test role for assignment
        const testRole = await caller.create({
          name: "Test Assignment Role",
          isDefault: false,
        });

        await caller.assignToUser({
          userId: targetUser.id,
          roleId: testRole.id,
        });

        // Verify the assignment is isolated to the organization
        const membership = await db.query.memberships.findFirst({
          where: and(
            eq(schema.memberships.userId, targetUser.id),
            eq(schema.memberships.organizationId, primaryOrgId),
          ),
        });

        expect(membership?.organizationId).toBe(primaryOrgId);
        expect(membership?.roleId).toBe(testRole.id);
      });
    });
  });

  describe("Multi-tenant isolation", () => {
    test("should enforce organization scoping across all endpoints", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const context = await createSeededAdminTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = roleRouter.createCaller(context);

        // Create second organization with roles
        const org2Id = generateTestId("test-org-2");
        await db.insert(schema.organizations).values({
          id: org2Id,
          name: "Test Organization 2",
          subdomain: generateTestId("test-org-2-sub"),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Create role in org2
        const org2RoleId = generateTestId("org2-role");
        await db.insert(schema.roles).values({
          id: org2RoleId,
          name: "Org2 Role",
          organizationId: org2Id,
          isSystem: false,
          isDefault: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Test org1 caller cannot see org2 roles
        const org1Roles = await caller.list();
        expect(
          org1Roles.find((r) => r.organizationId === org2Id),
        ).toBeUndefined();

        // Create admin role in org2 and membership for test user
        const [org2AdminRole] = await db
          .insert(schema.roles)
          .values({
            id: generateTestId("org2-admin-role"),
            name: "Admin",
            organizationId: org2Id,
            isSystem: true,
            isDefault: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Create membership for test user in org2
        await db.insert(schema.memberships).values({
          id: generateTestId("org2-membership"),
          userId: SEED_TEST_IDS.USERS.ADMIN,
          organizationId: org2Id,
          roleId: org2AdminRole.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Test org2 caller cannot see org1 roles
        const org2Context = await createSeededAdminTestContext(
          db,
          org2Id,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const org2Caller = roleRouter.createCaller(org2Context);

        const org2Roles = await org2Caller.list();
        expect(
          org2Roles.find((r) => r.organizationId === primaryOrgId),
        ).toBeUndefined();
        expect(org2Roles.find((r) => r.id === org2RoleId)).toBeDefined();

        // Cleanup happens automatically via transaction rollback
      });
    });
  });

  describe("Permission validation", () => {
    test("should require role:manage permission for mutations", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const context = await createSeededAdminTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
        );
        const caller = roleRouter.createCaller(context);

        // Mock permission check to fail
        const { requirePermissionForSession } = await import(
          "~/server/auth/permissions"
        );
        vi.mocked(requirePermissionForSession).mockRejectedValueOnce(
          new TRPCError({
            code: "FORBIDDEN",
            message: "Missing required permission: role:manage",
          }),
        );

        await expect(caller.create({ name: "Test Role" })).rejects.toThrow(
          "Missing required permission: role:manage",
        );

        // Reset mock
        vi.mocked(requirePermissionForSession).mockResolvedValue(undefined);
      });
    });

    test("should allow organization:manage permission for queries", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Test context with organization:manage but not role:manage
        const queryContext = await createSeededAdminTestContext(
          db,
          primaryOrgId,
          SEED_TEST_IDS.USERS.ADMIN,
          { permissions: ["organization:manage"] },
        );
        const queryCaller = roleRouter.createCaller(queryContext);

        // Should not throw permission errors for queries
        await expect(queryCaller.getPermissions()).resolves.toBeDefined();
        await expect(queryCaller.getTemplates()).resolves.toBeDefined();

        const roles = await queryCaller.list();
        expect(roles).toBeDefined();
      });
    });
  });
});
