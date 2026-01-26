import { db } from "~/server/db";
import { userProfiles, invitedUsers } from "~/server/db/schema";
import { sql } from "drizzle-orm";
import type { UnifiedUser } from "~/lib/types";

export async function getUnifiedUsers(
  options: { includeEmails?: boolean } = {}
): Promise<UnifiedUser[]> {
  const { includeEmails = false } = options;

  // Fetch activated users
  const activatedUsers = await db
    .select({
      id: userProfiles.id,
      name: userProfiles.name,
      ...(includeEmails ? { email: userProfiles.email } : {}),
      role: userProfiles.role,
      avatarUrl: userProfiles.avatarUrl,
      status: sql<"active">`'active'`,
      inviteSentAt: sql<null>`null`,
    })
    .from(userProfiles);

  // Fetch invited users
  const invitedUsersList = await db
    .select({
      id: invitedUsers.id,
      name: invitedUsers.name,
      ...(includeEmails ? { email: invitedUsers.email } : {}),
      role: invitedUsers.role,
      avatarUrl: sql<null>`null`,
      status: sql<"invited">`'invited'`,
      inviteSentAt: invitedUsers.inviteSentAt,
    })
    .from(invitedUsers);

  // Merge and sort by name
  const allUsers = [...activatedUsers, ...invitedUsersList].sort((a, b) => {
    if (!a.name) return 1;
    if (!b.name) return -1;
    return a.name.localeCompare(b.name);
  });

  return allUsers as UnifiedUser[];
}
