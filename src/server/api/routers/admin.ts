import { TRPCError } from "@trpc/server";
import { eq, asc, desc, isNull, and } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter } from "../trpc";
import { userManageProcedure, roleManageProcedure } from "../trpc.permission";

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
  getUsers: userManageProcedure.query(async ({ ctx }) => {
    const members = await ctx.db
      .select({
        id: memberships.id,
        userId: memberships.userId,
        organizationId: memberships.organizationId,
        roleId: memberships.roleId,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          profilePicture: users.profilePicture,
          emailVerified: users.emailVerified,
          createdAt: users.createdAt,
        },
        role: {
          id: roles.id,
          name: roles.name,
          organizationId: roles.organizationId,
          isSystem: roles.isSystem,
          isDefault: roles.isDefault,
        },
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .innerJoin(roles, eq(memberships.roleId, roles.id))
      .where(eq(memberships.organizationId, ctx.organizationId))
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
  updateUserRole: userManageProcedure
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
            eq(roles.organizationId, ctx.organizationId),
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
          userId: memberships.userId,
          organizationId: memberships.organizationId,
          roleId: memberships.roleId,
          user: {
            id: users.id,
            name: users.name,
            email: users.email,
            profilePicture: users.profilePicture,
            emailVerified: users.emailVerified,
            createdAt: users.createdAt,
          },
          role: {
            id: roles.id,
            name: roles.name,
            organizationId: roles.organizationId,
            isSystem: roles.isSystem,
            isDefault: roles.isDefault,
          },
        })
        .from(memberships)
        .innerJoin(users, eq(memberships.userId, users.id))
        .innerJoin(roles, eq(memberships.roleId, roles.id))
        .where(
          and(
            eq(memberships.userId, input.userId),
            eq(memberships.organizationId, ctx.organizationId),
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
          userId: memberships.userId,
          organizationId: memberships.organizationId,
          roleId: memberships.roleId,
          user: {
            id: users.id,
            name: users.name,
            email: users.email,
            profilePicture: users.profilePicture,
            emailVerified: users.emailVerified,
            createdAt: users.createdAt,
          },
          role: {
            id: roles.id,
            name: roles.name,
            organizationId: roles.organizationId,
            isSystem: roles.isSystem,
            isDefault: roles.isDefault,
          },
        })
        .from(memberships)
        .innerJoin(users, eq(memberships.userId, users.id))
        .innerJoin(roles, eq(memberships.roleId, roles.id));
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
        .set({ roleId: input.roleId })
        .where(eq(memberships.userId, input.userId));

      // Fetch the updated membership with role and user data
      const [membership] = await ctx.db
        .select({
          id: memberships.id,
          userId: memberships.userId,
          organizationId: memberships.organizationId,
          roleId: memberships.roleId,
          role: {
            id: roles.id,
            name: roles.name,
            isSystem: roles.isSystem,
          },
          user: {
            id: users.id,
            name: users.name,
            email: users.email,
          },
        })
        .from(memberships)
        .innerJoin(users, eq(memberships.userId, users.id))
        .innerJoin(roles, eq(memberships.roleId, roles.id))
        .where(eq(memberships.userId, input.userId))
        .limit(1);

      return membership;
    }),

  /**
   * Invite a user to the organization
   */
  inviteUser: userManageProcedure
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
            eq(roles.organizationId, ctx.organizationId),
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
          emailVerified: null, // Will be set when they accept invitation
          profilePicture: null,
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
            eq(memberships.userId, user.id),
            eq(memberships.organizationId, ctx.organizationId),
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
        userId: user.id,
        organizationId: ctx.organization.id,
        roleId: input.roleId,
      };

      await ctx.db.insert(memberships).values(membershipData);

      // Fetch the created membership with user and role data
      const membershipResults = await ctx.db
        .select({
          id: memberships.id,
          userId: memberships.userId,
          organizationId: memberships.organizationId,
          roleId: memberships.roleId,
          user: {
            id: users.id,
            email: users.email,
            name: users.name,
            emailVerified: users.emailVerified,
          },
          role: {
            id: roles.id,
            name: roles.name,
          },
        })
        .from(memberships)
        .innerJoin(users, eq(memberships.userId, users.id))
        .innerJoin(roles, eq(memberships.roleId, roles.id))
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
        emailVerified: membership.user.emailVerified,
        role: membership.role,
        isInvitation: membership.user.emailVerified === null,
      };
    }),

  /**
   * Get pending invitations
   */
  getInvitations: userManageProcedure.query(async ({ ctx }) => {
    const invitations = await ctx.db
      .select({
        id: memberships.id,
        userId: memberships.userId,
        organizationId: memberships.organizationId,
        roleId: memberships.roleId,
        createdAt: users.createdAt,
        user: {
          id: users.id,
          email: users.email,
          name: users.name,
          createdAt: users.createdAt,
        },
        role: {
          id: roles.id,
          name: roles.name,
        },
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .innerJoin(roles, eq(memberships.roleId, roles.id))
      .where(
        and(
          isNull(users.emailVerified),
          eq(memberships.organizationId, ctx.organizationId),
        ),
      )
      .orderBy(desc(users.createdAt));

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
  removeUser: userManageProcedure
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
          userId: memberships.userId,
          organizationId: memberships.organizationId,
          roleId: memberships.roleId,
          user: {
            id: users.id,
            name: users.name,
            email: users.email,
          },
          role: {
            id: roles.id,
            name: roles.name,
            organizationId: roles.organizationId,
            isSystem: roles.isSystem,
            isDefault: roles.isDefault,
          },
        })
        .from(memberships)
        .innerJoin(users, eq(memberships.userId, users.id))
        .innerJoin(roles, eq(memberships.roleId, roles.id))
        .where(eq(memberships.userId, input.userId))
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
          userId: memberships.userId,
          organizationId: memberships.organizationId,
          roleId: memberships.roleId,
          user: {
            id: users.id,
            name: users.name,
            email: users.email,
            profilePicture: users.profilePicture,
            emailVerified: users.emailVerified,
            createdAt: users.createdAt,
          },
          role: {
            id: roles.id,
            name: roles.name,
            organizationId: roles.organizationId,
            isSystem: roles.isSystem,
            isDefault: roles.isDefault,
          },
        })
        .from(memberships)
        .innerJoin(users, eq(memberships.userId, users.id))
        .innerJoin(roles, eq(memberships.roleId, roles.id));
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
        .where(eq(memberships.userId, input.userId));

      return { success: true };
    }),

  /**
   * Delete a role with member reassignment
   */
  deleteRoleWithReassignment: roleManageProcedure
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
          userId: memberships.userId,
          organizationId: memberships.organizationId,
          roleId: memberships.roleId,
          user: {
            id: users.id,
            name: users.name,
            email: users.email,
          },
          role: {
            id: roles.id,
            name: roles.name,
            organizationId: roles.organizationId,
            isSystem: roles.isSystem,
            isDefault: roles.isDefault,
          },
        })
        .from(memberships)
        .innerJoin(users, eq(memberships.userId, users.id))
        .innerJoin(roles, eq(memberships.roleId, roles.id))
        .where(eq(memberships.roleId, input.roleId));

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
        organizationId: role.organizationId,
        isSystem: role.isSystem,
        isDefault: role.isDefault,
      };

      const validationReassignRole = reassignRole
        ? {
            id: reassignRole.id,
            name: reassignRole.name,
            organizationId: reassignRole.organizationId,
            isSystem: reassignRole.isSystem,
            isDefault: reassignRole.isDefault,
          }
        : null;

      // Convert memberships to validation interface
      const validationMemberships = roleWithMemberships.memberships.map(
        (m) => ({
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
          .set({ roleId: input.reassignRoleId })
          .where(eq(memberships.roleId, input.roleId));
      }

      // Delete the role
      await ctx.db.delete(roles).where(eq(roles.id, input.roleId));

      // Ensure we still have at least one admin after reassignment
      await ensureAtLeastOneAdmin(ctx.db, ctx.organization.id);

      return { success: true };
    }),

  /**
   * Cancel a user invitation
   */
  cancelInvitation: userManageProcedure
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
        .innerJoin(users, eq(memberships.userId, users.id))
        .where(
          and(
            eq(memberships.userId, input.userId),
            eq(memberships.organizationId, ctx.organizationId),
            isNull(users.emailVerified),
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
            eq(memberships.userId, input.userId),
            eq(memberships.organizationId, ctx.organizationId),
          ),
        );

      // Delete the user if they have no other memberships
      const [remainingMembership] = await ctx.db
        .select()
        .from(memberships)
        .where(eq(memberships.userId, input.userId))
        .limit(1);

      if (!remainingMembership) {
        await ctx.db.delete(users).where(eq(users.id, input.userId));
      }

      return { success: true };
    }),
});
