import { db } from "~/server/db";
import {
  userProfiles,
  notificationPreferences,
  invitedUsers,
  machines,
  issues,
} from "~/server/db/schema";
import { eq, and, isNull } from "drizzle-orm";
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

    // Check for existing invited user to inherit role
    let role: "member" | "admin" | "guest" = "member";
    if (user.email) {
      const invitedUser = await db.query.invitedUsers.findFirst({
        where: eq(invitedUsers.email, user.email),
        columns: { role: true },
      });
      if (invitedUser) {
        role = invitedUser.role;
      }
    }

    await db.insert(userProfiles).values({
      id: user.id,
      email: user.email!, // Email is required by schema
      firstName,
      lastName,
      avatarUrl,
      role, // Inherited from invited user or default "member"
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
        emailNotifyOnMachineOwnershipChange: true,
        inAppNotifyOnMachineOwnershipChange: true,
      });
    }

    // Transfer guest issues (by email)
    // Matches SQL: WHERE reporter_email = NEW.email AND reported_by IS NULL AND invited_reported_by IS NULL
    if (user.email) {
      await db
        .update(issues)
        .set({
          reportedBy: user.id,
          reporterName: null,
          reporterEmail: null,
        })
        .where(
          and(
            eq(issues.reporterEmail, user.email),
            isNull(issues.reportedBy),
            isNull(issues.invitedReportedBy)
          )
        );
    }

    // Handle invited users transfer
    if (user.email) {
      const invitedUser = await db.query.invitedUsers.findFirst({
        where: eq(invitedUsers.email, user.email),
      });

      if (invitedUser) {
        // Transfer machines
        await db
          .update(machines)
          .set({
            ownerId: user.id,
            invitedOwnerId: null,
          })
          .where(eq(machines.invitedOwnerId, invitedUser.id));

        // Transfer issues reported by invited user
        await db
          .update(issues)
          .set({
            reportedBy: user.id,
            invitedReportedBy: null,
            reporterName: null,
            reporterEmail: null,
          })
          .where(eq(issues.invitedReportedBy, invitedUser.id));

        // Delete the invited user record
        await db
          .delete(invitedUsers)
          .where(eq(invitedUsers.id, invitedUser.id));
      }
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
