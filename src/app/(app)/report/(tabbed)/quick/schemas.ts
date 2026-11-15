import { z } from "zod";
import { ISSUE_STATUS_VALUES } from "~/lib/issues/status";
import {
  ISSUE_FREQUENCY_VALUES,
  ISSUE_PRIORITY_VALUES,
  ISSUE_SEVERITY_VALUES,
} from "~/lib/types";
import { ISSUE_TITLE_MAX, issueTitleSchema } from "~/lib/issues/title";
import { proseMirrorDocValueSchema } from "~/lib/tiptap/types";

/** Maximum rows a single quick submit may create (accident guard, not abuse). */
export const QUICK_MAX_ROWS = 50;

export const quickRowSchema = z.object({
  machineId: z.string().uuid({ message: "Please select a machine" }),
  title: issueTitleSchema({
    required: "Problem is required",
    tooLong: `Problem must be ${ISSUE_TITLE_MAX} characters or less`,
  }),
  // Rich-text (ProseMirror) description, matching the single form. The grid
  // routes an empty editor to `null` via `docIsEmpty` before submit, so a junk
  // "empty paragraph" doc is never persisted.
  description: proseMirrorDocValueSchema.nullable(),
  severity: z.enum(ISSUE_SEVERITY_VALUES, {
    message: "Select a severity",
  }),
  priority: z.enum(ISSUE_PRIORITY_VALUES, {
    message: "Select a priority",
  }),
  frequency: z.enum(ISSUE_FREQUENCY_VALUES, {
    message: "Select a frequency",
  }),
  status: z.enum(ISSUE_STATUS_VALUES),
  assignedTo: z.string().uuid("Invalid assignee").optional().or(z.literal("")),
  watch: z.boolean(),
  // Client-generated, stable across retries; lets createIssue dedup.
  idempotencyKey: z.string().uuid("Invalid idempotency key"),
});

export type QuickRowInput = z.infer<typeof quickRowSchema>;
