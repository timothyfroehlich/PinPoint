import { TRPCError } from "@trpc/server";
import { eq, asc, desc, isNull, and } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, organizationProcedure } from "../trpc";

import {
  validateRoleAssignment,
  validateUserRemoval,
  validateRoleReassignment,
  type RoleAssignmentInput,
  type RoleReassignmentInput,
  type RoleManagementContext,
} from "~/lib/users/roleManagementValidation";
import { generatePrefixedId } from "~/lib/utils/id-generation";
import {
  transformMembershipForValidation,
  transformMembershipsForValidation,
  transformRoleForValidation,
} from "~/lib/utils/membership-transformers";
import { users, memberships, roles } from "~/server/db/schema";
import { ensureAtLeastOneAdmin } from "~/server/db/utils/role-validation";

export const adminRouter = createTRPCRouter({
  /**
   * Get all organization members with their roles
   */
  getUsers: organizationProcedure.query(async ({ ctx }) => {
    const members = await ctx.db
      .select({
        id: memberships.id,
        userId: memberships.user_id, // alias db user_id -> userId
        organizationId: memberships.organization_id, // alias db organization_id -> organizationId
        roleId: memberships.role_id, // alias db role_id -> roleId
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          profilePicture: users.profile_picture, // db profile_picture
          emailVerified: users.email_verified, // db email_verified
          createdAt: users.created_at, // db created_at
        },
        role: {
          id: roles.id,
          name: roles.name,
          organizationId: roles.organization_id, // db organization_id
          isSystem: roles.is_system, // db is_system
          isDefault: roles.is_default, // db is_default
        },
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.user_id, users.id))
      .innerJoin(roles, eq(memberships.role_id, roles.id))
      .where(eq(memberships.organization_id, ctx.organizationId))
      .orderBy(asc(roles.name), asc(users.name));

    return members.map((member) => ({
      userId: member.user.id,
      email: member.user.email,
      name: member.user.name ?? "",
      profilePicture: member.user.profilePicture,
      emailVerified: member.user.emailVerified,
      createdAt: member.user.createdAt,
      membershipId: member.id,
      role: {
        id: member.role.id,
        name: member.role.name,
        isSystem: member.role.isSystem,
      },
    }));
  }),

  /**
   * Update a user's role assignment
   */
  updateUserRole: organizationProcedure
    .input(
      z.object({
        userId: z.string(),
        roleId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get the target role and verify it exists in this organization
      const [role] = await ctx.db
        .select()
        .from(roles)
        .where(
          and(
            eq(roles.id, input.roleId),
            eq(roles.organization_id, ctx.organizationId),
          ),
        )
        .limit(1);

      if (!role) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Role not found",
        });
      }

      // Get the current user membership
      const membershipResults = await ctx.db
        .select({
          id: memberships.id,
          userId: memberships.user_id,
          organizationId: memberships.organization_id,
          roleId: memberships.role_id,
          user: {
            id: users.id,
            name: users.name,
            email: users.email,
            profilePicture: users.profile_picture,
            emailVerified: users.email_verified,
            createdAt: users.created_at,
          },
          role: {
            id: roles.id,
            name: roles.name,
            organizationId: roles.organization_id,
            isSystem: roles.is_system,
            isDefault: roles.is_default,
          },
        })
        .from(memberships)
        .innerJoin(users, eq(memberships.user_id, users.id))
        .innerJoin(roles, eq(memberships.role_id, roles.id))
        .where(
          and(
            eq(memberships.user_id, input.userId),
            eq(memberships.organization_id, ctx.organizationId),
          ),
        )
        .limit(1);

      const currentMembership = membershipResults[0];

      if (!currentMembership) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User is not a member of this organization",
        });
      }

      // Get all memberships for validation
      const allMemberships = await ctx.db
        .select({
          id: memberships.id,
          userId: memberships.user_id,
          organizationId: memberships.organization_id,
          roleId: memberships.role_id,
          user: {
            id: users.id,
            name: users.name,
            email: users.email,
            profilePicture: users.profile_picture,
            emailVerified: users.email_verified,
            createdAt: users.created_at,
          },
          role: {
            id: roles.id,
            name: roles.name,
            organizationId: roles.organization_id,
            isSystem: roles.is_system,
            isDefault: roles.is_default,
          },
        })
        .from(memberships)
        .innerJoin(users, eq(memberships.user_id, users.id))
        .innerJoin(roles, eq(memberships.role_id, roles.id));
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
      const validationMembership =
        transformMembershipForValidation(currentMembership);

      const validationAllMemberships =
        transformMembershipsForValidation(allMemberships);

      const validationRole = transformRoleForValidation(role);

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
      await ctx.db
        .update(memberships)
        .set({ role_id: input.roleId })
        .where(eq(memberships.user_id, input.userId));

      // Fetch the updated membership with role and user data
      const [membership] = await ctx.db
        .select({
          id: memberships.id,
          userId: memberships.user_id,
          organizationId: memberships.organization_id,
          roleId: memberships.role_id,
          role: {
            id: roles.id,
            name: roles.name,
            isSystem: roles.is_system,
          },
          user: {
            id: users.id,
            name: users.name,
            email: users.email,
          },
        })
        .from(memberships)
        .innerJoin(users, eq(memberships.user_id, users.id))
        .innerJoin(roles, eq(memberships.role_id, roles.id))
        .where(eq(memberships.user_id, input.userId))
        .limit(1);

      return membership;
    }),

  /**
   * Invite a user to the organization
   */
  inviteUser: organizationProcedure
    .input(
      z.object({
        email: z.email(),
        roleId: z.string(),
        name: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the role exists in this organization
      const [role] = await ctx.db
        .select()
        .from(roles)
        .where(
          and(
            eq(roles.id, input.roleId),
            eq(roles.organization_id, ctx.organizationId),
          ),
        )
        .limit(1);

      if (!role) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Role not found",
        });
      }

      // Check if user already exists
      const userResults = await ctx.db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      let user = userResults[0] ?? null;

      // Create user if they don't exist (pre-creation for invitation)
      if (!user) {
        const userData = {
          id: generatePrefixedId("user"),
          email: input.email,
          name: input.name ?? input.email.split("@")[0] ?? "User",
          email_verified: null, // Will be set when they accept invitation
          profile_picture: null,
        };

        const insertedUsers = await ctx.db
          .insert(users)
          .values(userData)
          .returning();
        const insertedUser = insertedUsers[0];
        if (!insertedUser) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create user",
          });
        }
        user = insertedUser;
      }

      // Check if membership already exists in this organization
      const [existingMembership] = await ctx.db
        .select()
        .from(memberships)
        .where(
          and(
            eq(memberships.user_id, user.id),
            eq(memberships.organization_id, ctx.organizationId),
          ),
        )
        .limit(1);

      if (existingMembership) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User is already a member of this organization",
        });
      }

      // Create membership
      const membershipData = {
        id: generatePrefixedId("membership"),
        user_id: user.id,
        organization_id: ctx.organization.id,
        role_id: input.roleId,
      };

      await ctx.db.insert(memberships).values(membershipData);

      // Fetch the created membership with user and role data
      const membershipResults = await ctx.db
        .select({
          id: memberships.id,
          userId: memberships.user_id,
          organizationId: memberships.organization_id,
          roleId: memberships.role_id,
          user: {
            id: users.id,
            email: users.email,
            name: users.name,
            emailVerified: users.email_verified,
          },
          role: {
            id: roles.id,
            name: roles.name,
          },
        })
        .from(memberships)
        .innerJoin(users, eq(memberships.user_id, users.id))
        .innerJoin(roles, eq(memberships.role_id, roles.id))
        .where(eq(memberships.id, membershipData.id))
        .limit(1);

      const membership = membershipResults[0];
      if (!membership) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create membership",
        });
      }

      // TODO: Send invitation email here
      // For now, we'll just return the membership

      return {
        userId: membership.user.id,
        email: membership.user.email,
        name: membership.user.name,
        emailVerified: membership.user.emailVerified, // alias preserves camelCase
        role: membership.role,
        isInvitation: membership.user.emailVerified === null,
      };
    }),

  /**
   * Get pending invitations
   */
  getInvitations: organizationProcedure.query(async ({ ctx }) => {
    const invitations = await ctx.db
      .select({
        id: memberships.id,
        userId: memberships.user_id,
        organizationId: memberships.organization_id,
        roleId: memberships.role_id,
        createdAt: users.created_at,
        user: {
          id: users.id,
          email: users.email,
          name: users.name,
          createdAt: users.created_at,
        },
        role: {
          id: roles.id,
          name: roles.name,
        },
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.user_id, users.id))
      .innerJoin(roles, eq(memberships.role_id, roles.id))
      .where(
        and(
          isNull(users.email_verified),
          eq(memberships.organization_id, ctx.organizationId),
        ),
      )
      .orderBy(desc(users.created_at));

    return invitations.map((invitation) => ({
      userId: invitation.user.id,
      email: invitation.user.email,
      name: invitation.user.name,
      createdAt: invitation.user.createdAt,
      role: invitation.role,
    }));
  }),

  /**
   * Remove a user from the organization
   */
  removeUser: organizationProcedure
    .input(
      z.object({
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get the user membership to remove
      const [membership] = await ctx.db
        .select({
          id: memberships.id,
          userId: memberships.user_id,
          organizationId: memberships.organization_id,
          roleId: memberships.role_id,
          user: {
            id: users.id,
            name: users.name,
            email: users.email,
          },
          role: {
            id: roles.id,
            name: roles.name,
            organizationId: roles.organization_id,
            isSystem: roles.is_system,
            isDefault: roles.is_default,
          },
        })
        .from(memberships)
        .innerJoin(users, eq(memberships.user_id, users.id))
        .innerJoin(roles, eq(memberships.role_id, roles.id))
        .where(eq(memberships.user_id, input.userId))
        .limit(1);

      if (!membership) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User is not a member of this organization",
        });
      }

      // Get all memberships for validation
      const allMemberships = await ctx.db
        .select({
          id: memberships.id,
          userId: memberships.user_id,
          organizationId: memberships.organization_id,
          roleId: memberships.role_id,
          user: {
            id: users.id,
            name: users.name,
            email: users.email,
            profilePicture: users.profile_picture,
            emailVerified: users.email_verified,
            createdAt: users.created_at,
          },
          role: {
            id: roles.id,
            name: roles.name,
            organizationId: roles.organization_id,
            isSystem: roles.is_system,
            isDefault: roles.is_default,
          },
        })
        .from(memberships)
        .innerJoin(users, eq(memberships.user_id, users.id))
        .innerJoin(roles, eq(memberships.role_id, roles.id));
      const context: RoleManagementContext = {
        organizationId: ctx.organization.id,
        actorUserId: ctx.user.id,
        userPermissions: ctx.userPermissions,
      };

      // Convert database result to validation interface
      const validationMembership = {
        id: membership.id,
        userId: membership.userId,
        organizationId: membership.organizationId,
        roleId: membership.roleId,
        user: {
          id: membership.user.id,
          name: membership.user.name,
          email: membership.user.email ?? "",
        },
        role: {
          id: membership.role.id,
          name: membership.role.name,
          organizationId: membership.role.organizationId,
          isSystem: membership.role.isSystem,
          isDefault: membership.role.isDefault,
        },
      };

      const validationAllMemberships =
        transformMembershipsForValidation(allMemberships);

      // Validate user removal using pure functions
      const validation = validateUserRemoval(
        validationMembership,
        validationAllMemberships,
        context,
      );

      if (!validation.valid) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: validation.error ?? "User removal validation failed",
        });
      }

      // Remove the membership
      await ctx.db
        .delete(memberships)
        .where(eq(memberships.user_id, input.userId));

      return { success: true };
    }),

  /**
   * Delete a role with member reassignment
   */
  deleteRoleWithReassignment: organizationProcedure
    .input(
      z.object({
        roleId: z.string(),
        reassignRoleId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get the role to delete
      const [role] = await ctx.db
        .select()
        .from(roles)
        .where(eq(roles.id, input.roleId))
        .limit(1);

      if (!role) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Role not found",
        });
      }

      // Get memberships associated with the role
      const roleMemberships = await ctx.db
        .select({
          id: memberships.id,
          userId: memberships.user_id,
          organizationId: memberships.organization_id,
          roleId: memberships.role_id,
          user: {
            id: users.id,
            name: users.name,
            email: users.email,
          },
          role: {
            id: roles.id,
            name: roles.name,
            organizationId: roles.organization_id,
            isSystem: roles.is_system,
            isDefault: roles.is_default,
          },
        })
        .from(memberships)
        .innerJoin(users, eq(memberships.user_id, users.id))
        .innerJoin(roles, eq(memberships.role_id, roles.id))
        .where(eq(memberships.role_id, input.roleId));

      // Construct the role object with memberships to match the original structure
      const roleWithMemberships = {
        ...role,
        memberships: roleMemberships,
      };

      // Get reassignment role if specified
      let reassignRole = null;
      if (input.reassignRoleId) {
        [reassignRole] = await ctx.db
          .select()
          .from(roles)
          .where(eq(roles.id, input.reassignRoleId))
          .limit(1);

        if (!reassignRole) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Reassignment role not found",
          });
        }
      }

      const context: RoleManagementContext = {
        organizationId: ctx.organization.id,
        actorUserId: ctx.user.id,
        userPermissions: ctx.userPermissions,
      };

      // Create validation input
      const validationInput: RoleReassignmentInput = {
        roleId: input.roleId,
        organizationId: ctx.organization.id,
        ...(input.reassignRoleId && { reassignRoleId: input.reassignRoleId }),
      };

      // Convert role to validation interface
      const validationRoleToDelete = {
        id: role.id,
        name: role.name,
        organizationId: role.organization_id,
        isSystem: role.is_system,
        isDefault: role.is_default,
      };

      const validationReassignRole = reassignRole
        ? {
            id: reassignRole.id,
            name: reassignRole.name,
            organizationId: reassignRole.organization_id,
            isSystem: reassignRole.is_system,
            isDefault: reassignRole.is_default,
          }
        : null;

      // Convert memberships to validation interface
      const validationMemberships = roleWithMemberships.memberships.map(
        (m) => ({
          id: m.id,
          userId: m.userId, // already aliased in select
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
        }),
      );

      // Validate role reassignment using pure functions
      const validation = validateRoleReassignment(
        validationInput,
        validationRoleToDelete,
        validationReassignRole,
        validationMemberships,
        context,
      );

      if (!validation.valid) {
        throw new TRPCError({
          code: validation.error?.includes("System roles")
            ? "FORBIDDEN"
            : "PRECONDITION_FAILED",
          message: validation.error ?? "Role reassignment validation failed",
        });
      }

      // If there are members, reassign them to the new role
      if (roleWithMemberships.memberships.length > 0 && input.reassignRoleId) {
        await ctx.db
          .update(memberships)
          .set({ role_id: input.reassignRoleId })
          .where(eq(memberships.role_id, input.roleId));
      }

      // Delete the role
      await ctx.db.delete(roles).where(eq(roles.id, input.roleId));
      // roles table already uses snake_case for organization_id etc; no change needed here besides prior updates

      // Ensure we still have at least one admin after reassignment
      await ensureAtLeastOneAdmin(ctx.db, ctx.organization.id);

      return { success: true };
    }),

  /**
   * Cancel a user invitation
   */
  cancelInvitation: organizationProcedure
    .input(
      z.object({
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Find the invitation (user with null emailVerified in this organization)
      const [invitation] = await ctx.db
        .select()
        .from(memberships)
        .innerJoin(users, eq(memberships.user_id, users.id))
        .where(
          and(
            eq(memberships.user_id, input.userId),
            eq(memberships.organization_id, ctx.organizationId),
            isNull(users.email_verified),
          ),
        )
        .limit(1);

      if (!invitation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation not found",
        });
      }

      // Delete the membership
      await ctx.db
        .delete(memberships)
        .where(
          and(
            eq(memberships.user_id, input.userId),
            eq(memberships.organization_id, ctx.organizationId),
          ),
        );

      // Delete the user if they have no other memberships
      const [remainingMembership] = await ctx.db
        .select()
        .from(memberships)
        .where(eq(memberships.user_id, input.userId))
        .limit(1);

      if (!remainingMembership) {
        await ctx.db.delete(users).where(eq(users.id, input.userId));
      }

      return { success: true };
    }),
});
