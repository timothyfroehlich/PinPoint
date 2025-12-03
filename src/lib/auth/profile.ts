import { db } from "~/server/db";
import { userProfiles, notificationPreferences } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import type { User } from "@supabase/supabase-js";
import { log } from "~/lib/logger";

/**
 * Ensures a user profile exists in the database.
 * If the profile is missing (e.g. after a database reset), it recreates it
 * using metadata from the Supabase Auth user object.
 *
 * This replicates the logic from the `handle_new_user` SQL trigger.
 */
export async function ensureUserProfile(user: User): Promise<void> {
  try {
    // Check if profile exists
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, user.id),
    });

    if (profile) {
      return;
    }

    log.info(
      { userId: user.id },
      "User profile missing, attempting to recreate (auto-healing)"
    );

    // Recreate profile
    // Extract metadata safely
    const firstName = (user.user_metadata["first_name"] as string) || "";
    const lastName = (user.user_metadata["last_name"] as string) || "";
    const avatarUrl = (user.user_metadata["avatar_url"] as string) || null;

    await db.insert(userProfiles).values({
      id: user.id,
      firstName,
      lastName,
      avatarUrl,
      role: "member", // Default role
    });

    // Recreate notification preferences
    // Check if they exist first (just in case)
    const prefs = await db.query.notificationPreferences.findFirst({
      where: eq(notificationPreferences.userId, user.id),
    });

    if (!prefs) {
      await db.insert(notificationPreferences).values({
        userId: user.id,
        emailEnabled: true,
        inAppEnabled: true,
        emailNotifyOnAssigned: true,
        inAppNotifyOnAssigned: true,
        emailNotifyOnStatusChange: true,
        inAppNotifyOnStatusChange: true,
        emailNotifyOnNewComment: true,
        inAppNotifyOnNewComment: true,
        emailNotifyOnNewIssue: true,
        inAppNotifyOnNewIssue: true,
        emailWatchNewIssuesGlobal: false,
        inAppWatchNewIssuesGlobal: false,
      });
    }

    log.info({ userId: user.id }, "User profile auto-healed successfully");
  } catch (error) {
    log.error(
      {
        userId: user.id,
        error: error instanceof Error ? error.message : "Unknown",
      },
      "Failed to auto-heal user profile"
    );
    // We don't throw here to avoid crashing the page, but the subsequent queries might fail
    // or the user might see a degraded experience.
  }
}
