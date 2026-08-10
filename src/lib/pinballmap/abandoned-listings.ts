import "server-only";

import { and, eq, notInArray, or, sql } from "drizzle-orm";

import { db, type DbTransaction } from "~/server/db";
import { machines, pinballmapAbandonedListings } from "~/server/db/schema";
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
 * `onConflictDoUpdate` on the lmx: the entry is tracked at most once, but WHICH
 * machine owns its cleanup can legitimately change over time. Machine A
 * abandons lmx 4471 (retitles off title 6221); a later save auto-links a
 * DIFFERENT machine B to that same still-live lmx under title 6221; B later
 * retitles too, abandoning the same lmx a second time. The one-lister index
 * (`machines_pinballmap_listed_unique`) only forbids two SIMULTANEOUSLY
 * listed machines under one title — it says nothing about this sequential
 * case, so a plain `onConflictDoNothing` would silently leave the record
 * pointing at A after B is the one who actually walked away from it. Re-point
 * `machineId` / `pinballmapMachineId` / `createdAt` at whoever abandoned it
 * most recently.
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
    .onConflictDoUpdate({
      target: pinballmapAbandonedListings.lmxId,
      set: {
        machineId,
        pinballmapMachineId: abandoned.pinballmapMachineId,
        createdAt: new Date(),
      },
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

/**
 * Every entry this machine has abandoned and nobody has removed yet.
 *
 * Wired up on the machine's PinballMap card (Task 5, PP-l81u) — see
 * `src/app/(app)/m/[initials]/(tabs)/page.tsx`.
 */
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
 * hand on pinballmap.com — OR whose lmx a listed machine has since reclaimed
 * (most often auto-link re-capturing the entry under a different, or the same,
 * title). The reclaim check runs regardless of lineup presence: the entry is
 * typically still ON the synced lineup when this fires, since the reclaiming
 * machine is the one now holding it live.
 *
 * "No longer on the lineup" needs BOTH the lmx and its title to be gone.
 * PBM row ids move under a live entry — that is the whole reason
 * `reconcileAfterSync` has a HEAL effect ("same title, PBM's row id just moved
 * — a delete + re-add"). Keying the clear on the lmx alone would read that
 * drift as "someone removed it", delete the record, retract the notice and
 * report the removal in `abandonmentsCleared`, while the orphan is still
 * sitting on the public map under a new id (CORE-ARCH-012). Requiring the title
 * to be absent too costs only a false POSITIVE — the notice lingering while
 * some other cabinet's entry for the same title is on the lineup — and a
 * lingering "go look" beats a false "resolved".
 *
 * MUST only be called with a freshly synced snapshot. Called from
 * `reconcileAfterSync` (PP-l81u), gated on both its call sites having a
 * successful sync; a failed fetch yields a stale lineup, and treating absence
 * there as "cleaned up" would wipe every record and report cleanup nobody
 * performed (CORE-ARCH-012).
 *
 * Returns how many were cleared.
 */
export async function clearResolvedAbandonments(
  snapshot: LocationSnapshot
): Promise<number> {
  const liveLmxIds = snapshot.lmxes.map((l) => l.id);
  const liveTitleIds = [...new Set(snapshot.lmxes.map((l) => l.machineId))];

  // A listed machine already holding this lmx has reclaimed it. Left
  // unhandled, the machine's own card would tell its owner "this entry is
  // still on Pinball Map — remove it there," and following that instruction
  // would delete a listing that is live again (CORE-ARCH-012: the notice
  // implies an action that must not happen).
  const reclaimedByListedMachine = sql`EXISTS (
    SELECT 1 FROM ${machines}
    WHERE ${machines.pinballmapListed}
      AND ${machines.pinballmapLmxId} = ${pinballmapAbandonedListings.lmxId}
  )`;

  if (liveLmxIds.length === 0) {
    // PBM's own `machine_count` is the cross-check `parseLocation` hands us
    // for free. An empty lineup that ALSO reports zero machines is a
    // genuinely empty location — safe to clear everything (nothing on it can
    // be a still-live reclaim either). An empty lineup that reports machines
    // present is a broken or renamed payload: `parseLocation` defaults
    // `lmxes` to `[]` and silently drops unparseable xrefs, so this shape is
    // reachable from a 200 response, not just a failed fetch. Clearing on it
    // would wipe every record and report cleanup that never happened
    // (CORE-ARCH-012) — refuse instead, leaving every record for the next
    // healthy sync to resolve.
    //
    // `machineCount` itself falls back to `lmxes.length` when PBM omits the
    // field — considered, not missed: an omitted count alongside an empty
    // lineup has nothing to contradict, so it still reads as genuinely empty.
    if (snapshot.machineCount > 0) {
      return 0;
    }
    const cleared = await db.delete(pinballmapAbandonedListings).returning({
      id: pinballmapAbandonedListings.id,
    });
    return cleared.length;
  }

  const cleared = await db
    .delete(pinballmapAbandonedListings)
    .where(
      or(
        and(
          notInArray(pinballmapAbandonedListings.lmxId, liveLmxIds),
          notInArray(
            pinballmapAbandonedListings.pinballmapMachineId,
            liveTitleIds
          )
        ),
        reclaimedByListedMachine
      )
    )
    .returning({ id: pinballmapAbandonedListings.id });

  return cleared.length;
}
