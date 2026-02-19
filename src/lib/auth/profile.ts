import { db } from "~/server/db";
import {
  userProfiles,
  notificationPreferences,
  invitedUsers,
  machines,
  issues,
  issueWatchers,
} from "~/server/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import type { User } from "@supabase/supabase-js";
import { log } from "~/lib/logger";

/**
 * Ensures a user profile exists in the database.
 * If the profile is missing (e.g. after a database reset), it recreates it
 * using metadata from the Supabase Auth user object.
 *
 * This replicates the logic from the `handle_new_user` SQL trigger
 * (drizzle/0007, updated by drizzle/0014). Notification preference defaults
 * come from the Drizzle schema, keeping a single source of truth.
 * If you change schema defaults, also update the SQL trigger to match.
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
    // Default to "guest" for non-invited signups (least-privilege)
    let role: "member" | "admin" | "guest" = "guest";
    if (user.email) {
      const invitedUser = await db.query.invitedUsers.findFirst({
        where: eq(invitedUsers.email, user.email.toLowerCase()),
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
      role, // Inherited from invited user or default "guest"
    });

    // Recreate notification preferences
    // Check if they exist first (just in case)
    const prefs = await db.query.notificationPreferences.findFirst({
      where: eq(notificationPreferences.userId, user.id),
    });

    if (!prefs) {
      // Only userId is required — schema defaults handle all preference values.
      // This keeps a single source of truth for defaults in the schema.
      await db.insert(notificationPreferences).values({
        userId: user.id,
      });
    }

    // Transfer guest issues (by email)
    // Matches SQL: WHERE reporter_email = NEW.email AND reported_by IS NULL AND invited_reported_by IS NULL
    const issueIdsToWatch = new Set<string>();
    if (user.email) {
      const transferredGuestIssues = await db
        .update(issues)
        .set({
          reportedBy: user.id,
          reporterName: null,
          reporterEmail: null,
        })
        .where(
          and(
            eq(issues.reporterEmail, user.email.toLowerCase()),
            isNull(issues.reportedBy),
            isNull(issues.invitedReportedBy)
          )
        )
        .returning({ id: issues.id });
      transferredGuestIssues.forEach((issue) => issueIdsToWatch.add(issue.id));
    }

    // Handle invited users transfer
    if (user.email) {
      const invitedUser = await db.query.invitedUsers.findFirst({
        where: eq(invitedUsers.email, user.email.toLowerCase()),
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
        const transferredInvitedIssues = await db
          .update(issues)
          .set({
            reportedBy: user.id,
            invitedReportedBy: null,
            reporterName: null,
            reporterEmail: null,
          })
          .where(eq(issues.invitedReportedBy, invitedUser.id))
          .returning({ id: issues.id });

        // Delete the invited user record
        await db
          .delete(invitedUsers)
          .where(eq(invitedUsers.id, invitedUser.id));

        transferredInvitedIssues.forEach((issue) =>
          issueIdsToWatch.add(issue.id)
        );
      }
    }

    if (issueIdsToWatch.size > 0) {
      await db
        .insert(issueWatchers)
        .values(
          [...issueIdsToWatch].map((issueId) => ({
            issueId,
            userId: user.id,
          }))
        )
        .onConflictDoNothing();
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
