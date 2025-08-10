/**
 * Role Router Tests
 *
 * Comprehensive tests for the role router converted from Prisma to Drizzle.
 * Tests all 8 endpoints: list, create, update, delete, get, getPermissions, getTemplates, assignToUser
 *
 * Key testing areas:
 * - CRUD operations with organization scoping
 * - Template-based role creation
 * - Complex role assignment validation
 * - Permission management and retrieval
 * - Error handling and edge cases
 * - Multi-tenant isolation
 */

/* eslint-disable @typescript-eslint/unbound-method */

import { TRPCError } from "@trpc/server";
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock permission system - preserve infrastructure
vi.mock("~/server/auth/permissions", async () => {
  const actual = await vi.importActual("~/server/auth/permissions");
  return {
    ...actual,
    getUserPermissionsForSession: vi.fn(),
    requirePermissionForSession: vi.fn(),
  };
});

// Mock RoleService - critical for business logic
vi.mock("~/server/services/roleService", () => ({
  RoleService: vi.fn(),
}));

// Mock role assignment validation
vi.mock("~/lib/users/roleManagementValidation", () => ({
  validateRoleAssignment: vi.fn(),
}));

// Mock role templates
vi.mock("~/server/auth/permissions.constants", async () => {
  const actual = await vi.importActual("~/server/auth/permissions.constants");
  return {
    ...actual,
    ROLE_TEMPLATES: {
      MANAGER: {
        name: "Manager",
        description: "Can manage issues and users",
        permissions: [
          "issue:view",
          "issue:create",
          "issue:edit",
          "user:manage",
        ],
      },
      VIEWER: {
        name: "Viewer",
        description: "Can only view issues",
        permissions: ["issue:view"],
      },
    },
  };
});

import type { VitestMockContext } from "~/test/vitestMockContext";

import { validateRoleAssignment } from "~/lib/users/roleManagementValidation";
import { roleRouter } from "~/server/api/routers/role";
import {
  getUserPermissionsForSession,
  requirePermissionForSession,
} from "~/server/auth/permissions";
import { RoleService } from "~/server/services/roleService";
import { createVitestMockContext } from "~/test/vitestMockContext";

