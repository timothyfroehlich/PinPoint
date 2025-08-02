import { TRPCError } from "@trpc/server";
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
import { RoleService } from "~/server/services/roleService";

// Define interfaces for the include queries
interface MembershipWithUserAndRole {
  id: string;
  userId: string;
  organizationId: string;
  roleId: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    profilePicture: string | null;
    emailVerified: Date | null;
    createdAt: Date;
  };
  role: {
    id: string;
    name: string;
    isSystem: boolean;
  };
}

interface MembershipWithUserAndRoleUpdate {
  id: string;
  userId: string;
  organizationId: string;
  roleId: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  role: {
    id: string;
    name: string;
    isSystem: boolean;
  };
}

interface MembershipWithUserAndRoleInvite {
  id: string;
  userId: string;
  organizationId: string;
  roleId: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    emailVerified: Date | null;
  };
  role: {
    id: string;
    name: string;
  };
}

interface MembershipWithUserAndRoleInvitation {
  id: string;
  userId: string;
  organizationId: string;
  roleId: string;
  createdAt: Date;
  user: {
    id: string;
    email: string;
    name: string | null;
    createdAt: Date;
  };
  role: {
    id: string;
    name: string;
  };
}

export const adminRouter = createTRPCRouter({
  /**
   * Get all organization members with their roles
   */
  getUsers: userManageProcedure.query(async ({ ctx }) => {
    const members = (await ctx.db.membership.findMany({
      where: {
        organizationId: ctx.organization.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profilePicture: true,
            emailVerified: true,
            createdAt: true,
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
      orderBy: [{ role: { name: "asc" } }, { user: { name: "asc" } }],
    })) as MembershipWithUserAndRole[];

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

      // Convert Prisma result to validation interface
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
      const membership = (await ctx.db.membership.update({
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
      })) as MembershipWithUserAndRoleUpdate;

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

      // Check if user already exists
      let user = await ctx.db.user.findUnique({
        where: { email: input.email },
      });

      // Create user if they don't exist (pre-creation for invitation)
      if (!user) {
        const userData: { email: string; name?: string; emailVerified: null } =
          {
            email: input.email,
            emailVerified: null, // Will be set when they accept invitation
          };
        userData.name ??= input.name ?? input.email.split("@")[0] ?? "User";

        user = await ctx.db.user.create({
          data: userData,
        });
      }

      // Check if membership already exists
      const existingMembership = await ctx.db.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: ctx.organization.id,
          },
        },
      });

      if (existingMembership) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User is already a member of this organization",
        });
      }

      // Create membership
      const membership = (await ctx.db.membership.create({
        data: {
          userId: user.id,
          organizationId: ctx.organization.id,
          roleId: input.roleId,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              emailVerified: true,
            },
          },
          role: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })) as MembershipWithUserAndRoleInvite;

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
    const invitations = await ctx.db.membership.findMany({
      where: {
        organizationId: ctx.organization.id,
        user: {
          emailVerified: null,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        user: {
          createdAt: "desc",
        },
      },
    });

    const typedInvitations =
      invitations as MembershipWithUserAndRoleInvitation[];

    return typedInvitations.map((invitation) => ({
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
      const membership = await ctx.db.membership.findUnique({
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

      if (!membership) {
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

      const context: RoleManagementContext = {
        organizationId: ctx.organization.id,
        actorUserId: ctx.user.id,
        userPermissions: ctx.userPermissions,
      };

      // Convert Prisma result to validation interface
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
      await ctx.db.membership.delete({
        where: {
          userId_organizationId: {
            userId: input.userId,
            organizationId: ctx.organization.id,
          },
        },
      });

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
      // Get the role to delete with memberships
      const role = await ctx.db.role.findUnique({
        where: {
          id: input.roleId,
          organizationId: ctx.organization.id,
        },
        include: {
          memberships: {
            include: {
              user: true,
              role: true,
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

      // Get reassignment role if specified
      let reassignRole = null;
      if (input.reassignRoleId) {
        reassignRole = await ctx.db.role.findUnique({
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
      const validationMemberships = role.memberships.map((m) => ({
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
      if (role.memberships.length > 0 && input.reassignRoleId) {
        await ctx.db.membership.updateMany({
          where: { roleId: input.roleId },
          data: { roleId: input.reassignRoleId },
        });
      }

      // Delete the role
      await ctx.db.role.delete({
        where: { id: input.roleId },
      });

      // Ensure we still have at least one admin after reassignment
      const roleService = new RoleService(ctx.db, ctx.organization.id);
      await roleService.ensureAtLeastOneAdmin();

      return { success: true };
    }),
});
