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
      // PARALLEL VALIDATION: Execute both Prisma and Drizzle queries during migration
      // This ensures exact functional parity before switching fully to Drizzle

      // Prepare update data (same logic for both ORMs)
      const updateData: { name: string; logoUrl?: string } = {
        name: input.name,
      };
      if (input.logoUrl) {
        updateData.logoUrl = input.logoUrl;
      }

      // Execute Prisma query (current implementation)
      const prismaOrganization = await ctx.db.organization.update({
        where: {
          id: ctx.organization.id,
        },
        data: updateData,
      });

      // Execute Drizzle query (new implementation)
      const [drizzleOrganization] = await ctx.drizzle
        .update(organizations)
        .set(updateData)
        .where(eq(organizations.id, ctx.organization.id))
        .returning();

      // Validation: Ensure both queries return equivalent results
      if (!drizzleOrganization) {
        throw new Error(
          "Organization update failed - no result returned from Drizzle",
        );
      }

      // Compare critical fields to ensure parity
      if (
        prismaOrganization.id !== drizzleOrganization.id ||
        prismaOrganization.name !== drizzleOrganization.name ||
        prismaOrganization.logoUrl !== drizzleOrganization.logoUrl
      ) {
        console.error("MIGRATION WARNING: Prisma and Drizzle results differ", {
          prisma: prismaOrganization,
          drizzle: drizzleOrganization,
        });
        // For now, log the discrepancy but don't fail - return Prisma result for consistency
      }

      // Return Prisma result to maintain current behavior during parallel validation
      // TODO: Switch to drizzleOrganization after validation period
      return prismaOrganization;
    }),
});
