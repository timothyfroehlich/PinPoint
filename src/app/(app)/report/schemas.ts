import { z } from "zod";
import { ISSUE_STATUS_VALUES } from "~/lib/issues/status";

export const publicIssueSchema = z.object({
  machineId: z.string().uuid({ message: "Please select a machine" }),
  title: z
    .string()
    .min(1, "Title is required")
    .max(60, "Title must be 60 characters or less")
    .trim(),
  description: z
    .string()
    .trim()
    .max(20000, "Description is too long")
    .optional(),
  severity: z.enum(["cosmetic", "minor", "major", "unplayable"], {
    message: "Select a severity",
  }),
  priority: z
    .enum(["low", "medium", "high"], {
      message: "Select a priority",
    })
    .optional(),
  frequency: z.enum(["intermittent", "frequent", "constant"], {
    message: "Select frequency",
  }),
  status: z.enum(ISSUE_STATUS_VALUES).optional(),
  firstName: z.string().trim().max(100, "First name too long").optional(),
  lastName: z.string().trim().max(100, "Last name too long").optional(),
  email: z
    .string()
    .email("Invalid email")
    .max(254, "Email is too long")
    .trim()
    .toLowerCase()
    .optional()
    .or(z.literal("")),
  assignedTo: z.string().uuid("Invalid assignee").optional().or(z.literal("")),
  watchIssue: z.boolean().default(true),
  // Client-generated UUID, stable across submission retries. Lets the service
  // dedup a retried submission. Optional + tolerant of a missing/blank value so
  // a JS-disabled or legacy client (no hidden field) still submits. (PP-2053.7)
  idempotencyKey: z
    .string()
    .uuid("Invalid idempotency key")
    .optional()
    .or(z.literal("")),
});

export type PublicIssueInput = z.infer<typeof publicIssueSchema>;
