import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter } from "~/server/api/trpc";
import {
  attachmentCreateProcedure,
  attachmentDeleteProcedure,
} from "~/server/api/trpc.permission";

export const issueAttachmentRouter = createTRPCRouter({
  // Create attachment record after file upload (called by upload API)
  createAttachment: attachmentCreateProcedure
    .input(
      z.object({
        issueId: z.string(),
        url: z.string().url("Must be a valid URL"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the issue belongs to this organization
      const existingIssue = await ctx.db.issue.findFirst({
        where: {
          id: input.issueId,
          organizationId: ctx.organization.id,
        },
      });

      if (!existingIssue) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Issue not found",
        });
      }

      // Check attachment count limit
      const existingAttachments = await ctx.db.attachment.count({
        where: {
          issueId: input.issueId,
        },
      });

      if (existingAttachments >= 3) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Maximum of 3 attachments allowed per issue",
        });
      }

      // Create attachment record
      return ctx.db.attachment.create({
        data: {
          url: input.url,
          issueId: input.issueId,
          organizationId: ctx.organization.id,
        },
      });
    }),

  // Delete attachment from an issue
  deleteAttachment: attachmentDeleteProcedure
    .input(
      z.object({
        attachmentId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Find the attachment and verify it belongs to this organization
      const attachment = await ctx.db.attachment.findFirst({
        where: {
          id: input.attachmentId,
          organizationId: ctx.organization.id,
        },
      });

      if (!attachment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Attachment not found",
        });
      }

      // Authorization is now handled by attachmentDeleteProcedure

      // Delete the file from storage
      const { imageStorage } = await import(
        "~/lib/image-storage/local-storage"
      );
      await imageStorage.deleteImage(attachment.url);

      // Delete the attachment record
      return ctx.db.attachment.delete({
        where: { id: input.attachmentId },
      });
    }),
});
