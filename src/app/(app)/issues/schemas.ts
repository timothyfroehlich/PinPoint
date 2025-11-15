/**
 * Issue Validation Schemas
 *
 * Zod schemas for issue creation and updates.
 * Must be in separate file from Server Actions (Next.js requirement).
 */

import { z } from "zod";

/**
 * Schema for creating a new issue
 *
 * Validates:
 * - title: Required, trimmed, 1-200 characters
 * - description: Optional, trimmed
 * - machineId: Required UUID (CORE-ARCH-004)
 * - severity: Enum of 'minor' | 'playable' | 'unplayable'
 */
export const createIssueSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters")
    .trim(),
  description: z.string().trim().optional(),
  machineId: z.string().uuid("Invalid machine ID"),
  severity: z.enum(["minor", "playable", "unplayable"], {
    errorMap: () => ({ message: "Invalid severity level" }),
  }),
});

/**
 * Schema for updating issue status
 */
export const updateIssueStatusSchema = z.object({
  issueId: z.string().uuid("Invalid issue ID"),
  status: z.enum(["new", "in_progress", "resolved"], {
    errorMap: () => ({ message: "Invalid status" }),
  }),
});

/**
 * Schema for updating issue severity
 */
export const updateIssueSeveritySchema = z.object({
  issueId: z.string().uuid("Invalid issue ID"),
  severity: z.enum(["minor", "playable", "unplayable"], {
    errorMap: () => ({ message: "Invalid severity level" }),
  }),
});

/**
 * Schema for assigning issue to user
 */
export const assignIssueSchema = z.object({
  issueId: z.string().uuid("Invalid issue ID"),
  assignedTo: z.string().uuid("Invalid user ID").nullable(),
});
