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

/* eslint-disable @typescript-eslint/no-deprecated */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable import/order */

import { eq, and } from "drizzle-orm";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";

// Import test setup and utilities
import type { TRPCContext } from "~/server/api/trpc.base";
import type { ExtendedPrismaClient } from "~/server/db";

import { TRPCError } from "@trpc/server";
import { roleRouter } from "~/server/api/routers/role";
import * as schema from "~/server/db/schema";
import {
  createSeededTestDatabase,
  getSeededTestData,
  withTransaction,
  cleanupTestDatabase,
  type TestDatabase,
} from "~/test/helpers/pglite-test-setup";

// Mock external dependencies that aren't database-related
vi.mock("~/lib/utils/id-generation", () => ({
  generatePrefixedId: vi.fn(
    () => `test-role-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  ),
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
  let sharedDb: TestDatabase;
  let sharedTestData: {
    organization: string;
    location?: string;
    machine?: string;
    model?: string;
    status?: string;
    priority?: string;
    issue?: string;
    adminRole?: string;
    memberRole?: string;
    user?: string;
  };

  // Suite-level database setup for performance
  beforeAll(async () => {
    // Create PGlite database with real schema and seed data once
    const setup = await createSeededTestDatabase();
    sharedDb = setup.db;

    // Query actual seeded IDs once
    sharedTestData = await getSeededTestData(sharedDb, setup.organizationId);
  });

  afterAll(async () => {
    // Clean up the shared database
    await cleanupTestDatabase(sharedDb);
  });

  // Helper to create context for each test
  function createTestContext(
    db: TestDatabase,
    testData: typeof sharedTestData,
  ): TRPCContext {
    // Create comprehensive mock Prisma client for tRPC middleware compatibility
    // The DrizzleRoleService will handle all role operations natively, but tRPC middleware still needs Prisma
    const mockPrismaClient = {
      membership: {
        findFirst: vi.fn().mockImplementation(async ({ where }) => {
          // Return membership data from the actual database via Drizzle
          if (where?.userId && where?.organizationId) {
            const membership = await db.query.memberships.findFirst({
              where: and(
                eq(schema.memberships.userId, where.userId),
                eq(schema.memberships.organizationId, where.organizationId),
              ),
              with: {
                role: {
                  with: {
                    rolePermissions: {
                      with: {
                        permission: true,
                      },
                    },
                  },
                },
              },
            });

            if (membership) {
              // Transform to Prisma-like structure for tRPC middleware
              return {
                ...membership,
                role: {
                  ...membership.role,
                  permissions: membership.role.rolePermissions.map(
                    (rp) => rp.permission,
                  ),
                },
              };
            }
          }
          return null;
        }),
        findMany: vi.fn().mockImplementation(async ({ where }) => {
          // Return memberships for a role to support delete validation
          if (where?.roleId) {
            return await db.query.memberships.findMany({
              where: eq(schema.memberships.roleId, where.roleId),
            });
          }
          return [];
        }),
      },
    } as unknown as ExtendedPrismaClient;

    // Create test context with real database
    return {
      user: {
        id: testData.user || "test-user-admin",
        email: "admin@dev.local",
        user_metadata: { name: "Dev Admin" },
        app_metadata: { organization_id: testData.organization, role: "Admin" },
      },
      organization: {
        id: testData.organization,
        name: "Test Organization",
        subdomain: "test-org",
      },
      db: mockPrismaClient,
      drizzle: db,
      supabase: {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      } as any,
      services: {
        createPinballMapService: vi.fn(),
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
        child: vi.fn(() => ({}) as any),
        withRequest: vi.fn(() => ({}) as any),
        withUser: vi.fn(() => ({}) as any),
        withOrganization: vi.fn(() => ({}) as any),
        withContext: vi.fn(() => ({}) as any),
      },
      userPermissions: ["role:manage", "organization:manage"],
    } as any;
  }

  describe("list - Get all roles", () => {
    it("should return roles with member count and permissions", async () => {
      await withTransaction(sharedDb, async (db) => {
        const context = createTestContext(db, sharedTestData);
        const caller = roleRouter.createCaller(context);

        const result = await caller.list();

        expect(result.length).toBeGreaterThanOrEqual(2); // At least Admin and Member roles from seeds

        // Find admin role
        const adminRole = result.find((r) => r.name === "Admin");
        expect(adminRole).toBeDefined();
        expect(adminRole).toMatchObject({
          name: "Admin",
          organizationId: sharedTestData.organization,
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
          organizationId: sharedTestData.organization,
          isSystem: false, // Member role in seeds is not a system role
          isDefault: true,
        });
      });
    });

    it("should handle empty roles list in new organization", async () => {
      await withTransaction(sharedDb, async (db) => {
        // Create a new organization with no roles
        const newOrgId = `empty-org-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        await db.insert(schema.organizations).values({
          id: newOrgId,
          name: "Empty Organization",
          subdomain: `empty-org-${Date.now()}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Create a membership for the test user in the new organization
        const membershipId = `test-membership-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        await db.insert(schema.memberships).values({
          id: membershipId,
          userId: sharedTestData.user || "test-user-admin",
          organizationId: newOrgId,
          roleId: sharedTestData.adminRole!, // Use admin role from test data
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const newContext = {
          ...createTestContext(db, sharedTestData),
          organization: {
            id: newOrgId,
            name: "Empty Organization",
            subdomain: `empty-org-${Date.now()}`,
          },
        };
        const newCaller = roleRouter.createCaller(newContext as any);

        const result = await newCaller.list();
        expect(result).toEqual([]);

        // Cleanup happens automatically via transaction rollback
      });
    });

    it("should enforce organization scoping", async () => {
      await withTransaction(sharedDb, async (db) => {
        const context = createTestContext(db, sharedTestData);
        const caller = roleRouter.createCaller(context);

        // Get roles from test organization
        const result = await caller.list();
        expect(result.length).toBeGreaterThan(0);

        // All roles should belong to the test organization
        result.forEach((role) => {
          expect(role.organizationId).toBe(sharedTestData.organization);
        });
      });
    });

    it("should handle database errors gracefully", async () => {
      await withTransaction(sharedDb, async (db) => {
        // Create context with invalid organization but expect permission error instead of database error
        const invalidContext = {
          ...createTestContext(db, sharedTestData),
          organization: {
            id: "nonexistent-org",
            name: "Invalid",
            subdomain: "invalid",
          },
        };
        const invalidCaller = roleRouter.createCaller(invalidContext as any);

        // This should throw a permission error because the user isn't a member of the nonexistent org
        await expect(invalidCaller.list()).rejects.toThrow(
          "You don't have permission to access this organization",
        );
      });
    });
  });

  describe("create - Create new role", () => {
    it("should create role with template", async () => {
      await withTransaction(sharedDb, async (db) => {
        const context = createTestContext(db, sharedTestData);
        const caller = roleRouter.createCaller(context);

        const result = await caller.create({
          name: "Member Template Role",
          template: "MEMBER",
          isDefault: false,
        });

        expect(result).toMatchObject({
          name: "Member Template Role",
          organizationId: sharedTestData.organization,
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
        expect(dbRole?.organizationId).toBe(sharedTestData.organization);

        // Verify template permissions were assigned
        const permissionNames =
          dbRole?.rolePermissions.map((rp) => rp.permission.name) || [];
        expect(permissionNames).toContain("issue:view");
        expect(permissionNames).toContain("issue:create");
        expect(permissionNames).toContain("issue:edit");
        expect(permissionNames).toContain("machine:view");
      });
    });

    it("should create custom role without template", async () => {
      await withTransaction(sharedDb, async (db) => {
        const context = createTestContext(db, sharedTestData);
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
          organizationId: sharedTestData.organization,
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

    it("should create role without permissions", async () => {
      await withTransaction(sharedDb, async (db) => {
        const context = createTestContext(db, sharedTestData);
        const caller = roleRouter.createCaller(context);

        const result = await caller.create({
          name: "Simple Role",
          isDefault: false,
        });

        expect(result).toMatchObject({
          name: "Simple Role",
          organizationId: sharedTestData.organization,
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

    it("should enforce organization scoping in role creation", async () => {
      await withTransaction(sharedDb, async (db) => {
        const context = createTestContext(db, sharedTestData);
        const caller = roleRouter.createCaller(context);

        const result = await caller.create({ name: "Test Role" });

        // Verify role was created in correct organization
        expect(result.organizationId).toBe(sharedTestData.organization);

        // Verify role is not visible from other organization
        // Create other organization and membership for the user
        const otherOrgId = "other-org-test";
        await db.insert(schema.organizations).values({
          id: otherOrgId,
          name: "Other Org",
          subdomain: "other",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

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
          userId: sharedTestData.user || "test-user-admin",
          organizationId: otherOrgId,
          roleId: otherAdminRole.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const otherOrgContext = {
          ...createTestContext(db, sharedTestData),
          organization: {
            id: otherOrgId,
            name: "Other Org",
            subdomain: "other",
          },
        };
        const otherCaller = roleRouter.createCaller(otherOrgContext as any);

        const otherRoles = await otherCaller.list();
        expect(otherRoles.find((r) => r.id === result.id)).toBeUndefined();
      });
    });

    it("should throw error for invalid template", async () => {
      await withTransaction(sharedDb, async (db) => {
        const context = createTestContext(db, sharedTestData);
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
    it("should update role name", async () => {
      await withTransaction(sharedDb, async (db) => {
        const context = createTestContext(db, sharedTestData);
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
          organizationId: sharedTestData.organization,
        });

        // Verify in database
        const dbRole = await db.query.roles.findFirst({
          where: eq(schema.roles.id, testRole.id),
        });
        expect(dbRole?.name).toBe("Updated Role Name");
      });
    });

    it("should update role permissions", async () => {
      await withTransaction(sharedDb, async (db) => {
        const context = createTestContext(db, sharedTestData);
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

    it("should update role default status", async () => {
      await withTransaction(sharedDb, async (db) => {
        const context = createTestContext(db, sharedTestData);
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

    it("should update multiple properties", async () => {
      await withTransaction(sharedDb, async (db) => {
        const context = createTestContext(db, sharedTestData);
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

    it("should throw error for nonexistent role", async () => {
      await withTransaction(sharedDb, async (db) => {
        const context = createTestContext(db, sharedTestData);
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
    it("should delete role successfully", async () => {
      await withTransaction(sharedDb, async (db) => {
        const context = createTestContext(db, sharedTestData);
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

    it("should prevent deletion of system admin role", async () => {
      await withTransaction(sharedDb, async (db) => {
        const context = createTestContext(db, sharedTestData);
        const caller = roleRouter.createCaller(context);

        // Try to delete the system admin role
        await expect(
          caller.delete({ roleId: sharedTestData.adminRole! }),
        ).rejects.toThrow();

        // Verify admin role still exists
        const stillExists = await db.query.roles.findFirst({
          where: eq(schema.roles.id, sharedTestData.adminRole!),
        });
        expect(stillExists).toBeDefined();
      });
    });

    it("should handle nonexistent role deletion", async () => {
      await withTransaction(sharedDb, async (db) => {
        const context = createTestContext(db, sharedTestData);
        const caller = roleRouter.createCaller(context);

        await expect(
          caller.delete({ roleId: "nonexistent-role" }),
        ).rejects.toThrow();
      });
    });
  });

  describe("get - Get specific role", () => {
    it("should return role with permissions and member count", async () => {
      await withTransaction(sharedDb, async (db) => {
        const context = createTestContext(db, sharedTestData);
        const caller = roleRouter.createCaller(context);

        const result = await caller.get({ roleId: sharedTestData.adminRole! });

        expect(result).toMatchObject({
          id: sharedTestData.adminRole,
          name: "Admin",
          organizationId: sharedTestData.organization,
        });
        expect(result.memberCount).toBeGreaterThan(0);
        expect(Array.isArray(result.permissions)).toBe(true);
      });
    });

    it("should throw NOT_FOUND if role does not exist", async () => {
      await withTransaction(sharedDb, async (db) => {
        const context = createTestContext(db, sharedTestData);
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

    it("should enforce organization scoping", async () => {
      await withTransaction(sharedDb, async (db) => {
        const context = createTestContext(db, sharedTestData);
        const caller = roleRouter.createCaller(context);

        // Create role in test organization
        const testRole = await caller.create({ name: "Scoped Role" });

        // Try to access from different organization
        // Create other organization and membership for the user
        const otherOrgId = "other-org-get-test";
        await db.insert(schema.organizations).values({
          id: otherOrgId,
          name: "Other Org",
          subdomain: "other",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

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
          userId: sharedTestData.user || "test-user-admin",
          organizationId: otherOrgId,
          roleId: otherAdminRole.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const otherOrgContext = {
          ...createTestContext(db, sharedTestData),
          organization: {
            id: otherOrgId,
            name: "Other Org",
            subdomain: "other",
          },
        };
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
    it("should return all permissions ordered by name", async () => {
      await withTransaction(sharedDb, async (db) => {
        const context = createTestContext(db, sharedTestData);
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

    it("should return consistent permissions across calls", async () => {
      await withTransaction(sharedDb, async (db) => {
        const context = createTestContext(db, sharedTestData);
        const caller = roleRouter.createCaller(context);

        const result1 = await caller.getPermissions();
        const result2 = await caller.getPermissions();

        expect(result1).toEqual(result2);
      });
    });
  });

  describe("getTemplates - Get role templates", () => {
    it("should return available role templates", async () => {
      await withTransaction(sharedDb, async (db) => {
        const context = createTestContext(db, sharedTestData);
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
    it("should assign role to user successfully", async () => {
      await withTransaction(sharedDb, async (db) => {
        const context = createTestContext(db, sharedTestData);
        const caller = roleRouter.createCaller(context);

        // Create a test user for assignment testing
        const targetUserId = `target-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const [targetUser] = await db
          .insert(schema.users)
          .values({
            id: targetUserId,
            email: `target-${Date.now()}@example.com`,
            name: "Target User",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Create membership for target user in member role
        const membershipId = `target-membership-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        await db.insert(schema.memberships).values({
          id: membershipId,
          userId: targetUser.id,
          organizationId: sharedTestData.organization,
          roleId: sharedTestData.memberRole!,
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
          organizationId: sharedTestData.organization,
        });
        expect(result.role.name).toBe("Test Assignment Role");
        expect(result.user.id).toBe(targetUser.id);

        // Verify in database
        const dbMembership = await db.query.memberships.findFirst({
          where: and(
            eq(schema.memberships.userId, targetUser.id),
            eq(schema.memberships.organizationId, sharedTestData.organization),
          ),
        });
        expect(dbMembership?.roleId).toBe(testRole.id);
      });
    });

    it("should throw NOT_FOUND if target role does not exist", async () => {
      await withTransaction(sharedDb, async (db) => {
        const context = createTestContext(db, sharedTestData);
        const caller = roleRouter.createCaller(context);

        // Create a test user for assignment testing
        const targetUserId = `target-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const [targetUser] = await db
          .insert(schema.users)
          .values({
            id: targetUserId,
            email: `target-${Date.now()}@example.com`,
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

    it("should throw NOT_FOUND if user is not organization member", async () => {
      await withTransaction(sharedDb, async (db) => {
        const context = createTestContext(db, sharedTestData);
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

    it("should throw PRECONDITION_FAILED if validation fails", async () => {
      await withTransaction(sharedDb, async (db) => {
        const context = createTestContext(db, sharedTestData);
        const caller = roleRouter.createCaller(context);

        // Create a test user for assignment testing
        const targetUserId = `target-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const [targetUser] = await db
          .insert(schema.users)
          .values({
            id: targetUserId,
            email: `target-${Date.now()}@example.com`,
            name: "Target User",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Create membership for target user in member role
        const membershipId = `target-membership-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        await db.insert(schema.memberships).values({
          id: membershipId,
          userId: targetUser.id,
          organizationId: sharedTestData.organization,
          roleId: sharedTestData.memberRole!,
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

    it("should call validation with correct parameters", async () => {
      await withTransaction(sharedDb, async (db) => {
        const context = createTestContext(db, sharedTestData);
        const caller = roleRouter.createCaller(context);

        // Create a test user for assignment testing
        const targetUserId = `target-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const [targetUser] = await db
          .insert(schema.users)
          .values({
            id: targetUserId,
            email: `target-${Date.now()}@example.com`,
            name: "Target User",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Create membership for target user in member role
        const membershipId = `target-membership-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        await db.insert(schema.memberships).values({
          id: membershipId,
          userId: targetUser.id,
          organizationId: sharedTestData.organization,
          roleId: sharedTestData.memberRole!,
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
            organizationId: sharedTestData.organization,
          }),
          expect.objectContaining({
            id: testRole.id,
            organizationId: sharedTestData.organization,
          }),
          expect.objectContaining({
            userId: targetUser.id,
            organizationId: sharedTestData.organization,
          }),
          expect.arrayContaining([
            expect.objectContaining({
              userId: expect.any(String),
              organizationId: sharedTestData.organization,
            }),
          ]),
          expect.objectContaining({
            organizationId: sharedTestData.organization,
            actorUserId: sharedTestData.user || "test-user-admin",
            userPermissions: ["role:manage", "organization:manage"],
          }),
        );
      });
    });

    it("should enforce organization scoping in all queries", async () => {
      await withTransaction(sharedDb, async (db) => {
        const context = createTestContext(db, sharedTestData);
        const caller = roleRouter.createCaller(context);

        // Create a test user for assignment testing
        const targetUserId = `target-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const [targetUser] = await db
          .insert(schema.users)
          .values({
            id: targetUserId,
            email: `target-${Date.now()}@example.com`,
            name: "Target User",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Create membership for target user in member role
        const membershipId = `target-membership-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        await db.insert(schema.memberships).values({
          id: membershipId,
          userId: targetUser.id,
          organizationId: sharedTestData.organization,
          roleId: sharedTestData.memberRole!,
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
            eq(schema.memberships.organizationId, sharedTestData.organization),
          ),
        });

        expect(membership?.organizationId).toBe(sharedTestData.organization);
        expect(membership?.roleId).toBe(testRole.id);
      });
    });
  });

  describe("Multi-tenant isolation", () => {
    it("should enforce organization scoping across all endpoints", async () => {
      await withTransaction(sharedDb, async (db) => {
        const context = createTestContext(db, sharedTestData);
        const caller = roleRouter.createCaller(context);

        // Create second organization with roles
        const org2Id = `test-org-2-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        await db.insert(schema.organizations).values({
          id: org2Id,
          name: "Test Organization 2",
          subdomain: `test-org-2-${Date.now()}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Create role in org2
        const org2RoleId = `org2-role-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
            id: `org2-admin-role-${Date.now()}`,
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
          id: `org2-membership-${Date.now()}`,
          userId: sharedTestData.user || "test-user-admin",
          organizationId: org2Id,
          roleId: org2AdminRole.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Test org2 caller cannot see org1 roles
        const org2Context = {
          ...createTestContext(db, sharedTestData),
          organization: {
            id: org2Id,
            name: "Test Organization 2",
            subdomain: `test-org-2-${Date.now()}`,
          },
        };
        const org2Caller = roleRouter.createCaller(org2Context as any);

        const org2Roles = await org2Caller.list();
        expect(
          org2Roles.find(
            (r) => r.organizationId === sharedTestData.organization,
          ),
        ).toBeUndefined();
        expect(org2Roles.find((r) => r.id === org2RoleId)).toBeDefined();

        // Cleanup happens automatically via transaction rollback
      });
    });
  });

  describe("Permission validation", () => {
    it("should require role:manage permission for mutations", async () => {
      await withTransaction(sharedDb, async (db) => {
        const context = createTestContext(db, sharedTestData);
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

    it("should allow organization:manage permission for queries", async () => {
      await withTransaction(sharedDb, async (db) => {
        // Test context with organization:manage but not role:manage
        const queryContext = {
          ...createTestContext(db, sharedTestData),
          userPermissions: ["organization:manage"],
        };
        const queryCaller = roleRouter.createCaller(queryContext as any);

        // Should not throw permission errors for queries
        await expect(queryCaller.getPermissions()).resolves.toBeDefined();
        await expect(queryCaller.getTemplates()).resolves.toBeDefined();

        const roles = await queryCaller.list();
        expect(roles).toBeDefined();
      });
    });
  });
});
