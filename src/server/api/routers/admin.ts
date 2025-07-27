import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter } from "~/server/api/trpc";
import {
  organizationManageProcedure,
  roleManageProcedure,
  userManageProcedure,
} from "~/server/api/trpc.permission";

export const adminRouter = createTRPCRouter({
  /**
   * Get all roles with permissions and member counts for admin UI
   */
  getRoles: organizationManageProcedure.query(async ({ ctx }) => {
    const roles = await ctx.db.role.findMany({
      where: { organizationId: ctx.organization.id },
      include: {
        permissions: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: { memberships: true },
        },
      },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });

    return roles.map((role) => {
      const roleWithIncludes = role as typeof role & {
        permissions: { id: string; name: string }[];
        _count: { memberships: number };
      };

      return {
        id: roleWithIncludes.id,
        name: roleWithIncludes.name,
        isSystem: roleWithIncludes.isSystem,
        isDefault: roleWithIncludes.isDefault,
        permissionCount: roleWithIncludes.permissions.length,
        memberCount: roleWithIncludes._count.memberships,
        permissions: roleWithIncludes.permissions,
        createdAt: roleWithIncludes.createdAt,
        updatedAt: roleWithIncludes.updatedAt,
      };
    });
  }),

  /**
   * Create a new role with permissions
   */
  createRole: roleManageProcedure
    .input(
      z.object({
        name: z.string().min(1).max(50),
        permissionIds: z
          .array(z.string())
          .min(1, "At least one permission is required"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if role name already exists in this organization
      const existingRole = await ctx.db.role.findFirst({
        where: {
          name: input.name,
          organizationId: ctx.organization.id,
        },
      });

      if (existingRole) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Role name already exists",
        });
      }

      // Validate permissions exist
      const permissions = await ctx.db.permission.findMany({
        where: { id: { in: input.permissionIds } },
      });

      if (permissions.length !== input.permissionIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "One or more permissions are invalid",
        });
      }

      // Create role with permissions
      const role = await ctx.db.role.create({
        data: {
          name: input.name,
          organizationId: ctx.organization.id,
          isSystem: false,
          isDefault: false,
          permissions: {
            connect: input.permissionIds.map((id) => ({ id })),
          },
        },
        include: {
          permissions: true,
          _count: {
            select: { memberships: true },
          },
        },
      });

      return {
        id: role.id,
        name: role.name,
        isSystem: role.isSystem,
        isDefault: role.isDefault,
        permissionCount: role.permissions.length,
        memberCount: role._count.memberships,
        permissions: role.permissions,
      };
    }),

  /**
   * Update a role (non-system roles only)
   */
  updateRole: roleManageProcedure
    .input(
      z.object({
        roleId: z.string(),
        name: z.string().min(1).max(50).optional(),
        permissionIds: z
          .array(z.string())
          .min(1, "At least one permission is required")
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get the role and verify it's not a system role
      const existingRole = await ctx.db.role.findUnique({
        where: {
          id: input.roleId,
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
          message: "System roles cannot be modified",
        });
      }

      // Check for name conflicts if name is being updated
      if (input.name && input.name !== existingRole.name) {
        const nameConflict = await ctx.db.role.findFirst({
          where: {
            name: input.name,
            organizationId: ctx.organization.id,
            id: { not: input.roleId },
          },
        });

        if (nameConflict) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Role name already exists",
          });
        }
      }

      // Update the role
      const updateData: { name?: string } = {};
      if (input.name !== undefined) updateData.name = input.name;

      const role = await ctx.db.role.update({
        where: { id: input.roleId },
        data: updateData,
        include: {
          permissions: true,
          _count: {
            select: { memberships: true },
          },
        },
      });

      // Update permissions if provided
      if (input.permissionIds) {
        await ctx.db.role.update({
          where: { id: input.roleId },
          data: {
            permissions: {
              set: input.permissionIds.map((id) => ({ id })),
            },
          },
        });
      }

      return {
        id: role.id,
        name: role.name,
        isSystem: role.isSystem,
        isDefault: role.isDefault,
        permissionCount: role.permissions.length,
        memberCount: role._count.memberships,
        permissions: role.permissions,
      };
    }),

  /**
   * Delete a role (non-system roles only)
   */
  deleteRole: roleManageProcedure
    .input(
      z.object({
        roleId: z.string(),
        reassignRoleId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get the role and verify it's not a system role
      const roleToDelete = await ctx.db.role.findUnique({
        where: {
          id: input.roleId,
          organizationId: ctx.organization.id,
        },
        include: {
          _count: {
            select: { memberships: true },
          },
        },
      });

      if (!roleToDelete) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Role not found",
        });
      }

      if (roleToDelete.isSystem) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "System roles cannot be deleted",
        });
      }

      // If role has members, reassign them
      if (roleToDelete._count.memberships > 0) {
        if (!input.reassignRoleId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Role has members. A reassignment role must be specified",
          });
        }

        // Verify reassignment role exists
        const reassignRole = await ctx.db.role.findUnique({
          where: {
            id: input.reassignRoleId,
            organizationId: ctx.organization.id,
          },
        });

        if (!reassignRole) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Reassignment role not found",
          });
        }

        // Reassign all members
        await ctx.db.membership.updateMany({
          where: {
            roleId: input.roleId,
            organizationId: ctx.organization.id,
          },
          data: {
            roleId: input.reassignRoleId,
          },
        });
      }

      // Delete the role
      await ctx.db.role.delete({
        where: { id: input.roleId },
      });

      return { success: true };
    }),

  /**
   * Get role details for view/edit
   */
  getRoleDetails: organizationManageProcedure
    .input(z.object({ roleId: z.string() }))
    .query(async ({ ctx, input }) => {
      const role = await ctx.db.role.findUnique({
        where: {
          id: input.roleId,
          organizationId: ctx.organization.id,
        },
        include: {
          permissions: true,
          _count: {
            select: { memberships: true },
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
        id: role.id,
        name: role.name,
        isSystem: role.isSystem,
        isDefault: role.isDefault,
        permissionCount: role.permissions.length,
        memberCount: role._count.memberships,
        permissions: role.permissions,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
      };
    }),

  /**
   * Get all users in organization with role info
   */
  getUsers: userManageProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.db.membership.findMany({
      where: { organizationId: ctx.organization.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profilePicture: true,
            createdAt: true,
            emailVerified: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
            isSystem: true,
          },
        },
      },
      orderBy: {
        user: { name: "asc" },
      },
    });

    return memberships.map((membership) => ({
      id: membership.user.id,
      name: membership.user.name,
      email: membership.user.email,
      profilePicture: membership.user.profilePicture,
      emailVerified: membership.user.emailVerified,
      createdAt: membership.user.createdAt,
      role: {
        id: membership.role.id,
        name: membership.role.name,
        isSystem: membership.role.isSystem,
      },
    }));
  }),

  /**
   * Update user role assignment
   */
  updateUserRole: userManageProcedure
    .input(
      z.object({
        userId: z.string(),
        roleId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the role exists in this organization
      const role = await ctx.db.role.findUnique({
        where: {
          id: input.roleId,
          organizationId: ctx.organization.id,
        },
      });

      if (!role) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Role not found",
        });
      }

      // Verify the user membership exists
      const membership = await ctx.db.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: input.userId,
            organizationId: ctx.organization.id,
          },
        },
      });

      if (!membership) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User is not a member of this organization",
        });
      }

      // Update the membership
      const updatedMembership = await ctx.db.membership.update({
        where: {
          userId_organizationId: {
            userId: input.userId,
            organizationId: ctx.organization.id,
          },
        },
        data: { roleId: input.roleId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              profilePicture: true,
            },
          },
          role: {
            select: {
              id: true,
              name: true,
              isSystem: true,
            },
          },
        },
      });

      return {
        success: true,
        user: {
          id: updatedMembership.user.id,
          name: updatedMembership.user.name,
          email: updatedMembership.user.email,
          profilePicture: updatedMembership.user.profilePicture,
          role: {
            id: updatedMembership.role.id,
            name: updatedMembership.role.name,
            isSystem: updatedMembership.role.isSystem,
          },
        },
      };
    }),

  /**
   * Get all available permissions grouped by category
   */
  getPermissions: organizationManageProcedure.query(async ({ ctx }) => {
    const permissions = await ctx.db.permission.findMany({
      orderBy: { name: "asc" },
    });

    // Group permissions by category (prefix before colon)
    const groupedPermissions: Record<string, typeof permissions> = {};

    permissions.forEach((permission) => {
      const category = permission.name.split(":")[0];
      if (!category) return; // Skip if no category found

      const categoryName = category.charAt(0).toUpperCase() + category.slice(1);

      groupedPermissions[categoryName] ??= [];
      groupedPermissions[categoryName].push(permission);
    });

    return groupedPermissions;
  }),
});
