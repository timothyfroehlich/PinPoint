import { z } from "zod";

import {
  createTRPCRouter,
  publicProcedure,
  organizationManageProcedure,
} from "~/server/api/trpc";

export const organizationRouter = createTRPCRouter({
  getCurrent: publicProcedure.query(async ({ ctx }) => {
    // Return the organization from context (resolved based on subdomain)
    return ctx.organization;
  }),

  update: organizationManageProcedure
    .input(
      z.object({
        name: z.string().min(1),
        logoUrl: z.string().url().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const organization = await ctx.db.organization.update({
        where: {
          id: ctx.organization.id,
        },
        data: {
          name: input.name,
          logoUrl: input.logoUrl,
        },
      });
      return organization;
    }),
});
