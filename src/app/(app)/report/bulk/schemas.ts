import { z } from "zod";
import { ISSUE_STATUS_VALUES } from "~/lib/issues/status";

/** Maximum rows a single bulk submit may create (accident guard, not abuse). */
export const BULK_MAX_ROWS = 50;

export const bulkRowSchema = z.object({
  machineId: z.string().uuid({ message: "Please select a machine" }),
  title: z
    .string()
    .min(1, "Problem is required")
    .max(60, "Problem must be 60 characters or less")
    .trim(),
  description: z
    .string()
    .trim()
    .max(20000, "Description is too long")
    .optional(),
  severity: z.enum(["cosmetic", "minor", "major", "unplayable"], {
    message: "Select a severity",
  }),
  priority: z.enum(["low", "medium", "high"], { message: "Select a priority" }),
  frequency: z.enum(["intermittent", "frequent", "constant"], {
    message: "Select a frequency",
  }),
  status: z.enum(ISSUE_STATUS_VALUES),
  assignedTo: z.string().uuid("Invalid assignee").optional().or(z.literal("")),
  watch: z.boolean(),
  // Client-generated, stable across retries; lets createIssue dedup.
  idempotencyKey: z.string().uuid("Invalid idempotency key"),
});

export type BulkRowInput = z.infer<typeof bulkRowSchema>;
