import { TRPCError } from "@trpc/server";
import { count, eq } from "drizzle-orm";
import { z } from "zod";

import { generatePrefixedId } from "~/lib/utils/id-generation";
import { transformAttachmentResponse } from "~/lib/utils/api-response-transformers";
import { type AttachmentResponse } from "~/lib/types/api";
import { createTRPCRouter } from "~/server/api/trpc";
import {
  attachmentCreateProcedure,
  attachmentDeleteProcedure,
} from "~/server/api/trpc.permission";
import { attachments, issues } from "~/server/db/schema";

export const issueAttachmentRouter = createTRPCRouter({
  // Create attachment record after file upload (called by upload API)
  createAttachment: attachmentCreateProcedure
    .input(
      z.object({
        issueId: z.string(),
        url: z.url(),
        fileName: z.string(),
        fileType: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<AttachmentResponse> => {
      // Verify the issue exists (RLS handles org scoping)
      const [existingIssue] = await ctx.db
        .select({
          id: issues.id,
        })
        .from(issues)
        .where(eq(issues.id, input.issueId))
        .limit(1);

      if (!existingIssue) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Issue not found",
        });
      }

      // Check attachment count limit
      const [attachmentCountResult] = await ctx.db
        .select({ count: count() })
        .from(attachments)
        .where(eq(attachments.issue_id, input.issueId));

      const existingAttachments = attachmentCountResult?.count ?? 0;

      if (existingAttachments >= 3) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Maximum of 3 attachments allowed per issue",
        });
      }

      // Create attachment record
      const [newAttachment] = await ctx.db
        .insert(attachments)
        .values({
          id: generatePrefixedId("attachment"),
          url: input.url,
          file_name: input.fileName,
          file_type: input.fileType,
          issue_id: input.issueId,
          organization_id: ctx.organization.id,
        })
        .returning();

      if (!newAttachment) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create attachment",
        });
      }

      return transformAttachmentResponse(newAttachment);
    }),

  // Delete attachment from an issue
  deleteAttachment: attachmentDeleteProcedure
    .input(
      z.object({
        attachmentId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<AttachmentResponse> => {
      // Find the attachment (RLS handles org scoping)
      const [attachment] = await ctx.db
        .select({
          id: attachments.id,
          url: attachments.url,
          file_name: attachments.file_name,
          file_type: attachments.file_type,
          issue_id: attachments.issue_id,
          created_at: attachments.created_at,
        })
        .from(attachments)
        .where(eq(attachments.id, input.attachmentId))
        .limit(1);

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
      const [deletedAttachment] = await ctx.db
        .delete(attachments)
        .where(eq(attachments.id, input.attachmentId))
        .returning();

      if (!deletedAttachment) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete attachment",
        });
      }

      return transformAttachmentResponse(deletedAttachment);
    }),
});
