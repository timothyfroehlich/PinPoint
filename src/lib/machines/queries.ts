import { db } from "~/server/db";
import {
  machines,
  authUsers,
  userProfiles,
  unconfirmedUsers,
} from "~/server/db/schema";
import { eq } from "drizzle-orm";
import type { MachineOwner } from "~/lib/types";

export async function getMachineOwner(
  machineId: string
): Promise<MachineOwner | null> {
  const result = await db
    .select({
      ownerId: machines.ownerId,
      ownerName: userProfiles.name,
      ownerEmail: authUsers.email,
      unconfirmedOwnerId: machines.unconfirmedOwnerId,
      unconfirmedOwnerName: unconfirmedUsers.name,
      unconfirmedOwnerEmail: unconfirmedUsers.email,
    })
    .from(machines)
    .leftJoin(userProfiles, eq(machines.ownerId, userProfiles.id))
    .leftJoin(authUsers, eq(userProfiles.id, authUsers.id))
    .leftJoin(
      unconfirmedUsers,
      eq(machines.unconfirmedOwnerId, unconfirmedUsers.id)
    )
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

  // Check for unconfirmed owner
  if (row.unconfirmedOwnerId && row.unconfirmedOwnerName) {
    return {
      id: row.unconfirmedOwnerId,
      name: row.unconfirmedOwnerName,
      email: row.unconfirmedOwnerEmail ?? "",
      status: "unconfirmed",
    };
  }

  return null;
}
