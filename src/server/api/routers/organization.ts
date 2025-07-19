import { z } from "zod";
import { type Organization } from "@prisma/client";

import {
  createTRPCRouter,
  publicProcedure,
  organizationManageProcedure,
} from "~/server/api/trpc";

export const organizationRouter = createTRPCRouter({
  getCurrent: publicProcedure.query(({ ctx }): Organization | null => {
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
    .mutation(async ({ ctx, input }): Promise<Organization> => {
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
