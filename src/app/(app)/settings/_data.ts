import "server-only";

import { and, count, eq, ne } from "drizzle-orm";

import { db } from "~/server/db";
import {
  machines,
  notificationPreferences,
  userProfiles,
} from "~/server/db/schema";

type NotificationPreference = typeof notificationPreferences.$inferSelect;

/**
 * The account fields only the Settings page needs: the email and the Discord
 * link. Email stays out of the shared viewer (CORE-SEC-007).
 */
export async function getSettingsAccount(
  userId: string
): Promise<{ email: string; discordUserId: string | null } | undefined> {
  return db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, userId),
    columns: { email: true, discordUserId: true },
  });
}

/**
 * The user's notification preferences. A user with no preferences row (an old
 * account) gets one created with the defaults, so this writes on first read.
 */
export async function ensureNotificationPreferences(
  userId: string
): Promise<NotificationPreference> {
  let preferences = await db.query.notificationPreferences.findFirst({
    where: eq(notificationPreferences.userId, userId),
  });

  // Create default preferences if they don't exist (fallback for old users)
  if (!preferences) {
    [preferences] = await db
      .insert(notificationPreferences)
      .values({ userId })
      .returning();
  }

  if (!preferences) {
    throw new Error("Failed to create notification preferences");
  }
  return preferences;
}

/**
 * How many machines the user owns, Removed ones included — the account
 * deletion section's reassignment prompt counts every machine whose owner
 * would change.
 */
export async function getOwnedMachineTotal(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(machines)
    .where(eq(machines.ownerId, userId));
  return row?.count ?? 0;
}

/** How many admins there are besides this user, for the sole-admin check. */
export async function countOtherAdmins(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(userProfiles)
    .where(and(eq(userProfiles.role, "admin"), ne(userProfiles.id, userId)));
  return row?.count ?? 0;
}
