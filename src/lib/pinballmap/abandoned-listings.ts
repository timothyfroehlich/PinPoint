import "server-only";

import { eq, notInArray } from "drizzle-orm";

import { db, type DbTransaction } from "~/server/db";
import { pinballmapAbandonedListings } from "~/server/db/schema";
import { createMachineTimelineEvent } from "~/lib/timeline/machine-events";
import type { LocationSnapshot } from "./types";
import type { AbandonedListing } from "./link-columns";

/**
 * Write down a live PinballMap entry a machine just walked away from (PP-l81u).
 *
 * Runs in the caller's transaction so the record and the machine columns commit
 * together — a retitle that lands without its record is the bug this closes.
 * Both writes are local, so nothing here violates CORE-ARCH-011.
 *
 * `onConflictDoNothing` on the lmx: two machines cannot both own the cleanup for
 * one entry, and the one-lister index means the second machine was never the
 * lister anyway.
 */
export async function recordAbandonedListing(
  tx: DbTransaction,
  machineId: string,
  abandoned: AbandonedListing,
  actorId?: string
): Promise<void> {
  await tx
    .insert(pinballmapAbandonedListings)
    .values({
      machineId,
      lmxId: abandoned.lmxId,
      pinballmapMachineId: abandoned.pinballmapMachineId,
    })
    .onConflictDoNothing({
      target: pinballmapAbandonedListings.lmxId,
    });

  await createMachineTimelineEvent(
    machineId,
    {
      sourceType: "lifecycle",
      tag: "lifecycle",
      eventData: {
        kind: "pinballmap_listing",
        action: "abandoned",
        lmxId: abandoned.lmxId,
      },
      ...(actorId === undefined ? {} : { actorId }),
    },
    tx
  );
}

/** Every entry this machine has abandoned and nobody has removed yet. */
export async function listAbandonedForMachine(
  machineId: string
): Promise<{ lmxId: number; pinballmapMachineId: number }[]> {
  const rows = await db
    .select({
      lmxId: pinballmapAbandonedListings.lmxId,
      pinballmapMachineId: pinballmapAbandonedListings.pinballmapMachineId,
    })
    .from(pinballmapAbandonedListings)
    .where(eq(pinballmapAbandonedListings.machineId, machineId));
  return rows;
}

/**
 * Drop records whose entry is no longer on the lineup — someone removed it by
 * hand on pinballmap.com, which is the only cleanup path this bead ships.
 *
 * MUST only be called with a freshly synced snapshot. Callers reach this via
 * `reconcileAfterSync`, which both call sites gate on a successful sync; a
 * failed fetch yields a stale lineup, and treating absence there as "cleaned up"
 * would wipe every record and report cleanup nobody performed (CORE-ARCH-012).
 *
 * Returns how many were cleared.
 */
export async function clearResolvedAbandonments(
  snapshot: LocationSnapshot
): Promise<number> {
  const liveLmxIds = snapshot.lmxes.map((l) => l.id);

  // An empty lineup is a legitimate state (a location with nothing listed), so
  // `notInArray` against an empty list is not usable — it would clear nothing on
  // some drivers and everything on others. Branch explicitly.
  const cleared =
    liveLmxIds.length === 0
      ? await db.delete(pinballmapAbandonedListings).returning({
          id: pinballmapAbandonedListings.id,
        })
      : await db
          .delete(pinballmapAbandonedListings)
          .where(notInArray(pinballmapAbandonedListings.lmxId, liveLmxIds))
          .returning({ id: pinballmapAbandonedListings.id });

  return cleared.length;
}
