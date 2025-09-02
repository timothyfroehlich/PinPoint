// External libraries (alphabetical)
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

// Internal types (alphabetical)
import type {
  OrganizationResponse,
  PublicOrganizationMinimal,
} from "~/lib/types/api";

// Internal utilities (alphabetical)
import { transformKeysToCamelCase } from "~/lib/utils/case-transformers";

// Server modules (alphabetical)
import {
  createTRPCRouter,
  organizationManageProcedure,
  publicProcedure,
} from "~/server/api/trpc";

// Database schema (alphabetical)
import { organizations } from "~/server/db/schema";
import { type Organization } from "~/server/db/types";

export const organizationRouter = createTRPCRouter({
  getCurrent: publicProcedure.query(({ ctx }): OrganizationResponse | null => {
    // Return the organization from context (resolved based on subdomain)
    if (!ctx.organization) {
      return null;
    }
    return transformKeysToCamelCase(ctx.organization) as OrganizationResponse;
  }),

  update: organizationManageProcedure
    .input(
      z.object({
        name: z.string().min(1),
        logoUrl: z.url().optional(),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<Organization> => {
      const updateData = {
        name: input.name,
        ...(input.logoUrl ? { logo_url: input.logoUrl } : {}),
      };

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

  // Public minimal listing for sign-in/landing (anon-safe)
  listPublic: publicProcedure.query(
    async ({ ctx }): Promise<PublicOrganizationMinimal[]> => {
      const result = await ctx.db.execute(
        sql`SELECT id, name, subdomain, logo_url FROM public_organizations_minimal ORDER BY name`,
      );

      // Convert RowList to typed array (TypeScript requires 'unknown' intermediate step)
      const rows = result as unknown as {
        id: string;
        name: string;
        subdomain: string;
        logo_url: string | null;
      }[];

      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        subdomain: r.subdomain,
        logoUrl: r.logo_url,
      }));
    },
  ),
});
