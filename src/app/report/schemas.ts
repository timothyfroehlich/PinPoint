/**
 * Public Issue Reporting Validation Schema
 *
 * Zod schema for anonymous/public issue reporting.
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
 * Schema for public/anonymous issue reporting
 *
 * Validates:
 * - title: Required, trimmed, 1-200 characters
 * - description: Optional, trimmed
 * - machineId: Required UUID (CORE-ARCH-004)
 * - severity: Enum of 'minor' | 'playable' | 'unplayable'
 * - reporterName: Optional, trimmed, 1-100 characters (for anonymous reporters)
 */
export const publicReportIssueSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters")
    .trim(),
  description: z.string().trim().optional(),
  machineId: uuidish,
  severity: z.enum(["minor", "playable", "unplayable"], {
    message: "Invalid severity level",
  }),
  reporterName: z
    .string()
    .trim()
    .max(100, "Name must be less than 100 characters")
    .optional(),
});
