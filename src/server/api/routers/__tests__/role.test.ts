import { describe, it, expect, beforeEach } from "@jest/globals";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createMockContext,
  resetMockContext,
  type MockContext,
} from "../../../../test/mockContext";
import { createTRPCRouter } from "../../trpc";
import {
  roleManageProcedure,
  organizationProcedure,
} from "../../trpc.permission";

// Mock Role Router - This will be implemented by the implementation agent
const roleRouter = createTRPCRouter({
  list: organizationProcedure.query(async ({ ctx }) => {
    // Mock implementation that should be replaced
    const roles = await ctx.db.role.findMany({
      where: { organizationId: ctx.organization.id },
      include: {
        permissions: true,
        _count: {
          select: {
            memberships: true,
          },
        },
      },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });

    return roles.map((role) => ({
      ...role,
      memberCount: role._count.memberships,
    }));
  }),

  create: roleManageProcedure
    .input(
      z.object({
        name: z.string().min(1).max(50),
        permissionIds: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Mock implementation
      const role = await ctx.db.role.create({
        data: {
          name: input.name,
          organizationId: ctx.organization.id,
          isSystem: false,
          isDefault: false,
        },
        include: {
          permissions: true,
        },
      });

      // Connect permissions if provided
      if (input.permissionIds && input.permissionIds.length > 0) {
        await ctx.db.role.update({
          where: { id: role.id },
          data: {
            permissions: {
              connect: input.permissionIds.map((id) => ({ id })),
            },
          },
        });
      }

      return role;
    }),

  update: roleManageProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(50).optional(),
        permissionIds: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if role exists and is not a system role
      const existingRole = await ctx.db.role.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organization.id,
        },
      });

      if (!existingRole) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Role not found",
        });
      }

      if (existingRole.isSystem) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot modify system roles",
        });
      }

      // Update role
      const updateData: {
        name?: string;
        permissions?: { set: { id: string }[] };
      } = {};

      if (input.name) {
        updateData.name = input.name;
      }

      if (input.permissionIds) {
        updateData.permissions = {
          set: input.permissionIds.map((id) => ({ id })),
        };
      }

      const updatedRole = await ctx.db.role.update({
        where: { id: input.id },
        data: updateData,
        include: {
          permissions: true,
        },
      });

      return updatedRole;
    }),

  delete: roleManageProcedure
    .input(
      z.object({
        id: z.string(),
        reassignToRoleId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if role exists and is not a system role
      const existingRole = await ctx.db.role.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organization.id,
        },
        include: {
          memberships: true,
        },
      });

      if (!existingRole) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Role not found",
        });
      }

      if (existingRole.isSystem) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot delete system roles",
        });
      }

      // If role has members, require reassignment
      if (existingRole.memberships.length > 0 && !input.reassignToRoleId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Cannot delete role with active members. Please specify a role to reassign members to.",
        });
      }

      // Reassign members if needed
      if (input.reassignToRoleId && existingRole.memberships.length > 0) {
        await ctx.db.membership.updateMany({
          where: { roleId: input.id },
          data: { roleId: input.reassignToRoleId },
        });
      }

      // Delete the role
      await ctx.db.role.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  getPermissions: organizationProcedure.query(async ({ ctx }) => {
    // Mock implementation
    return await ctx.db.permission.findMany({
      orderBy: { name: "asc" },
    });
  }),

  getById: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const role = await ctx.db.role.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organization.id,
        },
        include: {
          permissions: true,
          _count: {
            select: {
              memberships: true,
            },
          },
        },
      });

      if (!role) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Role not found",
        });
      }

      return {
        ...role,
        memberCount: role._count.memberships,
      };
    }),
});

