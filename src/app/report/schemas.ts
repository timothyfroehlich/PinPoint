import { z } from "zod";

export const publicIssueSchema = z.object({
  machineId: z.string().uuid({ message: "Please select a machine" }),
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters")
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
  firstName: z.string().trim().max(100, "First name too long").optional(),
  lastName: z.string().trim().max(100, "Last name too long").optional(),
  email: z
    .string()
    .email("Invalid email")
    .max(254, "Email is too long")
    .optional()
    .or(z.literal("")),
});

export type PublicIssueInput = z.infer<typeof publicIssueSchema>;
