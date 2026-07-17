import { asc, count, eq } from "drizzle-orm";
import { db, type DbTransaction } from "~/server/db";
import { collections, collectionMachines } from "~/server/db/schema";

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
