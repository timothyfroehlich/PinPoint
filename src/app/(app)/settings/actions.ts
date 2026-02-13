/**
 * Settings Server Actions
 *
 * Server-side mutations for user settings and profile management.
 */

"use server";

import { createClient } from "~/lib/supabase/server";
import { createAdminClient } from "~/lib/supabase/admin";
import { db } from "~/server/db";
import {
  userProfiles,
  machines,
  issues,
  issueComments,
  issueImages,
} from "~/server/db/schema";
import { eq, and, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type Result, ok, err } from "~/lib/result";
import { deleteFromBlob } from "~/lib/blob/client";
import { log } from "~/lib/logger";

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
    await db
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
    // Fetch profile for avatar cleanup
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, userId),
    });

    if (!profile) {
      return err("SERVER", "Profile not found.");
    }

    // Run anonymization in a transaction
    await db.transaction(async (tx) => {
      // Admin check: if this user is an admin, ensure they're not the only one
      if (profile.role === "admin") {
        const [adminCount] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(userProfiles)
          .where(
            and(eq(userProfiles.role, "admin"), ne(userProfiles.id, userId))
          );

        if (!adminCount || adminCount.count === 0) {
          throw new SoleAdminError();
        }
      }

      // Reassign or unassign owned machines
      if (reassignTo) {
        await tx
          .update(machines)
          .set({ ownerId: reassignTo, updatedAt: new Date() })
          .where(eq(machines.ownerId, userId));
      } else {
        await tx
          .update(machines)
          .set({ ownerId: null, updatedAt: new Date() })
          .where(eq(machines.ownerId, userId));
      }

      // Anonymize issue references
      await tx
        .update(issues)
        .set({ assignedTo: null, updatedAt: new Date() })
        .where(eq(issues.assignedTo, userId));

      await tx
        .update(issues)
        .set({ reportedBy: null, updatedAt: new Date() })
        .where(eq(issues.reportedBy, userId));

      // Anonymize comment authorship
      await tx
        .update(issueComments)
        .set({ authorId: null, updatedAt: new Date() })
        .where(eq(issueComments.authorId, userId));

      // Anonymize image references
      await tx
        .update(issueImages)
        .set({ uploadedBy: null, updatedAt: new Date() })
        .where(eq(issueImages.uploadedBy, userId));

      await tx
        .update(issueImages)
        .set({ deletedBy: null, updatedAt: new Date() })
        .where(eq(issueImages.deletedBy, userId));
    });

    // Best-effort avatar cleanup (outside transaction)
    if (profile.avatarUrl) {
      try {
        await deleteFromBlob(profile.avatarUrl);
      } catch {
        log.warn({ userId: userId.slice(0, 8) }, "Avatar blob cleanup failed");
      }
    }

    // Delete auth user (cascades to user_profiles, watchers, notifications)
    const adminClient = createAdminClient();
    const { error: deleteError } =
      await adminClient.auth.admin.deleteUser(userId);

    if (deleteError) {
      log.error(
        { userId: userId.slice(0, 8), error: deleteError.message },
        "Failed to delete auth user"
      );
      return err("SERVER", "Failed to delete account. Please try again.");
    }

    // Sign out the current session
    await supabase.auth.signOut();

    log.info({ userId: userId.slice(0, 8) }, "Account deleted successfully");
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

class SoleAdminError extends Error {
  constructor() {
    super("Sole admin cannot delete their account");
    this.name = "SoleAdminError";
  }
}
