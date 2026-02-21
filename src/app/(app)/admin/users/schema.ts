import { z } from "zod";

export const updateUserRoleSchema = z.object({
  userId: z.string().uuid(),
  newRole: z.enum(["guest", "member", "technician", "admin"]),
  userType: z.enum(["active", "invited"]),
});

export const inviteUserSchema = z.object({
  firstName: z
    .string()
    .min(1, "First name is required")
    .max(50, "First name is too long"),
  lastName: z
    .string()
    .min(1, "Last name is required")
    .max(50, "Last name is too long"),
  email: z
    .string()
    .email("Invalid email address")
    .max(254, "Email is too long")
    .trim()
    .toLowerCase(),
  role: z.enum(["guest", "member", "technician"]), // Explicitly exclude "admin"
  sendInvite: z.boolean().optional(),
});
