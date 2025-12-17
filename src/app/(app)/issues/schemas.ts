/**
 * Issue Validation Schemas
 *
 * Zod schemas for issue creation and updates.
 * Must be in separate file from Server Actions (Next.js requirement).
 */

import { z } from "zod";

const uuidish = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    "Invalid ID format"
  );

/**
 * Schema for creating a new issue
 *
 * Validates:
 * - title: Required, trimmed, 1-200 characters
 * - description: Optional, trimmed
 * - machineInitials: Required (Plan: Machine Initials)
 * - severity: Enum of 'minor' | 'playable' | 'unplayable'
 */
export const createIssueSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters")
    .trim(),
  description: z
    .string()
    .trim()
    .max(5000, "Description must be less than 5000 characters")
    .optional(),
  machineInitials: z
    .string()
    .min(2, "Machine initials invalid")
    .max(6, "Machine initials invalid")
    .regex(/^[A-Z0-9]+$/, "Machine initials invalid"),
  severity: z.enum(["minor", "playable", "unplayable"], {
    message: "Invalid severity level",
  }),
  priority: z.enum(["low", "medium", "high"], {
    message: "Invalid priority level",
  }),
});

/**
 * Schema for updating issue status
 */
export const updateIssueStatusSchema = z.object({
  issueId: uuidish,
  status: z.enum(["new", "in_progress", "resolved"], {
    message: "Invalid status",
  }),
});

/**
 * Schema for updating issue severity
 */
export const updateIssueSeveritySchema = z.object({
  issueId: uuidish,
  severity: z.enum(["minor", "playable", "unplayable"], {
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
 * Schema for assigning issue to user
 */
export const assignIssueSchema = z.object({
  issueId: uuidish,
  assignedTo: uuidish.nullable(),
});

/**
 * Schema for adding a new comment
 */
export const addCommentSchema = z.object({
  issueId: uuidish,
  comment: z
    .string()
    .trim()
    .min(1, "Comment cannot be empty")
    .max(5000, "Comment must be less than 5000 characters"),
});
