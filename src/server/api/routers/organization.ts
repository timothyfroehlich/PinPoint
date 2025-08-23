import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import {
  createTRPCRouter,
  publicProcedure,
  organizationManageProcedure,
} from "~/server/api/trpc";
import { organizations } from "~/server/db/schema";

export const organizationRouter = createTRPCRouter({
  getCurrent: publicProcedure.query(({ ctx }) => {
    // Return the organization from context (resolved based on subdomain)
    return ctx.organization;
  }),

  update: organizationManageProcedure
    .input(
      z.object({
        name: z.string().min(1),
        logoUrl: z.url().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Prepare update data
      const updateData: { name: string; logoUrl?: string } = {
        name: input.name,
      };
      if (input.logoUrl) {
        updateData.logoUrl = input.logoUrl;
      }

      // Execute Drizzle update
      const [organization] = await ctx.db
        .update(organizations)
        .set(updateData)
        .where(eq(organizations.id, ctx.organization.id))
        .returning();

      if (!organization) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found or update failed",
        });
      }

      return organization;
    }),
});
