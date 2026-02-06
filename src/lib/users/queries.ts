import { db } from "~/server/db";
import { userProfiles, invitedUsers, machines } from "~/server/db/schema";
import { sql, eq, count } from "drizzle-orm";
import type { UnifiedUser, UserStatus } from "~/lib/types";

// Import comparator from its own module (safe for client-side imports)
import { compareUnifiedUsers } from "./comparators";
// Re-export for backwards compatibility with server-side consumers
export { compareUnifiedUsers } from "./comparators";

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
  const activatedUsersRaw = await db
    .select({
      id: userProfiles.id,
      name: userProfiles.name,
      lastName: userProfiles.lastName,
      email: userProfiles.email,
      role: userProfiles.role,
      avatarUrl: userProfiles.avatarUrl,
      status: sql<UserStatus>`'active'`,
      inviteSentAt: sql<Date | null>`null`,
      machineCount: sql<number>`COALESCE(${activatedMachineCount.count}::int, 0)`,
    })
    .from(userProfiles)
    .leftJoin(
      activatedMachineCount,
      eq(userProfiles.id, activatedMachineCount.ownerId)
    );

  // Fetch invited users with machine count
  const invitedUsersRaw = await db
    .select({
      id: invitedUsers.id,
      name: invitedUsers.name,
      lastName: invitedUsers.lastName,
      email: invitedUsers.email,
      role: invitedUsers.role,
      avatarUrl: sql<string | null>`null`,
      status: sql<UserStatus>`'invited'`,
      inviteSentAt: invitedUsers.inviteSentAt,
      machineCount: sql<number>`COALESCE(${invitedMachineCount.count}::int, 0)`,
    })
    .from(invitedUsers)
    .leftJoin(
      invitedMachineCount,
      eq(invitedUsers.id, invitedMachineCount.invitedOwnerId)
    );

  // Transform to UnifiedUser[], optionally excluding emails
  const activatedUsers: UnifiedUser[] = activatedUsersRaw.map((u) => ({
    id: u.id,
    name: u.name,
    lastName: u.lastName,
    role: u.role,
    avatarUrl: u.avatarUrl,
    status: u.status,
    inviteSentAt: u.inviteSentAt,
    machineCount: u.machineCount,
    ...(includeEmails && { email: u.email }),
  }));

  const invitedUsersList: UnifiedUser[] = invitedUsersRaw.map((u) => ({
    id: u.id,
    name: u.name,
    lastName: u.lastName,
    role: u.role,
    avatarUrl: u.avatarUrl,
    status: u.status,
    inviteSentAt: u.inviteSentAt,
    machineCount: u.machineCount,
    ...(includeEmails && { email: u.email }),
  }));

  // Merge and sort using the exported comparator
  return [...activatedUsers, ...invitedUsersList].sort(compareUnifiedUsers);
}
