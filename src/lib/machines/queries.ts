import { db, type DbTransaction } from "~/server/db";
import {
  invitedUsers,
  issues,
  machines,
  userProfiles,
} from "~/server/db/schema";
import { and, asc, eq, exists, inArray, ne, or, type SQL } from "drizzle-orm";
import type { MachineOwner } from "~/lib/types";

/**
 * Removed is PinPoint's archived presence state (PP-s363). A Removed machine
 * drops out of every surface that lists, counts, picks, or searches machines
 * unless the person opts in; its own page and history stay reachable.
 */
export function machineNotRemoved(): SQL {
  return ne(machines.presenceStatus, "removed");
}

/** An issue-row condition: the issue's machine satisfies `condition`. */
export function issueMachineMatches(condition: SQL): SQL {
  return exists(
    db
      .select({ one: machines.id })
      .from(machines)
      .where(and(eq(machines.initials, issues.machineInitials), condition))
  );
}

/** An issue-row condition: the issue's machine is not Removed. */
export function issueMachineNotRemoved(): SQL {
  return issueMachineMatches(machineNotRemoved());
}

export interface MachineChoice {
  id: string;
  initials: string;
  name: string;
}

/**
 * The machines a picker or filter offers, alphabetical by name. Removed
 * machines are left out unless `includeRemoved` is set; `keepInitials` keeps
 * specific machines listed anyway, such as ones already selected.
 */
export async function getMachineChoices(
  tx: DbTransaction = db,
  options: { includeRemoved?: boolean; keepInitials?: readonly string[] } = {}
): Promise<MachineChoice[]> {
  const keep = options.keepInitials ?? [];
  const where = options.includeRemoved
    ? undefined
    : keep.length > 0
      ? or(machineNotRemoved(), inArray(machines.initials, [...keep]))
      : machineNotRemoved();
  return tx.query.machines.findMany({
    where,
    columns: { id: true, initials: true, name: true },
    orderBy: [asc(machines.name)],
  });
}

/** Initials of the machines `ownerId` owns, other than Removed ones. */
export async function getOwnedMachineInitials(
  tx: DbTransaction = db,
  ownerId: string
): Promise<string[]> {
  const rows = await tx.query.machines.findMany({
    where: and(eq(machines.ownerId, ownerId), machineNotRemoved()),
    columns: { initials: true },
    orderBy: [asc(machines.initials)],
  });
  return rows.map((row) => row.initials);
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