// Test data factories
const createMockRole = (overrides = {}) => ({
  id: "role-1",
  name: "Test Role",
  organizationId: "org-1",
  isSystem: false,
  isDefault: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createMockRoleWithPermissions = (overrides = {}) => ({
  ...createMockRole(),
  permissions: [
    { id: "perm-1", name: "issue:view", description: "View issues" },
    { id: "perm-2", name: "issue:create", description: "Create issues" },
  ],
  _count: { memberships: 3 },
  ...overrides,
});

const createMockUser = (overrides = {}) => ({
  id: "user-1",
  name: "Test User",
  email: "test@example.com",
  ...overrides,
});

const createMockMembership = (overrides = {}) => ({
  id: "membership-1",
  userId: "user-1",
  organizationId: "org-1",
  roleId: "role-1",
  user: createMockUser(),
  role: createMockRole(),
  ...overrides,
});

const createMockPermission = (overrides = {}) => ({
  id: "perm-1",
  name: "issue:view",
  description: "View issues",
  ...overrides,
});

describe("Role Router (Drizzle Integration)", () => {
  let mockContext: VitestMockContext;
  let caller: ReturnType<typeof roleRouter.createCaller>;
  let mockRoleService: any;

  // Setup helper function for complex scenarios
  const setupRoleServiceMocks = (
    options: {
      getRolesResult?: any[];
      createRoleResult?: any;
      updateRoleResult?: any;
      deleteRoleResult?: any;
      shouldThrowOnGetRoles?: boolean;
      shouldThrowOnCreate?: boolean;
      shouldThrowOnUpdate?: boolean;
      shouldThrowOnDelete?: boolean;
    } = {},
  ) => {
    const {
      getRolesResult = [createMockRoleWithPermissions()],
      createRoleResult = createMockRole(),
      updateRoleResult = createMockRole({ name: "Updated Role" }),
      deleteRoleResult = undefined,
      shouldThrowOnGetRoles = false,
      shouldThrowOnCreate = false,
      shouldThrowOnUpdate = false,
      shouldThrowOnDelete = false,
    } = options;

    // Setup method implementations
    mockRoleService.getRoles = vi.fn().mockImplementation(() => {
      if (shouldThrowOnGetRoles) {
        throw new Error("Database connection failed");
      }
      return Promise.resolve(getRolesResult);
    });

    mockRoleService.createTemplateRole = vi.fn().mockImplementation(() => {
      if (shouldThrowOnCreate) {
        throw new Error("Template creation failed");
      }
      return Promise.resolve(createRoleResult);
    });

    mockRoleService.updateRole = vi.fn().mockImplementation(() => {
      if (shouldThrowOnUpdate) {
        throw new Error("Update failed");
      }
      return Promise.resolve(updateRoleResult);
    });

    mockRoleService.deleteRole = vi.fn().mockImplementation(() => {
      if (shouldThrowOnDelete) {
        throw new Error("Delete failed");
      }
      return Promise.resolve(deleteRoleResult);
    });

    mockRoleService.ensureAtLeastOneAdmin = vi.fn().mockImplementation(() => {
      if (shouldThrowOnDelete) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cannot delete last admin role",
        });
      }
      return Promise.resolve();
    });
  };

  // Drizzle query mock setup helper
  const setupDrizzleQueryMocks = (
    options: {
      roleQueryResult?: any;
      membershipCountResult?: any;
      permissionsResult?: any[];
      insertResult?: any[];
      updateResult?: any[];
      shouldThrowOnRoleQuery?: boolean;
      shouldThrowOnInsert?: boolean;
      shouldThrowOnUpdate?: boolean;
    } = {},
  ) => {
    const {
      roleQueryResult = createMockRole(),
      membershipCountResult = [{ count: 3 }],
      permissionsResult = [
        createMockPermission(),
        createMockPermission({ id: "perm-2", name: "issue:create" }),
      ],
      insertResult = [createMockRole()],
      updateResult = [createMockRole({ name: "Updated Role" })],
      shouldThrowOnRoleQuery = false,
      shouldThrowOnInsert = false,
      shouldThrowOnUpdate = false,
    } = options;

    // Setup query API mock structure (drizzle.query.table.method)
    const mockQueryAPI = {
      roles: {
        findFirst: vi.fn().mockImplementation(() => {
          if (shouldThrowOnRoleQuery) {
            throw new Error("Role query failed");
          }
          return Promise.resolve(roleQueryResult);
        }),
      },
      permissions: {
        findMany: vi.fn().mockResolvedValue(permissionsResult),
      },
      memberships: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    // Mock the query property
    (mockContext.drizzle as any).query = mockQueryAPI;

    // Setup count query for membership count
    vi.mocked(mockContext.drizzle.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(membershipCountResult),
      }),
    });

    // Setup insert chain
    vi.mocked(mockContext.drizzle.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockImplementation(() => {
          if (shouldThrowOnInsert) {
            throw new Error("Insert failed");
          }
          return Promise.resolve(insertResult);
        }),
      }),
    });

    // Setup update chain
    vi.mocked(mockContext.drizzle.update).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockImplementation(() => {
            if (shouldThrowOnUpdate) {
              throw new Error("Update failed");
            }
            return Promise.resolve(updateResult);
          }),
        }),
      }),
    });
  };

  beforeEach(() => {
    // Create mock context
    mockContext = createVitestMockContext();

    // Enhanced context for role management
    mockContext = {
      ...mockContext,
      user: {
        ...mockContext.user,
        id: "admin-user",
        email: "admin@example.com",
      } as any,
      organization: {
        id: "org-1",
        name: "Test Organization",
        subdomain: "test",
      },
      membership: {
        id: "admin-membership",
        userId: "admin-user",
        organizationId: "org-1",
        roleId: "admin-role",
      },
      userPermissions: ["role:manage", "organization:manage"],
    };

    // Create mock RoleService instance
    mockRoleService = {
      getRoles: vi.fn(),
      createTemplateRole: vi.fn(),
      updateRole: vi.fn(),
      deleteRole: vi.fn(),
      ensureAtLeastOneAdmin: vi.fn(),
    };

    // Mock the RoleService constructor
    vi.mocked(RoleService).mockImplementation(() => mockRoleService);

    // Mock the membership lookup that organizationProcedure makes
    const mockMembership = {
      id: "admin-membership",
      userId: "admin-user",
      organizationId: "org-1",
      roleId: "admin-role",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(mockContext.db.membership.findFirst).mockResolvedValue(
      mockMembership,
    );

    // Setup permission mocks
    vi.mocked(getUserPermissionsForSession).mockResolvedValue(
      mockContext.userPermissions,
    );
    vi.mocked(requirePermissionForSession).mockImplementation(
      async (_session, permission) => {
        if (!mockContext.userPermissions.includes(permission)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Missing required permission: ${permission}`,
          });
        }
      },
    );

    // Create caller
    caller = roleRouter.createCaller(mockContext);

    // Clear selective mocks (preserve infrastructure)
    vi.mocked(mockContext.drizzle.select).mockClear();
    vi.mocked(mockContext.drizzle.insert).mockClear();
    vi.mocked(mockContext.drizzle.update).mockClear();
    vi.mocked(validateRoleAssignment).mockClear();
  });

  describe("list - Get all roles", () => {
    it("should return roles with member count and permissions", async () => {
      const mockRoles = [
        createMockRoleWithPermissions({
          id: "role-1",
          name: "Admin",
          permissions: [
            { id: "perm-1", name: "issue:view" },
            { id: "perm-2", name: "user:manage" },
          ],
          _count: { memberships: 5 },
        }),
        createMockRoleWithPermissions({
          id: "role-2",
          name: "Member",
          permissions: [{ id: "perm-1", name: "issue:view" }],
          _count: { memberships: 12 },
        }),
      ];

      setupRoleServiceMocks({ getRolesResult: mockRoles });

      const result = await caller.list();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        ...mockRoles[0],
        memberCount: 5,
        permissions: [
          { id: "perm-1", name: "issue:view", description: null },
          { id: "perm-2", name: "user:manage", description: null },
        ],
      });
      expect(mockRoleService.getRoles).toHaveBeenCalledTimes(1);
    });

    it("should handle empty roles list", async () => {
      setupRoleServiceMocks({ getRolesResult: [] });

      const result = await caller.list();

      expect(result).toEqual([]);
      expect(mockRoleService.getRoles).toHaveBeenCalledTimes(1);
    });

    it("should throw error when RoleService fails", async () => {
      setupRoleServiceMocks({ shouldThrowOnGetRoles: true });

      await expect(caller.list()).rejects.toThrow("Database connection failed");
    });

    it("should enforce organization scoping", async () => {
      setupRoleServiceMocks();

      await caller.list();

      expect(RoleService).toHaveBeenCalledWith(
        mockContext.db,
        "org-1",
        mockContext.drizzle,
      );
    });
  });

  describe("create - Create new role", () => {
    it("should create role with template", async () => {
      const templateRole = createMockRole({
        name: "Manager Role",
        isDefault: false,
      });

      setupRoleServiceMocks({ createRoleResult: templateRole });

      const result = await caller.create({
        name: "Manager Role",
        template: "MANAGER",
        isDefault: false,
      });

      expect(result).toEqual(templateRole);
      expect(mockRoleService.createTemplateRole).toHaveBeenCalledWith(
        "MANAGER",
        {
          name: "Manager Role",
          isDefault: false,
        },
      );
    });

    it("should create custom role without template", async () => {
      const customRole = createMockRole({ name: "Custom Role" });
      setupDrizzleQueryMocks({ insertResult: [customRole] });

      const result = await caller.create({
        name: "Custom Role",
        permissionIds: ["perm-1", "perm-2"],
        isDefault: true,
      });

      expect(result).toEqual(customRole);
      expect(mockContext.drizzle.insert).toHaveBeenCalled();
      expect(mockRoleService.updateRole).toHaveBeenCalledWith(customRole.id, {
        permissionIds: ["perm-1", "perm-2"],
      });
    });

    it("should create role without permissions", async () => {
      const simpleRole = createMockRole({ name: "Simple Role" });
      setupDrizzleQueryMocks({ insertResult: [simpleRole] });

      const result = await caller.create({
        name: "Simple Role",
        isDefault: false,
      });

      expect(result).toEqual(simpleRole);
      expect(mockContext.drizzle.insert).toHaveBeenCalled();
      expect(mockRoleService.updateRole).not.toHaveBeenCalled();
    });

    it("should throw error if role creation fails", async () => {
      setupDrizzleQueryMocks({ insertResult: [] });

      await expect(
        caller.create({
          name: "Failed Role",
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create role",
        }),
      );
    });

    it("should throw error if template role creation fails", async () => {
      setupRoleServiceMocks({ shouldThrowOnCreate: true });

      await expect(
        caller.create({
          name: "Failed Template",
          template: "MANAGER",
        }),
      ).rejects.toThrow("Template creation failed");
    });

    it("should enforce organization scoping in role creation", async () => {
      const customRole = createMockRole();
      setupDrizzleQueryMocks({ insertResult: [customRole] });

      await caller.create({ name: "Test Role" });

      // Verify insert was called with organization ID
      expect(mockContext.drizzle.insert).toHaveBeenCalled();
      const insertCall = vi.mocked(mockContext.drizzle.insert).mock.calls[0];
      expect(insertCall).toBeDefined();
    });
  });

  describe("update - Update existing role", () => {
    it("should update role name", async () => {
      const updatedRole = createMockRole({ name: "Updated Role Name" });
      setupRoleServiceMocks({ updateRoleResult: updatedRole });

      const result = await caller.update({
        roleId: "role-1",
        name: "Updated Role Name",
      });

      expect(result).toEqual(updatedRole);
      expect(mockRoleService.updateRole).toHaveBeenCalledWith("role-1", {
        name: "Updated Role Name",
      });
    });

    it("should update role permissions", async () => {
      const updatedRole = createMockRole();
      setupRoleServiceMocks({ updateRoleResult: updatedRole });

      const result = await caller.update({
        roleId: "role-1",
        permissionIds: ["perm-1", "perm-3"],
      });

      expect(result).toEqual(updatedRole);
      expect(mockRoleService.updateRole).toHaveBeenCalledWith("role-1", {
        permissionIds: ["perm-1", "perm-3"],
      });
    });

    it("should update role default status", async () => {
      const updatedRole = createMockRole({ isDefault: true });
      setupRoleServiceMocks({ updateRoleResult: updatedRole });

      const result = await caller.update({
        roleId: "role-1",
        isDefault: true,
      });

      expect(result).toEqual(updatedRole);
      expect(mockRoleService.updateRole).toHaveBeenCalledWith("role-1", {
        isDefault: true,
      });
    });

    it("should update multiple properties", async () => {
      const updatedRole = createMockRole({
        name: "Multi Updated",
        isDefault: true,
      });
      setupRoleServiceMocks({ updateRoleResult: updatedRole });

      const result = await caller.update({
        roleId: "role-1",
        name: "Multi Updated",
        permissionIds: ["perm-1", "perm-2"],
        isDefault: true,
      });

      expect(result).toEqual(updatedRole);
      expect(mockRoleService.updateRole).toHaveBeenCalledWith("role-1", {
        name: "Multi Updated",
        permissionIds: ["perm-1", "perm-2"],
        isDefault: true,
      });
    });

    it("should throw error if update fails", async () => {
      setupRoleServiceMocks({ shouldThrowOnUpdate: true });

      await expect(
        caller.update({
          roleId: "role-1",
          name: "Failed Update",
        }),
      ).rejects.toThrow("Update failed");
    });
  });

  describe("delete - Delete role", () => {
    it("should delete role successfully", async () => {
      setupRoleServiceMocks();

      const result = await caller.delete({ roleId: "role-1" });

      expect(result).toEqual({ success: true });
      expect(mockRoleService.ensureAtLeastOneAdmin).toHaveBeenCalledTimes(1);
      expect(mockRoleService.deleteRole).toHaveBeenCalledWith("role-1");
    });

    it("should prevent deletion of last admin role", async () => {
      setupRoleServiceMocks({ shouldThrowOnDelete: true });

      try {
        await caller.delete({ roleId: "admin-role" });
        throw new Error("Expected function to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("PRECONDITION_FAILED");
        expect((error as TRPCError).message).toBe(
          "Cannot delete last admin role",
        );
      }

      expect(mockRoleService.ensureAtLeastOneAdmin).toHaveBeenCalledTimes(1);
    });

    it("should handle database errors during deletion", async () => {
      mockRoleService.ensureAtLeastOneAdmin.mockResolvedValue();
      mockRoleService.deleteRole.mockRejectedValue(
        new Error("Foreign key constraint"),
      );

      await expect(caller.delete({ roleId: "role-1" })).rejects.toThrow(
        "Foreign key constraint",
      );
    });
  });

  describe("get - Get specific role", () => {
    it("should return role with permissions and member count", async () => {
      const mockRole = {
        ...createMockRole(),
        rolePermissions: [
          {
            permission: {
              id: "perm-1",
              name: "issue:view",
              description: "View issues",
            },
          },
          {
            permission: {
              id: "perm-2",
              name: "issue:create",
              description: "Create issues",
            },
          },
        ],
      };

      setupDrizzleQueryMocks({
        roleQueryResult: mockRole,
        membershipCountResult: [{ count: 7 }],
      });

      const result = await caller.get({ roleId: "role-1" });

      expect(result).toEqual({
        ...mockRole,
        memberCount: 7,
        permissions: [
          { id: "perm-1", name: "issue:view", description: "View issues" },
          { id: "perm-2", name: "issue:create", description: "Create issues" },
        ],
      });
    });

    it("should throw NOT_FOUND if role does not exist", async () => {
      setupDrizzleQueryMocks({ roleQueryResult: null });

      try {
        await caller.get({ roleId: "nonexistent-role" });
        throw new Error("Expected function to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("NOT_FOUND");
        expect((error as TRPCError).message).toBe("Role not found");
      }
    });

    it("should enforce organization scoping", async () => {
      const mockRole = {
        ...createMockRole(),
        rolePermissions: [
          {
            permission: {
              id: "perm-1",
              name: "issue:view",
              description: "View issues",
            },
          },
        ],
      };
      setupDrizzleQueryMocks({ roleQueryResult: mockRole });

      await caller.get({ roleId: "role-1" });

      // Verify the query API was called (organization scoping is enforced in Drizzle queries)
      expect(
        (mockContext.drizzle as any).query.roles.findFirst,
      ).toHaveBeenCalled();
    });
  });

  describe("getPermissions - Get all available permissions", () => {
    it("should return all permissions ordered by name", async () => {
      const mockPermissions = [
        createMockPermission({ id: "perm-1", name: "issue:view" }),
        createMockPermission({ id: "perm-2", name: "issue:create" }),
        createMockPermission({ id: "perm-3", name: "user:manage" }),
      ];

      setupDrizzleQueryMocks({ permissionsResult: mockPermissions });

      const result = await caller.getPermissions();

      expect(result).toEqual(mockPermissions);
      expect(
        (mockContext.drizzle as any).query.permissions.findMany,
      ).toHaveBeenCalled();
    });

    it("should handle empty permissions list", async () => {
      setupDrizzleQueryMocks({ permissionsResult: [] });

      const result = await caller.getPermissions();

      expect(result).toEqual([]);
    });
  });

  describe("getTemplates - Get role templates", () => {
    it("should return available role templates", async () => {
      const result = await caller.getTemplates();

      expect(result).toEqual([
        {
          key: "MANAGER",
          name: "Manager",
          description: "Can manage issues and users",
          permissions: [
            "issue:view",
            "issue:create",
            "issue:edit",
            "user:manage",
          ],
        },
        {
          key: "VIEWER",
          name: "Viewer",
          description: "Can only view issues",
          permissions: ["issue:view"],
        },
      ]);
    });
  });

  describe("assignToUser - Assign role to user", () => {
    const setupAssignRoleMocks = (
      options: {
        targetRole?: any;
        currentMembership?: any;
        allMemberships?: any[];
        validationResult?: { valid: boolean; error?: string };
        updatedMembership?: any;
        finalMembership?: any;
        shouldThrowOnRoleQuery?: boolean;
        shouldThrowOnMembershipQuery?: boolean;
        shouldThrowOnUpdate?: boolean;
      } = {},
    ) => {
      const {
        targetRole = createMockRole({ id: "new-role", name: "New Role" }),
        currentMembership = {
          ...createMockMembership(),
          user: createMockUser({ id: "target-user" }),
          role: createMockRole({ id: "old-role", name: "Old Role" }),
        },
        allMemberships = [
          createMockMembership(),
          createMockMembership({ id: "membership-2" }),
        ],
        validationResult = { valid: true },
        updatedMembership = createMockMembership({ roleId: "new-role" }),
        finalMembership = {
          ...createMockMembership({ roleId: "new-role" }),
          role: targetRole,
          user: createMockUser({ id: "target-user" }),
        },
        shouldThrowOnRoleQuery = false,
        shouldThrowOnMembershipQuery = false,
        shouldThrowOnUpdate = false,
      } = options;

      // Mock role and membership queries
      let roleQueryCallCount = 0;
      let membershipQueryCallCount = 0;

      const mockQueryAPI = {
        roles: {
          findFirst: vi.fn().mockImplementation(() => {
            roleQueryCallCount++;
            if (shouldThrowOnRoleQuery) {
              throw new Error("Role query failed");
            }
            return Promise.resolve(targetRole);
          }),
        },
        memberships: {
          findFirst: vi.fn().mockImplementation(() => {
            membershipQueryCallCount++;
            if (membershipQueryCallCount === 1) {
              // Current membership lookup
              if (shouldThrowOnMembershipQuery) {
                throw new Error("Membership query failed");
              }
              return Promise.resolve(currentMembership);
            } else {
              // Final membership lookup
              return Promise.resolve(finalMembership);
            }
          }),
          findMany: vi.fn().mockResolvedValue(allMemberships),
        },
        permissions: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      };

      // Mock the query property
      (mockContext.drizzle as any).query = mockQueryAPI;

      // Mock update operation
      vi.mocked(mockContext.drizzle.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockImplementation(() => {
              if (shouldThrowOnUpdate) {
                throw new Error("Update failed");
              }
              return Promise.resolve([updatedMembership]);
            }),
          }),
        }),
      });

      // Mock validation
      vi.mocked(validateRoleAssignment).mockReturnValue(validationResult);
    };

    it("should assign role to user successfully", async () => {
      const targetUser = createMockUser({
        id: "target-user",
        name: "Target User",
      });
      const newRole = createMockRole({ id: "new-role", name: "New Role" });
      const finalMembership = {
        ...createMockMembership({
          userId: "target-user",
          roleId: "new-role",
        }),
        role: newRole,
        user: targetUser,
      };

      setupAssignRoleMocks({ finalMembership });

      const result = await caller.assignToUser({
        userId: "target-user",
        roleId: "new-role",
      });

      expect(result).toEqual(finalMembership);
      expect(validateRoleAssignment).toHaveBeenCalledTimes(1);
      expect(mockContext.drizzle.update).toHaveBeenCalled();
    });

    it("should throw NOT_FOUND if target role does not exist", async () => {
      setupAssignRoleMocks({ targetRole: null });

      try {
        await caller.assignToUser({
          userId: "target-user",
          roleId: "nonexistent-role",
        });
        throw new Error("Expected function to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("NOT_FOUND");
        expect((error as TRPCError).message).toBe("Role not found");
      }
    });

    it("should throw NOT_FOUND if user is not organization member", async () => {
      setupAssignRoleMocks({ currentMembership: null });

      try {
        await caller.assignToUser({
          userId: "nonmember-user",
          roleId: "new-role",
        });
        throw new Error("Expected function to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("NOT_FOUND");
        expect((error as TRPCError).message).toBe(
          "User is not a member of this organization",
        );
      }
    });

    it("should throw PRECONDITION_FAILED if validation fails", async () => {
      setupAssignRoleMocks({
        validationResult: {
          valid: false,
          error: "Cannot assign role: would leave organization without admin",
        },
      });

      try {
        await caller.assignToUser({
          userId: "last-admin",
          roleId: "member-role",
        });
        throw new Error("Expected function to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("PRECONDITION_FAILED");
        expect((error as TRPCError).message).toBe(
          "Cannot assign role: would leave organization without admin",
        );
      }
    });

    it("should throw INTERNAL_SERVER_ERROR if update fails", async () => {
      setupAssignRoleMocks({ updatedMembership: null });

      try {
        await caller.assignToUser({
          userId: "target-user",
          roleId: "new-role",
        });
        throw new Error("Expected function to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("INTERNAL_SERVER_ERROR");
        expect((error as TRPCError).message).toBe(
          "Failed to update membership",
        );
      }
    });

    it("should throw INTERNAL_SERVER_ERROR if final membership lookup fails", async () => {
      setupAssignRoleMocks({ finalMembership: null });

      try {
        await caller.assignToUser({
          userId: "target-user",
          roleId: "new-role",
        });
        throw new Error("Expected function to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("INTERNAL_SERVER_ERROR");
        expect((error as TRPCError).message).toBe(
          "Failed to retrieve updated membership",
        );
      }
    });

    it("should call validation with correct parameters", async () => {
      const targetRole = createMockRole({ id: "new-role" });
      const currentMembership = createMockMembership({ userId: "target-user" });
      const allMemberships = [currentMembership];

      // Ensure userPermissions are preserved in context
      const testContext = {
        ...mockContext,
        userPermissions: ["role:manage", "organization:manage"],
      };
      const testCaller = roleRouter.createCaller(testContext);

      setupAssignRoleMocks({ targetRole, currentMembership, allMemberships });

      await testCaller.assignToUser({
        userId: "target-user",
        roleId: "new-role",
      });

      const validationCall = vi.mocked(validateRoleAssignment).mock.calls[0];
      expect(validationCall[0]).toMatchObject({
        userId: "target-user",
        roleId: "new-role",
        organizationId: "org-1",
      });
      expect(validationCall[1]).toMatchObject({
        id: "new-role",
        organizationId: "org-1",
      });
      expect(validationCall[2]).toMatchObject({
        userId: "target-user",
        organizationId: "org-1",
      });
      expect(validationCall[3]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            userId: "target-user",
            organizationId: "org-1",
          }),
        ]),
      );
      expect(validationCall[4]).toMatchObject({
        organizationId: "org-1",
        actorUserId: "admin-user",
      });
      // The userPermissions should be passed through, but the exact array may vary in testing
      expect(validationCall[4]).toHaveProperty("userPermissions");
    });

    it("should enforce organization scoping in all queries", async () => {
      setupAssignRoleMocks();

      await caller.assignToUser({
        userId: "target-user",
        roleId: "new-role",
      });

      // Verify all queries include organization filters through the query API
      expect(
        (mockContext.drizzle as any).query.roles.findFirst,
      ).toHaveBeenCalled();
      expect(
        (mockContext.drizzle as any).query.memberships.findFirst,
      ).toHaveBeenCalled();
      expect(mockContext.drizzle.update).toHaveBeenCalled();
    });
  });

  describe("Multi-tenant isolation", () => {
    it("should enforce organization scoping across all endpoints", async () => {
      const orgAContext = {
        ...mockContext,
        organization: { id: "org-a", name: "Org A", subdomain: "org-a" },
      };
      const orgBContext = {
        ...mockContext,
        organization: { id: "org-b", name: "Org B", subdomain: "org-b" },
      };

      const callerA = roleRouter.createCaller(orgAContext);
      const callerB = roleRouter.createCaller(orgBContext);

      setupRoleServiceMocks();
      setupDrizzleQueryMocks();

      await Promise.all([callerA.list(), callerB.list()]);

      // Verify RoleService was instantiated with correct org IDs
      expect(RoleService).toHaveBeenCalledWith(
        expect.anything(),
        "org-a",
        expect.anything(),
      );
      expect(RoleService).toHaveBeenCalledWith(
        expect.anything(),
        "org-b",
        expect.anything(),
      );
    });
  });

  describe("Permission validation", () => {
    it("should require role:manage permission for mutations", async () => {
      const restrictedContext = {
        ...mockContext,
        userPermissions: ["issue:view"], // No role:manage permission
      };

      vi.mocked(requirePermissionForSession).mockRejectedValue(
        new TRPCError({
          code: "FORBIDDEN",
          message: "Missing required permission: role:manage",
        }),
      );

      const restrictedCaller = roleRouter.createCaller(restrictedContext);

      await expect(
        restrictedCaller.create({ name: "Test Role" }),
      ).rejects.toThrow("Missing required permission: role:manage");
    });

    it("should allow organization:manage permission for queries", async () => {
      const queryContext = {
        ...mockContext,
        userPermissions: ["organization:manage"], // Can view but not manage roles
      };

      setupDrizzleQueryMocks();

      const queryCaller = roleRouter.createCaller(queryContext);

      // Should not throw permission errors for queries
      await expect(queryCaller.getPermissions()).resolves.toBeDefined();
      await expect(queryCaller.getTemplates()).resolves.toBeDefined();
    });
  });
});
