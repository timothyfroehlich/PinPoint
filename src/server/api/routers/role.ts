import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { ROLE_TEMPLATES } from "../../auth/permissions.constants";
import { RoleService } from "../../services/roleService";
import { createTRPCRouter } from "../trpc";
import {
  roleManageProcedure,
  organizationManageProcedure,
} from "../trpc.permission";

export const roleRouter = createTRPCRouter({
  /**
   * List all roles in the organization
   */
  list: organizationManageProcedure.query(async ({ ctx }) => {
    const roleService = new RoleService(ctx.db, ctx.organization.id);
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
      const roleService = new RoleService(ctx.db, ctx.organization.id);

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
      const roleService = new RoleService(ctx.db, ctx.organization.id);

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
      const roleService = new RoleService(ctx.db, ctx.organization.id);

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

      // After role change, ensure we still have at least one admin
      const roleService = new RoleService(ctx.db, ctx.organization.id);
      await roleService.ensureAtLeastOneAdmin();

      return membership;
    }),
});
