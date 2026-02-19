/**
 * Settings Server Actions
 *
 * Server-side mutations for user settings and profile management.
 */

"use server";

import { createClient } from "~/lib/supabase/server";
import { createAdminClient } from "~/lib/supabase/admin";
import { db as globalDb } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type Result, ok, err } from "~/lib/result";
import { deleteFromBlob } from "~/lib/blob/client";
import { log } from "~/lib/logger";
import { checkLoginAccountLimit } from "~/lib/rate-limit";
import {
  anonymizeUserReferences,
  SoleAdminError,
} from "~/app/(app)/settings/account-deletion";

const updateProfileSchema = z.object({
  firstName: z.string().trim().max(50).optional(),
  lastName: z.string().trim().max(50).optional(),
});

export type UpdateProfileResult = Result<
  { success: boolean },
  "VALIDATION" | "UNAUTHORIZED" | "SERVER"
>;

/**
 * Update Profile Action
 *
 * Updates the user's profile information (First Name, Last Name).
 * Also updates the 'name' field by combining first and last name for backward compatibility.
 */
export async function updateProfileAction(
  _prevState: UpdateProfileResult | undefined,
  formData: FormData
): Promise<UpdateProfileResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err("UNAUTHORIZED", "Unauthorized");
  }

  const rawData = {
    firstName:
      typeof formData.get("firstName") === "string"
        ? (formData.get("firstName") as string)
        : undefined,
    lastName:
      typeof formData.get("lastName") === "string"
        ? (formData.get("lastName") as string)
        : undefined,
  };

  const validation = updateProfileSchema.safeParse(rawData);

  if (!validation.success) {
    return err("VALIDATION", "Invalid input");
  }

  const { firstName, lastName } = validation.data;

  try {
    await globalDb
      .update(userProfiles)
      .set({
        firstName,
        lastName,
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.id, user.id));

    revalidatePath("/settings");
    revalidatePath("/", "layout"); // Update user menu in layout

    return ok({ success: true });
  } catch (error) {
    console.error("Failed to update profile:", error);
    return err("SERVER", "Failed to update profile");
  }
}

// --- Account Deletion ---

const deleteAccountSchema = z.object({
  confirmation: z.literal("DELETE"),
  reassignTo: z.string().uuid().nullable(),
});

export type DeleteAccountResult = Result<
  { success: boolean },
  "VALIDATION" | "UNAUTHORIZED" | "SOLE_ADMIN" | "SERVER"
>;

/**
 * Delete Account Action
 *
 * Permanently deletes the user's account with data anonymization:
 * 1. Auth check
 * 2. Admin sole-admin guard
 * 3. Bulk reassign owned machines (or set to unassigned)
 * 4. Anonymize references in issues, comments, images (SET NULL)
 * 5. Delete avatar from Vercel Blob (best-effort)
 * 6. Delete auth user via admin API (cascades profiles, watchers, notifications)
 * 7. Sign out and redirect to landing page
 */
