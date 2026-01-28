import { db } from "~/server/db";
import {
  machines,
  authUsers,
  userProfiles,
  invitedUsers,
} from "~/server/db/schema";
import { eq, sql } from "drizzle-orm";
import type { MachineOwner } from "~/lib/types";

export async function getMachineOwner(
  machineId: string,
  options: { includeEmail?: boolean } = {}
): Promise<MachineOwner | null> {
  const { includeEmail = false } = options;
  const result = await db
    .select({
      ownerId: machines.ownerId,
      ownerName: userProfiles.name,
      ownerEmail: includeEmail ? authUsers.email : sql<null>`null`,
      invitedOwnerId: machines.invitedOwnerId,
      invitedOwnerName: invitedUsers.name,
      invitedOwnerEmail: includeEmail ? invitedUsers.email : sql<null>`null`,
    })
    .from(machines)
    .leftJoin(userProfiles, eq(machines.ownerId, userProfiles.id))
    .leftJoin(authUsers, eq(userProfiles.id, authUsers.id))
    .leftJoin(invitedUsers, eq(machines.invitedOwnerId, invitedUsers.id))
    .where(eq(machines.id, machineId))
    .limit(1);

  const row = result[0];
  if (!row) return null;

  // Check for activated owner first
  if (row.ownerId && row.ownerName) {
    return {
      id: row.ownerId,
      name: row.ownerName,
      email: row.ownerEmail ?? "",
      status: "active",
    };
  }

  // Check for invited owner
  if (row.invitedOwnerId && row.invitedOwnerName) {
    return {
      id: row.invitedOwnerId,
      name: row.invitedOwnerName,
      email: row.invitedOwnerEmail ?? "",
      status: "invited",
    };
  }

  return null;
}
