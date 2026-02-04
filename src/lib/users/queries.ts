import { db } from "~/server/db";
import { userProfiles, invitedUsers, machines } from "~/server/db/schema";
import { sql, eq, count } from "drizzle-orm";
import type { UnifiedUser } from "~/lib/types";

export async function getUnifiedUsers(
  options: { includeEmails?: boolean } = {}
): Promise<UnifiedUser[]> {
  const { includeEmails = false } = options;

  // Subquery to count machines for activated users
  const activatedMachineCount = db
    .select({
      ownerId: machines.ownerId,
      count: count().as("count"),
    })
    .from(machines)
    .where(sql`${machines.ownerId} IS NOT NULL`)
    .groupBy(machines.ownerId)
    .as("activated_machine_count");

  // Subquery to count machines for invited users
  const invitedMachineCount = db
    .select({
      invitedOwnerId: machines.invitedOwnerId,
      count: count().as("count"),
    })
    .from(machines)
    .where(sql`${machines.invitedOwnerId} IS NOT NULL`)
    .groupBy(machines.invitedOwnerId)
    .as("invited_machine_count");

  // Fetch activated users with machine count
  const activatedUsers = await db
    .select({
      id: userProfiles.id,
      name: userProfiles.name,
      lastName: userProfiles.lastName,
      ...(includeEmails ? { email: userProfiles.email } : {}),
      role: userProfiles.role,
      avatarUrl: userProfiles.avatarUrl,
      status: sql<"active">`'active'`,
      inviteSentAt: sql<null>`null`,
      machineCount: sql<number>`COALESCE(${activatedMachineCount.count}, 0)`,
    })
    .from(userProfiles)
    .leftJoin(
      activatedMachineCount,
      eq(userProfiles.id, activatedMachineCount.ownerId)
    );

  // Fetch invited users with machine count
  const invitedUsersList = await db
    .select({
      id: invitedUsers.id,
      name: invitedUsers.name,
      lastName: invitedUsers.lastName,
      ...(includeEmails ? { email: invitedUsers.email } : {}),
      role: invitedUsers.role,
      avatarUrl: sql<null>`null`,
      status: sql<"invited">`'invited'`,
      inviteSentAt: invitedUsers.inviteSentAt,
      machineCount: sql<number>`COALESCE(${invitedMachineCount.count}, 0)`,
    })
    .from(invitedUsers)
    .leftJoin(
      invitedMachineCount,
      eq(invitedUsers.id, invitedMachineCount.invitedOwnerId)
    );

  // Merge and sort by: confirmed first, then machine count desc, then last name
  const allUsers = [...activatedUsers, ...invitedUsersList].sort((a, b) => {
    // 1. Confirmed (active) users before unconfirmed (invited)
    if (a.status !== b.status) {
      return a.status === "active" ? -1 : 1;
    }

    // 2. Higher machine count first
    const machineCountA = Number(a.machineCount) || 0;
    const machineCountB = Number(b.machineCount) || 0;
    if (machineCountA !== machineCountB) {
      return machineCountB - machineCountA;
    }

    // 3. Alphabetically by last name
    const lastNameA = a.lastName || "";
    const lastNameB = b.lastName || "";
    return lastNameA.localeCompare(lastNameB);
  });

  return allUsers as UnifiedUser[];
}