export async function deleteAccountAction(
  _prevState: DeleteAccountResult | undefined,
  formData: FormData
): Promise<DeleteAccountResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err("UNAUTHORIZED", "You must be logged in to delete your account.");
  }

  // Validate input — empty string from hidden input means "no reassignment"
  const rawReassignTo = formData.get("reassignTo");
  const rawData = {
    confirmation: formData.get("confirmation"),
    reassignTo:
      typeof rawReassignTo === "string" && rawReassignTo.length > 0
        ? rawReassignTo
        : null,
  };

  const validation = deleteAccountSchema.safeParse(rawData);
  if (!validation.success) {
    return err(
      "VALIDATION",
      'Please type "DELETE" to confirm account deletion.'
    );
  }

  const { reassignTo } = validation.data;
  const userId = user.id;

  try {
    log.info({ userId }, "Starting account deletion process");
    // Fetch profile and run anonymization in a single transaction
    const avatarUrl = await anonymizeUserReferences(userId, reassignTo);
    log.info({ userId, hasAvatar: !!avatarUrl }, "Anonymization complete");

    // Best-effort avatar cleanup (outside transaction)
    if (avatarUrl) {
      try {
        await deleteFromBlob(avatarUrl);
      } catch {
        log.warn({ userId }, "Avatar blob cleanup failed");
      }
    }

    // Delete auth user (cascades to user_profiles, watchers, notifications).
    // This is best-effort: if it fails after anonymization committed, we log
    // the error for manual cleanup but still sign out the user. The data is
    // already anonymized, so the user's information is protected.
    const adminClient = createAdminClient();
    const { error: deleteError } =
      await adminClient.auth.admin.deleteUser(userId);

    if (deleteError) {
      log.error(
        { userId, error: deleteError.message },
        "Failed to delete auth user after anonymization — requires manual cleanup"
      );
    }

    // Sign out the current session
    await supabase.auth.signOut();

    log.info({ userId }, "Account deleted successfully");
  } catch (error) {
    if (error instanceof SoleAdminError) {
      return err(
        "SOLE_ADMIN",
        "You are the only admin. Promote another user to admin before deleting your account."
      );
    }
    log.error({ error }, "Account deletion failed");
    return err("SERVER", "Failed to delete account. Please try again.");
  }

  redirect("/");
}

// --- Change Password ---

const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, "Current password is required")
      .max(1000, "Password is too long"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must be less than 128 characters"),
    confirmNewPassword: z
      .string()
      .min(1, "Please confirm your new password")
      .max(128, "Password must be less than 128 characters"),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  });

export type ChangePasswordResult = Result<
  { success: boolean },
  "VALIDATION" | "UNAUTHORIZED" | "WRONG_PASSWORD" | "SERVER"
>;

/**
 * Change Password Action
 *
 * Allows authenticated users to change their password.
 * Verifies the current password before updating.
 */
export async function changePasswordAction(
  _prevState: ChangePasswordResult | undefined,
  formData: FormData
): Promise<ChangePasswordResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err(
      "UNAUTHORIZED",
      "You must be logged in to change your password."
    );
  }

  const rawData = {
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmNewPassword: formData.get("confirmNewPassword"),
  };

  const validation = changePasswordSchema.safeParse(rawData);

  if (!validation.success) {
    const firstError = validation.error.issues[0]?.message ?? "Invalid input";
    return err("VALIDATION", firstError);
  }

  const { currentPassword, newPassword } = validation.data;

  // Rate-limit password change attempts per account (reuses login account limiter)
  const accountLimit = await checkLoginAccountLimit(user.email ?? user.id);
  if (!accountLimit.success) {
    log.warn(
      { userId: user.id, action: "change-password" },
      "Change password rate limit exceeded"
    );
    return err("SERVER", "Too many attempts. Please try again later.");
  }

  try {
    if (!user.email) {
      log.error(
        { userId: user.id, action: "change-password" },
        "User has no email — cannot verify password"
      );
      return err("SERVER", "Unable to verify your identity.");
    }

    // Supabase has no "verify password" API, so we use signInWithPassword.
    // This verifies the password by signing in again, which refreshes the
    // session but doesn't create additional side effects.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (signInError) {
      log.warn(
        { userId: user.id, action: "change-password" },
        "Current password verification failed"
      );
      return err("WRONG_PASSWORD", "Current password is incorrect.");
    }

    // Update to new password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      log.error(
        {
          userId: user.id,
          action: "change-password",
          error: updateError.message,
        },
        "Password update failed"
      );
      return err("SERVER", "Failed to update password. Please try again.");
    }

    log.info(
      { userId: user.id, action: "change-password" },
      "Password changed successfully"
    );

    return ok({ success: true });
  } catch (error) {
    log.error(
      {
        userId: user.id,
        error: error instanceof Error ? error.message : "Unknown",
        action: "change-password",
      },
      "Change password server error"
    );
    return err("SERVER", "An unexpected error occurred.");
  }
}
