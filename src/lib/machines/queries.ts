import { db } from "~/server/db";
import { machines, userProfiles, invitedUsers } from "~/server/db/schema";
import { eq, ne, type SQL } from "drizzle-orm";
import type { MachineOwner } from "~/lib/types";

/**
 * Removed is PinPoint's archived presence state (PP-s363). A Removed machine
 * drops out of every surface that lists, counts, picks, or searches machines
 * unless the person opts in; its own page and history stay reachable.
 */
export function machineNotRemoved(): SQL {
  return ne(machines.presenceStatus, "removed");
}

export async function getMachineOwner(
  machineId: string
): Promise<MachineOwner | null> {
  const result = await db
    .select({
      ownerId: machines.ownerId,
      ownerName: userProfiles.name,
      invitedOwnerId: machines.invitedOwnerId,
      invitedOwnerName: invitedUsers.name,
    })
    .from(machines)
    .leftJoin(userProfiles, eq(machines.ownerId, userProfiles.id))
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
      email: "",
      status: "active",
    };
  }

  // Check for invited owner
  if (row.invitedOwnerId && row.invitedOwnerName) {
    return {
      id: row.invitedOwnerId,
      name: row.invitedOwnerName,
      email: "",
      status: "invited",
    };
  }

  return null;
}
