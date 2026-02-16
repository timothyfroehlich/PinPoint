import { z } from "zod";

/**
 * Authentication Validation Schemas
 *
 * Zod schemas for login and signup forms.
 * Separated from actions.ts because "use server" files
 * can only export async functions, not objects.
 */

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email or username is required")
    .max(254, "Input is too long")
    .trim()
    .toLowerCase()
    .refine(
      (val) =>
        val.includes("@")
          ? z.string().email().safeParse(val).success
          : /^[a-zA-Z0-9_]{2,}$/.test(val),
      "Please enter a valid email address or username"
    ),
  password: z
    .string()
    .min(1, "Password is required")
    .max(1000, "Password is too long"),
  rememberMe: z.boolean().optional(),
});

export const signupSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(1, "First name is required")
      .max(50, "First name must be less than 50 characters"),
    lastName: z
      .string()
      .trim()
      .min(1, "Last name is required")
      .max(50, "Last name must be less than 50 characters"),
    email: z
      .string()
      .email("Please enter a valid email address")
      .max(254, "Email is too long")
      .trim()
      .toLowerCase(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must be less than 128 characters"),
    confirmPassword: z
      .string()
      .min(1, "Please confirm your password")
      .max(128, "Password must be less than 128 characters"),
    termsAccepted: z.literal(true, {
      message: "You must accept the Terms of Service to create an account",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .email("Please enter a valid email address")
    .max(254, "Email is too long")
    .trim()
    .toLowerCase(),
});

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must be less than 128 characters"),
    confirmPassword: z
      .string()
      .max(128, "Password must be less than 128 characters"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
