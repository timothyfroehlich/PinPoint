import "server-only";

import { and, eq, isNotNull, notInArray, or, sql } from "drizzle-orm";

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
 * Retire the record for an lmx a machine is claiming right now (PP-l81u).
 *
 * Every write that sets `pinballmap_listed = true` alongside an lmx has to call
 * this in its own transaction, and there are four: `applyAutoLinkWrite`, the
 * manual link, the outbound list, and the verify/heal. Two of those can capture
 * an lmx some machine walked away from — PBM hands back the EXISTING lmx when
 * the entry is already on the lineup, and a heal claims a re-minted id.
 *
 * Waiting for the hourly `clearResolvedAbandonments` instead would leave a card
 * telling its owner to remove an entry that is live and claimed again, for up
 * to an hour (CORE-ARCH-012). Deleting by lmx rather than by machine is
 * deliberate: whoever previously abandoned it is not necessarily the machine
 * claiming it now.
 *
 * A no-op when nothing was abandoned, which is the common case.
 */
export async function retireAbandonmentForLmx(
  tx: DbTransaction,
  lmxId: number
): Promise<void> {
  await tx
    .delete(pinballmapAbandonedListings)
    .where(eq(pinballmapAbandonedListings.lmxId, lmxId));
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
 * "No longer on the lineup" is not the same question as "this row id is gone".
 * PBM reissues row ids under a live entry — that is the whole reason
 * `reconcileAfterSync` has a HEAL effect ("same title, PBM's row id just moved
 * — a delete + re-add"). Keying the clear on the lmx alone would read that
 * drift as "someone removed it", retract the notice and report the removal in
 * `abandonmentsCleared`, while the orphan is still sitting on the public map
 * under a new id (CORE-ARCH-012).
 *
 * So the record clears when its lmx is off the lineup AND every entry still on
 * the lineup under its title is claimed by a listed machine. An UNclaimed entry
 * under that title is the reissued-id case and holds the record open; a claimed
 * one belongs to a cabinet we know about and says nothing about the orphan.
 * Checking claimed-ness — rather than the title's mere presence — is what keeps
 * a second cabinet listed under the same title from pinning the notice open
 * forever, which matters because duplicate titles are ordinary in a 100+
 * machine collection and there is deliberately no dismiss control.
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

  // PBM's own `machine_count` is the cross-check `parseLocation` hands us for
  // free. An empty lineup that ALSO reports zero machines is a genuinely empty
  // location. An empty lineup that reports machines present is a broken or
  // renamed payload: `parseLocation` defaults `lmxes` to `[]` and silently
  // drops unparseable xrefs, so this shape is reachable from a 200 response,
  // not just a failed fetch. Treating it as "everything was removed" would
  // wipe every record and report cleanup that never happened (CORE-ARCH-012).
  //
  // `machineCount` itself falls back to `lmxes.length` when PBM omits the
  // field — considered, not missed: an omitted count alongside an empty lineup
  // has nothing to contradict, so it still reads as genuinely empty.
  const payloadIsBroken = liveLmxIds.length === 0 && snapshot.machineCount > 0;

  // Note what the broken payload does NOT suppress: the reclaim clear below.
  // That one reads only local `machines` — no lineup involved — and it is a
  // safety clear, retracting an instruction to delete a listing some machine
  // now depends on. Suppressing it would leave that instruction on screen for
  // as long as PBM keeps serving the malformed shape.
  const conditions = [reclaimedByListedMachine];

  if (!payloadIsBroken) {
    // Entries on the lineup that no listed machine claims. One of these under
    // an abandoned record's title may BE that record's entry under a reissued
    // row id, so it holds the record open.
    const heldLmxIds = new Set(
      (
        await db
          .select({ lmxId: machines.pinballmapLmxId })
          .from(machines)
          .where(
            and(
              eq(machines.pinballmapListed, true),
              isNotNull(machines.pinballmapLmxId)
            )
          )
      ).flatMap((row) => (row.lmxId === null ? [] : [row.lmxId]))
    );
    const unclaimedTitleIds = [
      ...new Set(
        snapshot.lmxes
          .filter((l) => !heldLmxIds.has(l.id))
          .map((l) => l.machineId)
      ),
    ];

    // An empty lineup carries no entry at all, so every record's entry is gone
    // — and `notInArray` against `[]` is not a query drizzle will build.
    const lmxIsGone =
      liveLmxIds.length === 0
        ? sql`true`
        : notInArray(pinballmapAbandonedListings.lmxId, liveLmxIds);

    conditions.push(
      unclaimedTitleIds.length === 0
        ? lmxIsGone
        : sql`${lmxIsGone} AND ${notInArray(
            pinballmapAbandonedListings.pinballmapMachineId,
            unclaimedTitleIds
          )}`
    );
  }

  const cleared = await db
    .delete(pinballmapAbandonedListings)
    .where(or(...conditions))
    .returning({ id: pinballmapAbandonedListings.id });

  return cleared.length;
}
