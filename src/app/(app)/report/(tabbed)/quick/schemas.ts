import { z } from "zod";
import { ISSUE_STATUS_VALUES } from "~/lib/issues/status";
import { proseMirrorDocValueSchema } from "~/lib/tiptap/types";

/** Maximum rows a single quick submit may create (accident guard, not abuse). */
export const QUICK_MAX_ROWS = 50;

export const quickRowSchema = z.object({
  machineId: z.string().uuid({ message: "Please select a machine" }),
  title: z
    .string()
    .trim()
    .min(1, "Problem is required")
    .max(60, "Problem must be 60 characters or less"),
  // Rich-text (ProseMirror) description, matching the single form. The grid
  // routes an empty editor to `null` via `docIsEmpty` before submit, so a junk
  // "empty paragraph" doc is never persisted.
  description: proseMirrorDocValueSchema.nullable(),
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

export type QuickRowInput = z.infer<typeof quickRowSchema>;
