import { db } from "~/server/db";
import { userProfiles, unconfirmedUsers } from "~/server/db/schema";
import { sql } from "drizzle-orm";
import type { UnifiedUser } from "~/lib/types";

export async function getUnifiedUsers(): Promise<UnifiedUser[]> {
  // Fetch activated users
  const activatedUsers = await db
    .select({
      id: userProfiles.id,
      name: userProfiles.name,
      email: userProfiles.email,
      role: userProfiles.role,
      avatarUrl: userProfiles.avatarUrl,
      status: sql<"active">`'active'`,
      inviteSentAt: sql<null>`null`,
    })
    .from(userProfiles);

  // Fetch unconfirmed users
  const unconfirmedUsersList = await db
    .select({
      id: unconfirmedUsers.id,
      name: unconfirmedUsers.name,
      email: unconfirmedUsers.email,
      role: unconfirmedUsers.role,
      avatarUrl: sql<null>`null`,
      status: sql<"unconfirmed">`'unconfirmed'`,
      inviteSentAt: unconfirmedUsers.inviteSentAt,
    })
    .from(unconfirmedUsers);

  // Merge and sort by name
  const allUsers = [...activatedUsers, ...unconfirmedUsersList].sort((a, b) => {
    if (!a.name) return 1;
    if (!b.name) return -1;
    return a.name.localeCompare(b.name);
  });

  return allUsers as UnifiedUser[];
}
