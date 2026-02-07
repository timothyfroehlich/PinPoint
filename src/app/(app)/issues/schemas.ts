/**
 * Issue Validation Schemas
 *
 * Zod schemas for issue creation and updates.
 * Must be in separate file from Server Actions (Next.js requirement).
 */

import { z } from "zod";
import { ISSUE_STATUS_VALUES } from "~/lib/issues/status";

const uuidish = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    "Invalid ID format"
  );

/**
 * Schema for updating issue status
 * Based on _issue-status-redesign/README.md - Final design with 11 statuses
 * Status values imported from single source of truth
 */
export const updateIssueStatusSchema = z.object({
  issueId: uuidish,
  status: z.enum(ISSUE_STATUS_VALUES, {
    message: "Invalid status",
  }),
});

/**
 * Schema for updating issue severity
 */
export const updateIssueSeveritySchema = z.object({
  issueId: uuidish,
  severity: z.enum(["cosmetic", "minor", "major", "unplayable"], {
    message: "Invalid severity level",
  }),
});

/**
 * Schema for updating issue priority
 */
export const updateIssuePrioritySchema = z.object({
  issueId: uuidish,
  priority: z.enum(["low", "medium", "high"], {
    message: "Invalid priority level",
  }),
});

/**
 * Schema for updating issue frequency
 */
export const updateIssueFrequencySchema = z.object({
  issueId: uuidish,
  frequency: z.enum(["intermittent", "frequent", "constant"], {
    message: "Invalid frequency level",
  }),
});

/**
 * Schema for assigning issue to user
 */
export const assignIssueSchema = z.object({
  issueId: uuidish,
  assignedTo: uuidish.nullable(),
});

/**
 * Common schema for image metadata from Vercel Blob
 */
export const imageMetadataSchema = z.object({
  blobUrl: z
    .string()
    .url()
    .refine(
      (url) => {
        const parsedUrl = new URL(url);
        const isVercelBlob = parsedUrl.hostname.endsWith(
          ".public.blob.vercel-storage.com"
        );
        const allowLocalhostBlob =
          process.env["MOCK_BLOB_STORAGE"] === "true" ||
          (process.env.NODE_ENV !== "production" &&
            !process.env["BLOB_READ_WRITE_TOKEN"]);
        const isLocalhost =
          allowLocalhostBlob && parsedUrl.hostname === "localhost";
        return isVercelBlob || isLocalhost;
      },
      {
        message:
          "Image URL must be from Vercel Blob storage or localhost (dev only)",
      }
    ),
  blobPathname: z.string().min(1),
  originalFilename: z.string().min(1),
  fileSizeBytes: z.number().positive(),
  mimeType: z.string().startsWith("image/"),
});

export const imagesMetadataArraySchema = z.array(imageMetadataSchema);

/**
 * Schema for adding a new comment
 */
export const addCommentSchema = z.object({
  issueId: uuidish,
  comment: z
    .string()
    .trim()
    .min(1, "Comment cannot be empty")
    .max(5000, "Comment is too long"),
  imagesMetadata: z.string().nullish(), // JSON string from hidden input
});

/**
 * Schema for editing a comment
 */
export const editCommentSchema = z.object({
  commentId: uuidish,
  comment: z
    .string()
    .trim()
    .min(1, "Comment cannot be empty")
    .max(5000, "Comment is too long"),
});

/**
 * Schema for deleting a comment
 */
export const deleteCommentSchema = z.object({
  commentId: uuidish,
});
