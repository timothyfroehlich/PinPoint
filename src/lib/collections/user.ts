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
  /**
   * Current view-share token (null = sharing off). Only surfaced to the owner
   * via the Share dialog; never rendered for view-token or admin visitors.
   */
  viewToken: string | null;
  machines: CollectionMachine[];
}

const uuidSchema = z.uuid();

/** The base collection row shared by the id and token resolvers. */
interface CollectionBase {
  id: string;
  name: string;
  description: ProseMirrorDoc | null;
  viewToken: string | null;
  owner: { id: string; name: string };
}

const baseColumns = {
  id: true,
  name: true,
  description: true,
  viewToken: true,
} as const;

/**
 * Hydrate a resolved collection row with its machines (open-issues-only, same
 * `CollectionMachine[]` shape as getOwnerCollection so the /c/ tabs, summary,
 * and timeline reuse it unchanged). Shared by both resolvers — the machine
 * query is large and load-bearing, so it lives here once (Rule-of-Three
 * caveat: DRY the second instance when the duplicated thing is substantial).
 */
async function hydrateCollection(
  tx: DbTransaction,
  base: CollectionBase
): Promise<UserCollection> {
  const memberRows = await tx
    .select({ machineId: collectionMachines.machineId })
    .from(collectionMachines)
    .where(eq(collectionMachines.collectionId, base.id));
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
    id: base.id,
    name: base.name,
    description: base.description ?? null,
    owner: base.owner,
    viewToken: base.viewToken,
    machines: machineRows,
  };
}

/**
 * Resolve a user-created collection by its canonical id.
 *
 * Pure data — authorization lives in ./access + the route loader. A raw id is
 * NOT a capability: the loader only grants access to the owner/admin, so this
 * returning a row does not by itself imply the caller may see it.
 *
 * Returns null when the id is malformed or no such collection exists.
 */
export async function getCollection(
  tx: DbTransaction = db,
  collectionId: string
): Promise<UserCollection | null> {
  if (!uuidSchema.safeParse(collectionId).success) return null;

  const base = await tx.query.collections.findFirst({
    where: eq(collections.id, collectionId),
    columns: baseColumns,
    with: { owner: { columns: { id: true, name: true } } },
  });
  if (!base) return null;
  return hydrateCollection(tx, base);
}

/**
 * Resolve a collection by its view-share token (Wave 0b, PP-wqit.2).
 *
 * Unlike the id, the token IS the capability: a caller presenting a valid,
 * non-null token has been granted anonymous read access by the owner. The
 * loader maps a hit to read-only access and a miss to notFound().
 *
 * Returns null for an empty token or no match. (A null `view_token` column
 * means sharing is off; `eq(view_token, "")` / a random string simply won't
 * match, so disabled collections are never reachable by token.)
 */
export async function getCollectionByViewToken(
  tx: DbTransaction = db,
  token: string
): Promise<UserCollection | null> {
  if (token.length === 0) return null;

  const base = await tx.query.collections.findFirst({
    where: eq(collections.viewToken, token),
    columns: baseColumns,
    with: { owner: { columns: { id: true, name: true } } },
  });
  if (!base) return null;
  return hydrateCollection(tx, base);
}
