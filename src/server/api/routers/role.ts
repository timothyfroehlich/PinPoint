import { TRPCError } from "@trpc/server";
import { eq, and, count } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter } from "../trpc";
import {
  roleManageProcedure,
  organizationManageProcedure,
} from "../trpc.permission";

import type { TRPCContext } from "../trpc.base";

import { env } from "~/env.js";
import {
  validateRoleAssignment,
  type RoleAssignmentInput,
  type RoleManagementContext,
} from "~/lib/users/roleManagementValidation";
import { generatePrefixedId } from "~/lib/utils/id-generation";
import { ROLE_TEMPLATES } from "~/server/auth/permissions.constants";
import { roles, memberships } from "~/server/db/schema";
import { DrizzleRoleService } from "~/server/services/drizzleRoleService";
import { RoleService } from "~/server/services/roleService";

/**
 * Create appropriate role service based on context
 *
 * In test environments with PGlite, use DrizzleRoleService for native integration.
 * In production or when Prisma client is preferred, use RoleService.
 */
// Type-safe way to detect Vitest environment
function isVitestEnvironment(): boolean {
  return typeof globalThis !== "undefined" && "__vitest_worker__" in globalThis;
}

function createRoleService(
  ctx: TRPCContext,
  organizationId: string,
): RoleService | DrizzleRoleService {
  // Use DrizzleRoleService in test environments
  const isTestEnvironment = env.NODE_ENV === "test" || isVitestEnvironment();

  // If we're in a test environment and have Drizzle, use DrizzleRoleService
  if (isTestEnvironment) {
    return new DrizzleRoleService(ctx.drizzle, organizationId);
  }

  // Use RoleService with Prisma in production
  return new RoleService(ctx.db, organizationId, ctx.drizzle);
}

export const roleRouter = createTRPCRouter({
  /**
   * List all roles in the organization
   */
  list: organizationManageProcedure.query(async ({ ctx }) => {
    const roleService = createRoleService(ctx, ctx.organization.id);
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
      const roleService = createRoleService(ctx, ctx.organization.id);

      // If template is specified, create from template
      if (input.template) {
        return roleService.createTemplateRole(input.template, {
          name: input.name,
          isDefault: input.isDefault,
        });
      }

      // Otherwise create custom role
      const insertedRoles = await ctx.drizzle
        .insert(roles)
        .values({
          id: generatePrefixedId("role"),
          name: input.name,
          organizationId: ctx.organization.id,
          isSystem: false,
          isDefault: input.isDefault,
        })
        .returning();

      if (insertedRoles.length === 0) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to create role "${input.name}" for organization ${ctx.organization.id}`,
        });
      }

      const role = insertedRoles[0];
      // This should never happen since we checked length above, but TypeScript requires the check
      if (!role) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Role creation returned undefined result for "${input.name}" in organization ${ctx.organization.id}`,
        });
      }

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
      const roleService = createRoleService(ctx, ctx.organization.id);

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
      const roleService = createRoleService(ctx, ctx.organization.id);

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
      // Get role details
      const role = await ctx.drizzle.query.roles.findFirst({
        where: and(
          eq(roles.id, input.roleId),
          eq(roles.organizationId, ctx.organization.id),
        ),
        with: {
          rolePermissions: {
            with: {
              permission: true,
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

      // Get membership count
      const memberCountResult = await ctx.drizzle
        .select({ count: count() })
        .from(memberships)
        .where(eq(memberships.roleId, input.roleId));

      const memberCount = memberCountResult[0]?.count ?? 0;

      return {
        ...role,
        memberCount,
        permissions: role.rolePermissions.map((rp) => ({
          id: rp.permission.id,
          name: rp.permission.name,
          description: rp.permission.description,
        })),
      };
    }),

  /**
   * Get all available permissions
   */
  getPermissions: organizationManageProcedure.query(async ({ ctx }) => {
    const allPermissions = await ctx.drizzle.query.permissions.findMany({
      orderBy: (permissions, { asc }) => [asc(permissions.name)],
    });

    return allPermissions;
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
      const role = await ctx.drizzle.query.roles.findFirst({
        where: and(
          eq(roles.id, input.roleId),
          eq(roles.organizationId, ctx.organization.id),
        ),
      });

      if (!role) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Role not found",
        });
      }

      // Get the current user membership with user and role details
      const currentMembership = await ctx.drizzle.query.memberships.findFirst({
        where: and(
          eq(memberships.userId, input.userId),
          eq(memberships.organizationId, ctx.organization.id),
        ),
        with: {
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
      const allMemberships = await ctx.drizzle.query.memberships.findMany({
        where: eq(memberships.organizationId, ctx.organization.id),
        with: {
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

      // Convert Drizzle result to validation interface
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
      const updatedMemberships = await ctx.drizzle
        .update(memberships)
        .set({ roleId: input.roleId })
        .where(
          and(
            eq(memberships.userId, input.userId),
            eq(memberships.organizationId, ctx.organization.id),
          ),
        )
        .returning();

      if (updatedMemberships.length === 0) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to update membership for userId=${input.userId}, roleId=${input.roleId}, organizationId=${ctx.organization.id}`,
        });
      }

      const updatedMembership = updatedMemberships[0];
      // This should never happen since we checked length above, but TypeScript requires the check
      if (!updatedMembership) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Membership update returned undefined result for userId=${input.userId}, organizationId=${ctx.organization.id}`,
        });
      }

      // Get the updated membership with related data
      const membership = await ctx.drizzle.query.memberships.findFirst({
        where: eq(memberships.id, updatedMembership.id),
        with: {
          role: true,
          user: {
            columns: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (!membership) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to retrieve updated membership (membershipId: ${updatedMembership.id}, userId: ${input.userId}, organizationId: ${ctx.organization.id})`,
        });
      }

      return membership;
    }),
});
