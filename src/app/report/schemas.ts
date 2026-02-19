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
    .max(5000, "Description is too long")
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
});

export type PublicIssueInput = z.infer<typeof publicIssueSchema>;
