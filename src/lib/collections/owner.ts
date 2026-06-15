import { asc, eq, notInArray } from "drizzle-orm";
import { z } from "zod";
import { db, type DbTransaction } from "~/server/db";
import { issues, machines, userProfiles } from "~/server/db/schema";
import { CLOSED_STATUSES } from "~/lib/issues/status";
import type { IssueSeverity, IssueStatus } from "~/lib/types";
import type { MachinePresenceStatus } from "~/lib/machines/presence";

/** One machine in a resolved collection. `issues` contains OPEN issues only. */
export interface CollectionMachine {
  id: string;
  initials: string;
  name: string;
  presenceStatus: MachinePresenceStatus;
  issues: { status: IssueStatus; severity: IssueSeverity; createdAt: Date }[];
}

export interface OwnerCollection {
  owner: { id: string; name: string };
  machines: CollectionMachine[];
}

const uuidSchema = z.uuid();

/**
 * Resolve an owner-type collection: the machines owned by `userId`.
 *
 * This is the v1 collection resolver (spec §Architecture). Downstream
 * aggregate queries take the machine id/initials lists from the result —
 * never an owner id — so future collection sources (tags, ad-hoc sets)
 * only need a new resolver.
 *
 * Returns null when the user id is malformed or no such user exists.
 */
export async function getOwnerCollection(
  tx: DbTransaction = db,
  userId: string
): Promise<OwnerCollection | null> {
  if (!uuidSchema.safeParse(userId).success) return null;

  // The machines query keys off ownerId, not the owner row, so the two have no
  // data dependency — run them concurrently to save a round-trip on the common
  // (owner-exists) path. A discarded machines query when the owner is missing
  // is an acceptable cost for the rare not-found case.
  const [owner, machineRows] = await Promise.all([
    tx.query.userProfiles.findFirst({
      where: eq(userProfiles.id, userId),
      columns: { id: true, name: true },
    }),
    tx.query.machines.findMany({
      where: eq(machines.ownerId, userId),
      columns: { id: true, initials: true, name: true, presenceStatus: true },
      with: {
        issues: {
          where: notInArray(issues.status, [...CLOSED_STATUSES]),
          columns: { status: true, severity: true, createdAt: true },
        },
      },
      orderBy: [asc(machines.name)],
    }),
  ]);
  if (!owner) return null;

  return { owner, machines: machineRows };
}
