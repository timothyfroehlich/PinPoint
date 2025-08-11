import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter } from "../trpc";
import {
  roleManageProcedure,
  organizationManageProcedure,
} from "../trpc.permission";

import {
  validateRoleAssignment,
  type RoleAssignmentInput,
  type RoleManagementContext,
} from "~/lib/users/roleManagementValidation";
import { ROLE_TEMPLATES } from "~/server/auth/permissions.constants";
import { RoleService } from "~/server/services/roleService";

export const roleRouter = createTRPCRouter({
  /**
   * List all roles in the organization
   */
  list: organizationManageProcedure.query(async ({ ctx }) => {
    const roleService = new RoleService(
      ctx.db,
      ctx.organization.id,
      ctx.drizzle,
    );
    const roles = await roleService.getRoles();

    return roles.map(
      (role: {
        id: string;
        name: string;
        organizationId: string;
        isSystem: boolean;
        isDefault: boolean;
        createdAt: Date;
        updatedAt: Date;
        permissions: { id: string; name: string }[];
        _count: { memberships: number };
      }) => ({
        ...role,
        memberCount: role._count.memberships,
        permissions: role.permissions.map(
          (p: { id: string; name: string }) => ({
            id: p.id,
            name: p.name,
            description: null,
          }),
        ),
      }),
    );
  }),

  /**
   * Create a new role
   */
  create: roleManageProcedure
    .input(
      z.object({
        name: z.string().min(1).max(50),
        permissionIds: z.array(z.string()).optional(),
        template: z
          .enum(Object.keys(ROLE_TEMPLATES) as [keyof typeof ROLE_TEMPLATES])
          .optional(),
        isDefault: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const roleService = new RoleService(
        ctx.db,
        ctx.organization.id,
        ctx.drizzle,
      );

      // If template is specified, create from template
      if (input.template) {
        return roleService.createTemplateRole(input.template, {
          name: input.name,
          isDefault: input.isDefault,
        });
      }

      // Otherwise create custom role
      const role = await ctx.db.role.create({
        data: {
          name: input.name,
          organizationId: ctx.organization.id,
          isSystem: false,
          isDefault: input.isDefault,
        },
      });

      // Assign permissions if provided
      if (input.permissionIds && input.permissionIds.length > 0) {
        await roleService.updateRole(role.id, {
          permissionIds: input.permissionIds,
        });
      }

      return role;
    }),

  /**
   * Update an existing role
   */
  update: roleManageProcedure
    .input(
      z.object({
        roleId: z.string(),
        name: z.string().min(1).max(50).optional(),
        permissionIds: z.array(z.string()).optional(),
        isDefault: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const roleService = new RoleService(
        ctx.db,
        ctx.organization.id,
        ctx.drizzle,
      );

      const updateData: {
        name?: string;
        permissionIds?: string[];
        isDefault?: boolean;
      } = {};

      if (input.name !== undefined) updateData.name = input.name;
      if (input.permissionIds !== undefined)
        updateData.permissionIds = input.permissionIds;
      if (input.isDefault !== undefined) updateData.isDefault = input.isDefault;

      return roleService.updateRole(input.roleId, updateData);
    }),

  /**
   * Delete a role
   */
  delete: roleManageProcedure
    .input(
      z.object({
        roleId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const roleService = new RoleService(
        ctx.db,
        ctx.organization.id,
        ctx.drizzle,
      );

      // Ensure we maintain at least one admin before deletion
      await roleService.ensureAtLeastOneAdmin();

      await roleService.deleteRole(input.roleId);

      return { success: true };
    }),

  /**
   * Get a specific role by ID
   */
  get: organizationManageProcedure
    .input(
      z.object({
        roleId: z.string(),
      }),
    )
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
        ...role,
        memberCount: role._count.memberships,
        permissions: role.permissions.map(
          (p: { id: string; name: string; description: string | null }) => ({
            id: p.id,
            name: p.name,
            description: p.description,
          }),
        ),
      };
    }),

  /**
   * Get all available permissions
   */
  getPermissions: organizationManageProcedure.query(async ({ ctx }) => {
    const permissions = await ctx.db.permission.findMany({
      orderBy: { name: "asc" },
    });

    return permissions;
  }),

  /**
   * Get role templates available for creation
   */
  getTemplates: organizationManageProcedure.query(() => {
    return Object.entries(ROLE_TEMPLATES).map(([key, template]) => ({
      key,
      ...template,
    }));
  }),

  /**
   * Assign a role to a user (change user's role)
   */
  assignToUser: roleManageProcedure
    .input(
      z.object({
        userId: z.string(),
        roleId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get the target role and verify it exists in this organization
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

      // Get the current user membership
      const currentMembership = await ctx.db.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: input.userId,
            organizationId: ctx.organization.id,
          },
        },
        include: {
          user: true,
          role: true,
        },
      });

      if (!currentMembership) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User is not a member of this organization",
        });
      }

      // Get all memberships for validation
      const allMemberships = await ctx.db.membership.findMany({
        where: {
          organizationId: ctx.organization.id,
        },
        include: {
          user: true,
          role: true,
        },
      });

      // Create validation input
      const validationInput: RoleAssignmentInput = {
        userId: input.userId,
        roleId: input.roleId,
        organizationId: ctx.organization.id,
      };

      const context: RoleManagementContext = {
        organizationId: ctx.organization.id,
        actorUserId: ctx.user.id,
        userPermissions: ctx.userPermissions,
      };

      // Convert database result to validation interface
      const validationMembership = {
        id: currentMembership.id,
        userId: currentMembership.userId,
        organizationId: currentMembership.organizationId,
        roleId: currentMembership.roleId,
        user: {
          id: currentMembership.user.id,
          name: currentMembership.user.name,
          email: currentMembership.user.email ?? "",
        },
        role: {
          id: currentMembership.role.id,
          name: currentMembership.role.name,
          organizationId: currentMembership.role.organizationId,
          isSystem: currentMembership.role.isSystem,
          isDefault: currentMembership.role.isDefault,
        },
      };

      const validationAllMemberships = allMemberships.map((m) => ({
        id: m.id,
        userId: m.userId,
        organizationId: m.organizationId,
        roleId: m.roleId,
        user: {
          id: m.user.id,
          name: m.user.name,
          email: m.user.email ?? "",
        },
        role: {
          id: m.role.id,
          name: m.role.name,
          organizationId: m.role.organizationId,
          isSystem: m.role.isSystem,
          isDefault: m.role.isDefault,
        },
      }));

      const validationRole = {
        id: role.id,
        name: role.name,
        organizationId: role.organizationId,
        isSystem: role.isSystem,
        isDefault: role.isDefault,
      };

      // Validate the role assignment using pure functions
      const validation = validateRoleAssignment(
        validationInput,
        validationRole,
        validationMembership,
        validationAllMemberships,
        context,
      );

      if (!validation.valid) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: validation.error ?? "Role assignment validation failed",
        });
      }

      // Update the user's membership
      const membership = await ctx.db.membership.update({
        where: {
          userId_organizationId: {
            userId: input.userId,
            organizationId: ctx.organization.id,
          },
        },
        data: {
          roleId: input.roleId,
        },
        include: {
          role: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return membership;
    }),
});
