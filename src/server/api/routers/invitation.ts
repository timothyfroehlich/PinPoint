import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { InvitationService } from "~/server/services/invitationService";

const createInvitationSchema = z.object({
  email: z
    .string()
    .min(1)
    .refine(
      (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
      },
      {
        message: "Please enter a valid email address",
      },
    ),
  roleId: z.string().min(1, "Please select a role"),
  message: z.string().optional(),
});

const revokeInvitationSchema = z.object({
  invitationId: z.string(),
});

export const invitationRouter = createTRPCRouter({
  /**
   * Create a new invitation
   */
  create: protectedProcedure
    .input(createInvitationSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session.user.organizationId) {
        throw new Error(
          "You must be part of an organization to send invitations",
        );
      }

      const invitationService = new InvitationService(ctx.db);

      // Handle optional message properly for strictest TypeScript
      const invitationData = {
        email: input.email,
        organizationId: ctx.session.user.organizationId,
        invitedBy: ctx.session.user.id,
        roleId: input.roleId,
        ...(input.message !== undefined && { message: input.message }),
      };

      return invitationService.createInvitation(invitationData);
    }),

  /**
   * Get all invitations for the current organization
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.session.user.organizationId) {
      throw new Error(
        "You must be part of an organization to view invitations",
      );
    }

    const invitationService = new InvitationService(ctx.db);

    return invitationService.getOrganizationInvitations(
      ctx.session.user.organizationId,
    );
  }),

  /**
   * Revoke an invitation
   */
  revoke: protectedProcedure
    .input(revokeInvitationSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session.user.organizationId) {
        throw new Error(
          "You must be part of an organization to revoke invitations",
        );
      }

      const invitationService = new InvitationService(ctx.db);

      await invitationService.revokeInvitation(
        input.invitationId,
        ctx.session.user.organizationId,
      );

      return { success: true };
    }),

  /**
   * Get available roles for invitations
   */
  getRoles: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.session.user.organizationId) {
      throw new Error("You must be part of an organization to view roles");
    }

    return ctx.db.role.findMany({
      where: {
        organizationId: ctx.session.user.organizationId,
      },
      select: {
        id: true,
        name: true,
        isSystem: true,
      },
      orderBy: {
        name: "asc",
      },
    });
  }),
});
