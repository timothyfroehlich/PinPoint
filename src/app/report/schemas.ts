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
    .max(2000, "Description is too long")
    .optional(),
  severity: z.enum(["minor", "playable", "unplayable"], {
    message: "Select a severity",
  }),
  firstName: z.string().trim().max(100, "First name too long").optional(),
  lastName: z.string().trim().max(100, "Last name too long").optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
});

export type PublicIssueInput = z.infer<typeof publicIssueSchema>;
