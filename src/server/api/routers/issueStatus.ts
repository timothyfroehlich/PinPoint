import { StatusCategory } from "@prisma/client";
import { z } from "zod";

import {
  createTRPCRouter,
  organizationProcedure,
  organizationManageProcedure,
} from "~/server/api/trpc";

export const issueStatusRouter = createTRPCRouter({
  getAll: organizationProcedure.query(async ({ ctx }) => {
    return ctx.db.issueStatus.findMany({
      where: {
        organizationId: ctx.organization.id,
      },
      orderBy: { name: "asc" },
    });
  }),

  create: organizationManageProcedure
    .input(
      z.object({
        name: z.string().min(1).max(50),
        category: z.enum(Object.values(StatusCategory) as [string, ...string[]]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.issueStatus.create({
        data: {
          name: input.name,
          category: input.category,
          organizationId: ctx.organization.id,
        },
      });
    }),

  update: organizationManageProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(50).optional(),
        category: z.enum(Object.values(StatusCategory) as [string, ...string[]]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.issueStatus.update({
        where: {
          id: input.id,
          organizationId: ctx.organization.id, // Ensure user can only update their org's statuses
        },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.category && { category: input.category }),
        },
      });
    }),

  delete: organizationManageProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check if any issues are using this status
      const issuesWithStatus = await ctx.db.issue.count({
        where: {
          statusId: input.id,
          organizationId: ctx.organization.id,
        },
      });

      if (issuesWithStatus > 0) {
        throw new Error(
          "Cannot delete status that is currently being used by issues",
        );
      }

      return ctx.db.issueStatus.delete({
        where: {
          id: input.id,
          organizationId: ctx.organization.id, // Ensure user can only delete their org's statuses
        },
      });
    }),
});
