import { asc, count, eq } from "drizzle-orm";
import { db, type DbTransaction } from "~/server/db";
import { collections, collectionMachines, machines } from "~/server/db/schema";

export interface CollectionListItem {
  id: string;
  name: string;
  machineCount: number;
}

export async function getMyCollections(
  tx: DbTransaction = db,
  ownerId: string
): Promise<CollectionListItem[]> {
  const rows = await tx
    .select({
      id: collections.id,
      name: collections.name,
      machineCount: count(collectionMachines.machineId),
    })
    .from(collections)
    .leftJoin(
      collectionMachines,
      eq(collectionMachines.collectionId, collections.id)
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
 * Count the machines owned by `ownerId` — the size of that user's owner-type
 * collection (/c/owner/[ownerId]). A dedicated count rather than
 * `getOwnerCollection`, which eagerly loads every machine and its open issues.
 */
export async function getOwnedMachineCount(
  tx: DbTransaction = db,
  ownerId: string
): Promise<number> {
  const [row] = await tx
    .select({ value: count() })
    .from(machines)
    .where(eq(machines.ownerId, ownerId));
  return Number(row?.value ?? 0);
}
