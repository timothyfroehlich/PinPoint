import { asc, eq, inArray, notInArray } from "drizzle-orm";
import { z } from "zod";
import { db, type DbTransaction } from "~/server/db";
import {
  collections,
  collectionMachines,
  issues,
  machines,
} from "~/server/db/schema";
import { CLOSED_STATUSES } from "~/lib/issues/status";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";
import type { CollectionMachine } from "./owner";

export interface UserCollection {
  id: string;
  name: string;
  description: ProseMirrorDoc | null;
  owner: { id: string; name: string };
  machines: CollectionMachine[];
}

const uuidSchema = z.uuid();

/**
 * Resolve a user-created collection: the machines explicitly added to it.
 *
 * The second collection resolver (spec §Reuse of the existing collection
 * view), returning the same open-issues-only `CollectionMachine[]` shape as
 * getOwnerCollection so the /c/ tabs, summary, and timeline reuse it unchanged.
 * Pure data — authorization lives in ./access + the route loader.
 *
 * Returns null when the id is malformed or no such collection exists.
 */
export async function getCollection(
  tx: DbTransaction = db,
  collectionId: string
): Promise<UserCollection | null> {
  if (!uuidSchema.safeParse(collectionId).success) return null;

  const collection = await tx.query.collections.findFirst({
    where: eq(collections.id, collectionId),
    columns: { id: true, name: true, description: true, ownerId: true },
    with: { owner: { columns: { id: true, name: true } } },
  });
  if (!collection) return null;

  const memberRows = await tx
    .select({ machineId: collectionMachines.machineId })
    .from(collectionMachines)
    .where(eq(collectionMachines.collectionId, collectionId));
  const machineIds = memberRows.map((r) => r.machineId);

  const machineRows: CollectionMachine[] =
    machineIds.length === 0
      ? []
      : await tx.query.machines.findMany({
          where: inArray(machines.id, machineIds),
          columns: {
            id: true,
            initials: true,
            name: true,
            presenceStatus: true,
          },
          with: {
            issues: {
              where: notInArray(issues.status, [...CLOSED_STATUSES]),
              columns: { status: true, severity: true, createdAt: true },
            },
          },
          orderBy: [asc(machines.name)],
        });

  return {
    id: collection.id,
    name: collection.name,
    description: collection.description ?? null,
    owner: collection.owner,
    machines: machineRows,
  };
}
