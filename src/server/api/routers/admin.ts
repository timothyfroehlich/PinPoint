import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { RoleService } from "../../services/roleService";
import { createTRPCRouter } from "../trpc";
import { userManageProcedure, roleManageProcedure } from "../trpc.permission";

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

      // After role change, ensure we still have at least one admin
      const roleService = new RoleService(ctx.db, ctx.organization.id);
      await roleService.ensureAtLeastOneAdmin();

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
      // Check if this is the last admin
      const membership = await ctx.db.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: input.userId,
            organizationId: ctx.organization.id,
          },
        },
        include: {
          role: true,
        },
      });

      if (!membership) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User is not a member of this organization",
        });
      }

      // If removing an admin, ensure we'll still have at least one admin
      if (membership.role.name === "Admin") {
        const adminCount = await ctx.db.membership.count({
          where: {
            organizationId: ctx.organization.id,
            role: {
              name: "Admin",
            },
          },
        });

        if (adminCount <= 1) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Cannot remove the last admin from the organization",
          });
        }
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
      const roleService = new RoleService(ctx.db, ctx.organization.id);

      const role = await ctx.db.role.findUnique({
        where: { id: input.roleId },
        include: { memberships: true },
      });

      if (!role) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Role not found",
        });
      }

      // Cannot delete system roles
      if (role.isSystem) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "System roles cannot be deleted",
        });
      }

      // If there are members, we need a reassignment role
      if (role.memberships.length > 0) {
        if (!input.reassignRoleId) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Must specify a role to reassign members to",
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

        // Reassign all members to the new role
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
      await roleService.ensureAtLeastOneAdmin();

      return { success: true };
    }),
});
