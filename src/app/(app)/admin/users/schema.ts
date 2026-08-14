import { z } from "zod";

export const updateUserRoleSchema = z.object({
  userId: z.string().uuid(),
  newRole: z.enum(["guest", "member", "technician", "admin"]),
  userType: z.enum(["active", "invited"]),
});

export const inviteUserSchema = z.object({
  // `.trim()` is load-bearing: without it a single space passed `min(1)` and
  // landed in the DB as a blank name (PP-if48).
  firstName: z
    .string()
    .trim()
    .min(1, "First name is required")
    .max(50, "First name is too long"),
  // Optional: only a first name is required (PP-if48).
  lastName: z.string().trim().max(50, "Last name is too long").default(""),
  email: z
    .string()
    .email("Invalid email address")
    .max(254, "Email is too long")
    .trim()
    .toLowerCase(),
  role: z.literal("member"),
  sendInvite: z.boolean().optional(),
});
