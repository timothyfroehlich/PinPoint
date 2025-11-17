/**
 * Issue Validation Schemas
 *
 * Zod schemas for issue CRUD operations.
 * Separated from Server Actions file per Next.js requirement.
 */

import { z } from "zod";

/**
 * Create Issue Schema
 *
 * Validates issue creation input.
 * - Title: Required, minimum 1 character (CORE-SEC-002)
 * - Description: Optional
 * - Machine ID: Required UUID (CORE-ARCH-004: issues always per-machine)
 * - Severity: Required enum ('minor' | 'playable' | 'unplayable')
 */
export const createIssueSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Issue title is required")
    .max(200, "Issue title must be less than 200 characters"),
  description: z.string().trim().optional(),
  machineId: z.string().uuid("Invalid machine ID"),
  severity: z.enum(["minor", "playable", "unplayable"]),
});

export type CreateIssueInput = z.infer<typeof createIssueSchema>;

/**
 * Update Issue Status Schema
 *
 * Validates status update input.
 * - Status: Required enum ('new' | 'in_progress' | 'resolved')
 */
export const updateIssueStatusSchema = z.object({
  issueId: z.string().uuid("Invalid issue ID"),
  status: z.enum(["new", "in_progress", "resolved"]),
});

export type UpdateIssueStatusInput = z.infer<typeof updateIssueStatusSchema>;

/**
 * Update Issue Severity Schema
 *
 * Validates severity update input.
 * - Severity: Required enum ('minor' | 'playable' | 'unplayable')
 */
export const updateIssueSeveritySchema = z.object({
  issueId: z.string().uuid("Invalid issue ID"),
  severity: z.enum(["minor", "playable", "unplayable"]),
});

export type UpdateIssueSeverityInput = z.infer<
  typeof updateIssueSeveritySchema
>;

/**
 * Assign Issue Schema
 *
 * Validates issue assignment input.
 * - Assignee ID: Optional UUID (null to unassign)
 */
export const assignIssueSchema = z.object({
  issueId: z.string().uuid("Invalid issue ID"),
  assigneeId: z.string().uuid("Invalid user ID").nullable(),
});

export type AssignIssueInput = z.infer<typeof assignIssueSchema>;
