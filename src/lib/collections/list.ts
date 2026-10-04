import { and, asc, count, eq } from "drizzle-orm";
import { db, type DbTransaction } from "~/server/db";
import {
  collections,
  collectionMachines,
  machines,
  collectionCollaborators,
  userProfiles,
} from "~/server/db/schema";
import { machineNotRemoved } from "~/lib/machines/queries";

export interface CollectionListItem {
  id: string;
  name: string;
  machineCount: number;
}

export interface SharedCollectionListItem {
  id: string;
  name: string;
  machineCount: number;
  ownerName: string;
}

// Machine counts leave out Removed machines (collections-and-tags 5.2).
export async function getMyCollections(
  tx: DbTransaction = db,
  ownerId: string
): Promise<CollectionListItem[]> {
  const rows = await tx
    .select({
      id: collections.id,
      name: collections.name,
      machineCount: count(machines.id),
    })
    .from(collections)
    .leftJoin(
      collectionMachines,
      eq(collectionMachines.collectionId, collections.id)
    )
    .leftJoin(
      machines,
      and(eq(machines.id, collectionMachines.machineId), machineNotRemoved())
    )
    .where(eq(collections.ownerId, ownerId))
    .groupBy(collections.id, collections.name)
    .orderBy(asc(collections.name));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    machineCount: Number(r.machineCount),
  }));
}

/**
 * Count the machines owned by `ownerId`, leaving out Removed ones (PP-s363).
 * A dedicated count rather than `getOwnerCollection`, which eagerly loads every machine and its open issues.
 */
export async function getOwnedMachineCount(
  tx: DbTransaction = db,
  ownerId: string
): Promise<number> {
  const [row] = await tx
    .select({ value: count() })
    .from(machines)
    .where(and(eq(machines.ownerId, ownerId), machineNotRemoved()));
  return Number(row?.value ?? 0);
}

/**
 * Collections where `userId` is an editor collaborator (PP-wqit.7) — the
 * "Shared with you" group. Excludes collections the user owns (those are the
 * "Your collections" group from getMyCollections). Carries the owner's name for
 * the row subtitle.
 */
export async function getSharedWithMe(
  tx: DbTransaction = db,
  userId: string
): Promise<SharedCollectionListItem[]> {
  const rows = await tx
    .select({
      id: collections.id,
      name: collections.name,
      ownerName: userProfiles.name,
      machineCount: count(machines.id),
    })
    .from(collectionCollaborators)
    .innerJoin(
      collections,
      eq(collections.id, collectionCollaborators.collectionId)
    )
    .innerJoin(userProfiles, eq(userProfiles.id, collections.ownerId))
    .leftJoin(
      collectionMachines,
      eq(collectionMachines.collectionId, collections.id)
    )
    .leftJoin(
      machines,
      and(eq(machines.id, collectionMachines.machineId), machineNotRemoved())
    )
    .where(
      and(
        eq(collectionCollaborators.userId, userId),
        eq(collectionCollaborators.role, "editor")
      )
    )
    .groupBy(collections.id, collections.name, userProfiles.name)
    .orderBy(asc(collections.name));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    machineCount: Number(r.machineCount),
    ownerName: r.ownerName,
  }));
}