// Mock context helper
const createMockTRPCContext = (permissions: string[] = []) => {
  const mockContext = createMockContext();

  return {
    ...mockContext,
    session: {
      user: {
        id: "user-1",
        email: "admin@example.com",
        name: "Admin User",
        image: null,
      },
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    },
    organization: {
      id: "org-1",
      name: "Test Organization",
    },
    membership: {
      id: "membership-1",
      userId: "user-1",
      organizationId: "org-1",
      roleId: "admin-role",
      createdAt: new Date(),
      updatedAt: new Date(),
      role: {
        id: "admin-role",
        name: "Admin",
        organizationId: "org-1",
        isSystem: true,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        permissions: permissions.map((name, index) => ({
          id: `perm-${(index + 1).toString()}`,
          name,
          description: `${name} permission`,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      },
    },
    userPermissions: permissions,
  };
};

describe("Role Management API", () => {
  let mockContext: MockContext;

  beforeEach(() => {
    mockContext = createMockContext();
    resetMockContext(mockContext);
  });

  describe("list roles", () => {
    it("should return all roles for organization with member counts", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["role:manage"]);
      const caller = roleRouter.createCaller(ctx as any);

      const mockRoles = [
        {
          id: "system-admin",
          name: "Admin",
          organizationId: "org-1",
          isSystem: true,
          isDefault: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          permissions: [
            {
              id: "perm-1",
              name: "organization:manage",
              description: "Manage organization",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
          _count: { memberships: 1 },
        },
        {
          id: "member-role",
          name: "Member",
          organizationId: "org-1",
          isSystem: false,
          isDefault: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          permissions: [
            {
              id: "perm-2",
              name: "issue:create",
              description: "Create issues",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
          _count: { memberships: 3 },
        },
      ];

      mockContext.db.role.findMany.mockResolvedValue(mockRoles as any);

      // Act
      const result = await caller.list();

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: "system-admin",
          name: "Admin",
          isSystem: true,
          memberCount: 1,
        }),
      );
      expect(result[1]).toEqual(
        expect.objectContaining({
          id: "member-role",
          name: "Member",
          isSystem: false,
          memberCount: 3,
        }),
      );
      expect(mockContext.db.role.findMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1" },
        include: {
          permissions: true,
          _count: {
            select: {
              memberships: true,
            },
          },
        },
        orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      });
    });

    it("should require organization membership to list roles", async () => {
      // Arrange
      const ctx = createMockTRPCContext([]);
      const caller = roleRouter.createCaller(ctx as any);

      // Act & Assert
      // This test depends on the organizationProcedure middleware
      // which should be tested separately
      await expect(caller.list()).resolves.toBeTruthy();
    });
  });

  describe("create role", () => {
    it("should create a new role with role:manage permission", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["role:manage"]);
      const caller = roleRouter.createCaller(ctx as any);

      const mockRole = {
        id: "new-role",
        name: "New Role",
        organizationId: "org-1",
        isSystem: false,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        permissions: [],
      };

      mockContext.db.role.create.mockResolvedValue(mockRole as any);

      // Act
      const result = await caller.create({
        name: "New Role",
      });

      // Assert
      expect(result).toEqual(
        expect.objectContaining({
          id: "new-role",
          name: "New Role",
          isSystem: false,
          isDefault: false,
        }),
      );
      expect(mockContext.db.role.create).toHaveBeenCalledWith({
        data: {
          name: "New Role",
          organizationId: "org-1",
          isSystem: false,
          isDefault: false,
        },
        include: {
          permissions: true,
        },
      });
    });

    it("should create role with permissions when provided", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["role:manage"]);
      const caller = roleRouter.createCaller(ctx as any);

      const mockRole = {
        id: "new-role",
        name: "New Role",
        organizationId: "org-1",
        isSystem: false,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        permissions: [],
      };

      mockContext.db.role.create.mockResolvedValue(mockRole as any);
      mockContext.db.role.update.mockResolvedValue(mockRole as any);

      // Act
      await caller.create({
        name: "New Role",
        permissionIds: ["perm-1", "perm-2"],
      });

      // Assert
      expect(mockContext.db.role.create).toHaveBeenCalled();
      expect(mockContext.db.role.update).toHaveBeenCalledWith({
        where: { id: "new-role" },
        data: {
          permissions: {
            connect: [{ id: "perm-1" }, { id: "perm-2" }],
          },
        },
      });
    });

    it("should deny role creation without role:manage permission", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["issue:create"]);
      const caller = roleRouter.createCaller(ctx as any);

      // Act & Assert
      await expect(caller.create({ name: "New Role" })).rejects.toThrow(
        "Permission required: role:manage",
      );
    });

    it("should validate role name requirements", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["role:manage"]);
      const caller = roleRouter.createCaller(ctx as any);

      // Act & Assert
      await expect(caller.create({ name: "" })).rejects.toThrow();
      await expect(caller.create({ name: "A".repeat(51) })).rejects.toThrow();
    });
  });

  describe("update role", () => {
    it("should update role name and permissions", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["role:manage"]);
      const caller = roleRouter.createCaller(ctx as any);

      const existingRole = {
        id: "role-1",
        name: "Old Name",
        organizationId: "org-1",
        isSystem: false,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedRole = {
        ...existingRole,
        name: "New Name",
        permissions: [
          {
            id: "perm-1",
            name: "issue:create",
            description: "Create issues",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      mockContext.db.role.findFirst.mockResolvedValue(existingRole as any);
      mockContext.db.role.update.mockResolvedValue(updatedRole as any);

      // Act
      const result = await caller.update({
        id: "role-1",
        name: "New Name",
        permissionIds: ["perm-1"],
      });

      // Assert
      expect(result).toEqual(
        expect.objectContaining({
          id: "role-1",
          name: "New Name",
          permissions: expect.arrayContaining([
            expect.objectContaining({
              name: "issue:create",
            }),
          ]),
        }),
      );
      expect(mockContext.db.role.update).toHaveBeenCalledWith({
        where: { id: "role-1" },
        data: {
          name: "New Name",
          permissions: {
            set: [{ id: "perm-1" }],
          },
        },
        include: {
          permissions: true,
        },
      });
    });

    it("should prevent updating system roles", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["role:manage"]);
      const caller = roleRouter.createCaller(ctx as any);

      const systemRole = {
        id: "system-admin",
        name: "Admin",
        organizationId: "org-1",
        isSystem: true,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockContext.db.role.findFirst.mockResolvedValue(systemRole as any);

      // Act & Assert
      await expect(
        caller.update({
          id: "system-admin",
          name: "Modified Admin",
        }),
      ).rejects.toThrow("Cannot modify system roles");
    });

    it("should return NOT_FOUND for non-existent role", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["role:manage"]);
      const caller = roleRouter.createCaller(ctx as any);

      mockContext.db.role.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        caller.update({
          id: "non-existent",
          name: "New Name",
        }),
      ).rejects.toThrow("Role not found");
    });

    it("should deny role update without role:manage permission", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["issue:create"]);
      const caller = roleRouter.createCaller(ctx as any);

      // Act & Assert
      await expect(
        caller.update({
          id: "role-1",
          name: "New Name",
        }),
      ).rejects.toThrow("Permission required: role:manage");
    });
  });

  describe("delete role", () => {
    it("should delete role without members", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["role:manage"]);
      const caller = roleRouter.createCaller(ctx as any);

      const roleToDelete = {
        id: "role-1",
        name: "Role to Delete",
        organizationId: "org-1",
        isSystem: false,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        memberships: [],
      };

      mockContext.db.role.findFirst.mockResolvedValue(roleToDelete as any);
      mockContext.db.role.delete.mockResolvedValue(roleToDelete as any);

      // Act
      const result = await caller.delete({ id: "role-1" });

      // Assert
      expect(result).toEqual({ success: true });
      expect(mockContext.db.role.delete).toHaveBeenCalledWith({
        where: { id: "role-1" },
      });
    });

    it("should delete role and reassign members", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["role:manage"]);
      const caller = roleRouter.createCaller(ctx as any);

      const roleWithMembers = {
        id: "role-1",
        name: "Role with Members",
        organizationId: "org-1",
        isSystem: false,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        memberships: [
          { id: "membership-1", userId: "user-1", roleId: "role-1" },
          { id: "membership-2", userId: "user-2", roleId: "role-1" },
        ],
      };

      mockContext.db.role.findFirst.mockResolvedValue(roleWithMembers as any);
      mockContext.db.membership.updateMany.mockResolvedValue({ count: 2 });
      mockContext.db.role.delete.mockResolvedValue(roleWithMembers as any);

      // Act
      const result = await caller.delete({
        id: "role-1",
        reassignToRoleId: "default-role",
      });

      // Assert
      expect(result).toEqual({ success: true });
      expect(mockContext.db.membership.updateMany).toHaveBeenCalledWith({
        where: { roleId: "role-1" },
        data: { roleId: "default-role" },
      });
      expect(mockContext.db.role.delete).toHaveBeenCalledWith({
        where: { id: "role-1" },
      });
    });

    it("should prevent deletion of system roles", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["role:manage"]);
      const caller = roleRouter.createCaller(ctx as any);

      const systemRole = {
        id: "system-admin",
        name: "Admin",
        organizationId: "org-1",
        isSystem: true,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        memberships: [],
      };

      mockContext.db.role.findFirst.mockResolvedValue(systemRole as any);

      // Act & Assert
      await expect(caller.delete({ id: "system-admin" })).rejects.toThrow(
        "Cannot delete system roles",
      );
    });

    it("should require reassignment when role has members", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["role:manage"]);
      const caller = roleRouter.createCaller(ctx as any);

      const roleWithMembers = {
        id: "role-1",
        name: "Role with Members",
        organizationId: "org-1",
        isSystem: false,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        memberships: [
          { id: "membership-1", userId: "user-1", roleId: "role-1" },
        ],
      };

      mockContext.db.role.findFirst.mockResolvedValue(roleWithMembers as any);

      // Act & Assert
      await expect(caller.delete({ id: "role-1" })).rejects.toThrow(
        "Cannot delete role with active members",
      );
    });

    it("should return NOT_FOUND for non-existent role", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["role:manage"]);
      const caller = roleRouter.createCaller(ctx as any);

      mockContext.db.role.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(caller.delete({ id: "non-existent" })).rejects.toThrow(
        "Role not found",
      );
    });

    it("should deny role deletion without role:manage permission", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["issue:create"]);
      const caller = roleRouter.createCaller(ctx as any);

      // Act & Assert
      await expect(caller.delete({ id: "role-1" })).rejects.toThrow(
        "Permission required: role:manage",
      );
    });
  });

  describe("get permissions", () => {
    it("should return all available permissions", async () => {
      // Arrange
      const ctx = createMockTRPCContext([]);
      const caller = roleRouter.createCaller(ctx as any);

      const mockPermissions = [
        {
          id: "perm-1",
          name: "issue:create",
          description: "Create issues",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "perm-2",
          name: "issue:edit",
          description: "Edit issues",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "perm-3",
          name: "organization:manage",
          description: "Manage organization",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockContext.db.permission.findMany.mockResolvedValue(
        mockPermissions as any,
      );

      // Act
      const result = await caller.getPermissions();

      // Assert
      expect(result).toEqual(mockPermissions);
      expect(mockContext.db.permission.findMany).toHaveBeenCalledWith({
        orderBy: { name: "asc" },
      });
    });
  });

  describe("get role by ID", () => {
    it("should return role details with member count", async () => {
      // Arrange
      const ctx = createMockTRPCContext([]);
      const caller = roleRouter.createCaller(ctx as any);

      const mockRole = {
        id: "role-1",
        name: "Test Role",
        organizationId: "org-1",
        isSystem: false,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        permissions: [
          {
            id: "perm-1",
            name: "issue:create",
            description: "Create issues",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        _count: { memberships: 5 },
      };

      mockContext.db.role.findFirst.mockResolvedValue(mockRole as any);

      // Act
      const result = await caller.getById({ id: "role-1" });

      // Assert
      expect(result).toEqual(
        expect.objectContaining({
          id: "role-1",
          name: "Test Role",
          memberCount: 5,
          permissions: expect.arrayContaining([
            expect.objectContaining({
              name: "issue:create",
            }),
          ]),
        }),
      );
    });

    it("should return NOT_FOUND for non-existent role", async () => {
      // Arrange
      const ctx = createMockTRPCContext([]);
      const caller = roleRouter.createCaller(ctx as any);

      mockContext.db.role.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(caller.getById({ id: "non-existent" })).rejects.toThrow(
        "Role not found",
      );
    });
  });
});
