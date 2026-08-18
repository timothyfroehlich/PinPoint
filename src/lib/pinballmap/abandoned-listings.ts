import "server-only";

import { and, eq, inArray, isNotNull, notInArray, or, sql } from "drizzle-orm";

import { db, type DbTransaction } from "~/server/db";
import {
  machines,
  pinballmapAbandonedListings,
  pinballmapState,
} from "~/server/db/schema";
import { createMachineTimelineEvent } from "~/lib/timeline/machine-events";
import { APC_LOCATION_ID } from "./config";
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
 * abandons lmx 4471 (retitles off title 6221); somebody later turns a DIFFERENT
 * machine B on for title 6221, so B now covers that still-live entry; B later
 * retitles too, abandoning the same lmx a second time. A plain
 * `onConflictDoNothing` would silently leave the record pointing at A after B is
 * the one who actually walked away from it. Re-point `machineId` /
 * `pinballmapMachineId` / `createdAt` at whoever abandoned it most recently.
 */
export async function recordAbandonedListing(
  tx: DbTransaction,
  machineId: string,
  abandoned: AbandonedListing,
  actorId?: string
): Promise<void> {
  // Which location this entry belonged to, read from the singleton inside the
  // caller's transaction. A local read, so CORE-ARCH-011 (external effects only)
  // is not in play. Falls back to the APC default only if the singleton row is
  // somehow absent, which cannot happen while PBM is configured enough to have
  // an entry to walk away from.
  const [state] = await tx
    .select({ locationId: pinballmapState.locationId })
    .from(pinballmapState)
    .where(eq(pinballmapState.id, "singleton"));
  const locationId = state?.locationId ?? APC_LOCATION_ID;

  await tx
    .insert(pinballmapAbandonedListings)
    .values({
      machineId,
      lmxId: abandoned.lmxId,
      pinballmapMachineId: abandoned.pinballmapMachineId,
      locationId,
    })
    .onConflictDoUpdate({
      target: pinballmapAbandonedListings.lmxId,
      set: {
        machineId,
        pinballmapMachineId: abandoned.pinballmapMachineId,
        locationId,
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
 * Every write that starts covering an entry has to call this in its own
 * transaction — today that is the outbound add, which can capture an lmx some
 * machine walked away from, because PBM hands back the EXISTING lmx when the
 * entry is already on the lineup.
 *
 * Waiting for the hourly `clearResolvedAbandonments` instead would leave an
 * alert telling its owner to remove an entry that is live and covered again, for
 * up to an hour (CORE-ARCH-012). Deleting by lmx rather than by machine is
 * deliberate: whoever previously abandoned it is not necessarily the machine
 * covering it now.
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
 * The abandoned entries that actually SURFACE on this machine's pages.
 *
 * `listAbandonedForMachine` returns every record; spec 2.5 says only some of
 * them belong here. While any cabinet is still matched to the old title, the
 * entry is that title's ordinary business and already shows through those
 * cabinets' own states (as Lingering, which offers the same Remove) — surfacing
 * it here as well would put one entry on two pages with two different
 * explanations, and this is the page whose explanation is wrong, because this
 * machine is not the one that title belongs to any more.
 *
 * Note the test is MATCHED, not covered: a sibling matched to the old title
 * with intent Off is already handling it even though nothing covers the entry.
 *
 * **This lives here rather than beside either caller because both the Manage
 * tab's alert and the Info tab's "Config issue" chip have to answer it the same
 * way.** The chip's only job is to send a reader to the alert; when the filter
 * lived on the Manage page alone the chip fired on entries the alert then hid,
 * pointing at a page that showed nothing wrong.
 */
export async function listSurfacingAbandonedForMachine(
  machineId: string
): Promise<{ lmxId: number; pinballmapMachineId: number }[]> {
  const rows = await listAbandonedForMachine(machineId);
  if (rows.length === 0) return rows;

  const titleIds = rows.map((r) => r.pinballmapMachineId);
  const matched = await db
    .selectDistinct({ pinballmapMachineId: machines.pinballmapMachineId })
    .from(machines)
    .where(inArray(machines.pinballmapMachineId, titleIds));
  const stillInTheFleet = new Set(
    matched.flatMap((r) =>
      r.pinballmapMachineId === null ? [] : [r.pinballmapMachineId]
    )
  );

  return rows.filter((r) => !stillInTheFleet.has(r.pinballmapMachineId));
}

/**
 * Drop records whose entry is no longer on the lineup — someone removed it by
 * hand on pinballmap.com — OR whose title some cabinet now COVERS, meaning an
 * operator deliberately put that title back on the lineup and the entry is
 * somebody's business again. The coverage check runs regardless of lineup
 * presence: the entry is typically still ON the synced lineup when this fires,
 * since the covering cabinet is why it is there.
 *
 * "No longer on the lineup" is not the same question as "this row id is gone".
 * PBM reissues row ids under a live entry (a delete plus a re-add outside their
 * 7-day window). Keying the clear on the lmx alone would read that drift as
 * "someone removed it", retract the alert and report the removal in
 * `abandonmentsCleared`, while the orphan is still sitting on the public map
 * under a new id (CORE-ARCH-012).
 *
 * So the record clears when its lmx is off the lineup AND no entry still on the
 * lineup under its title is UNcovered. An uncovered entry under that title is
 * the reissued-id case and holds the record open; a covered one belongs to a
 * cabinet we know about and says nothing about the orphan. Checking coverage —
 * rather than the title's mere presence — is what keeps a second cabinet of the
 * same title from pinning the alert open forever, which matters because
 * duplicate titles are ordinary in a 100+ machine collection and there is
 * deliberately no dismiss control.
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

  // Some cabinet now wants this title on the lineup, so the entry is covered and
  // the record describes nothing. Left unhandled, the machine's own page would
  // tell its owner "this entry is still on Pinball Map — remove it there," and
  // following that instruction would delete an entry another cabinet depends on
  // (CORE-ARCH-012: the alert implies an action that must not happen).
  //
  // Matched on the TITLE rather than on a stored handle, because there is no
  // per-machine lmx any more: coverage is "at least one same-title cabinet has
  // intent On" and nothing else (spec §1).
  const titleIsCoveredAgain = sql`EXISTS (
    SELECT 1 FROM ${machines}
    WHERE ${machines.pinballmapIntent} = 'on'
      AND ${machines.pinballmapMachineId} = ${pinballmapAbandonedListings.pinballmapMachineId}
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

  // Note what the broken payload does NOT suppress: the coverage clear above.
  // That one reads only local `machines` — no lineup involved — and it is a
  // safety clear, retracting an instruction to delete an entry some cabinet now
  // depends on. Suppressing it would leave that instruction on screen for as
  // long as PBM keeps serving the malformed shape.
  const conditions = [titleIsCoveredAgain];

  if (!payloadIsBroken) {
    // Entries on the lineup that no cabinet covers. One of these under an
    // abandoned record's title may BE that record's entry under a reissued row
    // id, so it holds the record open.
    const coveredTitleIds = new Set(
      (
        await db
          .select({ pinballmapMachineId: machines.pinballmapMachineId })
          .from(machines)
          .where(
            and(
              eq(machines.pinballmapIntent, "on"),
              isNotNull(machines.pinballmapMachineId)
            )
          )
      ).flatMap((row) =>
        row.pinballmapMachineId === null ? [] : [row.pinballmapMachineId]
      )
    );
    const uncoveredTitleIds = [
      ...new Set(
        snapshot.lmxes
          .filter((l) => !coveredTitleIds.has(l.machineId))
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
      uncoveredTitleIds.length === 0
        ? lmxIsGone
        : sql`${lmxIsGone} AND ${notInArray(
            pinballmapAbandonedListings.pinballmapMachineId,
            uncoveredTitleIds
          )}`
    );
  }

  const cleared = await db
    .delete(pinballmapAbandonedListings)
    .where(or(...conditions))
    .returning({ id: pinballmapAbandonedListings.id });

  return cleared.length;
}
