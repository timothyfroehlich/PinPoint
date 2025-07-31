import { z } from "zod";

import { supabaseImageStorageServer } from "~/lib/supabase/storage";
import {
  createTRPCRouter,
  publicProcedure,
  organizationManageProcedure,
} from "~/server/api/trpc";

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
      const organization = await ctx.db.organization.update({
        where: {
          id: ctx.organization.id,
        },
        data: {
          name: input.name,
          ...(input.logoUrl && { logoUrl: input.logoUrl }),
        },
      });
      return organization;
    }),

  // Upload organization logo
  uploadLogo: organizationManageProcedure
    .input(
      z.object({
        imageData: z.string(), // Base64 encoded image data
        filename: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Convert base64 to File object
        const response = await fetch(input.imageData);
        const blob = await response.blob();
        const file = new File([blob], input.filename, { type: blob.type });

        // Upload logo using Supabase storage
        const logoPath =
          await supabaseImageStorageServer.uploadOrganizationLogo(
            file,
            ctx.organization.subdomain,
          );

        // Delete old logo if it exists
        const currentOrg = await ctx.db.organization.findUnique({
          where: { id: ctx.organization.id },
          select: { logoUrl: true },
        });

        if (currentOrg?.logoUrl && !currentOrg.logoUrl.includes("default")) {
          try {
            await supabaseImageStorageServer.deleteImage(currentOrg.logoUrl);
          } catch (error) {
            // Ignore deletion errors for old files
            console.warn("Failed to delete old organization logo:", error);
          }
        }

        // Update organization's logo URL
        const updatedOrganization = await ctx.db.organization.update({
          where: { id: ctx.organization.id },
          data: { logoUrl: logoPath },
        });

        return { success: true, logoUrl: updatedOrganization.logoUrl };
      } catch (error) {
        console.error("Organization logo upload error:", error);
        throw new Error(
          error instanceof Error
            ? `Upload failed: ${error.message}`
            : "Upload failed",
        );
      }
    }),
});
