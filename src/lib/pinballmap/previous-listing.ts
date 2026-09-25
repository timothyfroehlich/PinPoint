import "server-only";
import {
  and,
  eq,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  notInArray,
  or,
} from "drizzle-orm";

import type { DbTransaction } from "~/server/db";
import { pinballmapComments } from "~/server/db/schema";
import type { PbmLmx } from "./types";

/**
 * Marking imported Pinball Map comments as belonging to a previous listing
 * (pinballmap spec 7.2, 7.3, 10.9; PP-o355.36). The mark lives on the comment,
 * not on a timeline copy, so every covering machine shows it.
 */

/**
 * Pinball Map restores a removed entry, with its comments, when the same game
 * is re-added at the same location within this many days (spec 7.2). Past it
 * the entry is gone for good.
 */
export const PINBALLMAP_RESTORE_WINDOW_DAYS = 7;

/**
 * Track which of the tracked location's comments belong to an entry that has
 * ended (spec 7.2, 7.3), judged against the stored snapshot:
 *
 *  - An entry absent from the lineup starts its restoration window at the
 *    snapshot that first saw it missing. That observation is never earlier
 *    than Pinball Map's removal, so the window cannot close early.
 *  - A different entry for the same title means the old one is gone for good
 *    (Pinball Map would have restored the old entry inside the window), so
 *    its comments are marked at once.
 *  - An entry still missing when the window has passed is marked.
 *  - An entry seen again is the same listing resumed: its window resets and a
 *    removal mark is cleared. A location-change mark (spec 10.9) never is.
 */
export async function markEndedEntries(
  tx: DbTransaction,
  locationId: number,
  snapshot: { lmxes: readonly PbmLmx[]; fetchedAtIso: string }
): Promise<void> {
  const presentLmxIds = snapshot.lmxes.map((lmx) => lmx.id);
  const presentTitles = [...new Set(snapshot.lmxes.map((l) => l.machineId))];
  const fetchedAt = new Date(snapshot.fetchedAtIso);
  const observedAt = Number.isNaN(fetchedAt.getTime()) ? new Date() : fetchedAt;
  const now = new Date();
  const windowStart = new Date(
    now.getTime() - PINBALLMAP_RESTORE_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );
  const atLocation = eq(pinballmapComments.locationId, locationId);
  const present = inArray(pinballmapComments.lmxId, presentLmxIds);
  const absent = notInArray(pinballmapComments.lmxId, presentLmxIds);
  const unmarked = isNull(pinballmapComments.previousListingReason);

  // Seen again: the window resets, and a removal turns out not to be final.
  await tx
    .update(pinballmapComments)
    .set({ entryMissingSince: null })
    .where(
      and(atLocation, present, isNotNull(pinballmapComments.entryMissingSince))
    );
  await tx
    .update(pinballmapComments)
    .set({ previousListingReason: null, previousListingAt: null })
    .where(
      and(
        atLocation,
        present,
        inArray(pinballmapComments.previousListingReason, [
          "removed",
          "replaced",
        ])
      )
    );

  // Missing: start the window at the first snapshot that saw it.
  await tx
    .update(pinballmapComments)
    .set({ entryMissingSince: observedAt })
    .where(
      and(atLocation, absent, isNull(pinballmapComments.entryMissingSince))
    );

  // Replaced by a new entry for the same title.
  await tx
    .update(pinballmapComments)
    .set({ previousListingReason: "replaced", previousListingAt: now })
    .where(
      and(
        atLocation,
        absent,
        unmarked,
        inArray(pinballmapComments.pinballmapMachineId, presentTitles)
      )
    );

  // Missing past the restoration window.
  await tx
    .update(pinballmapComments)
    .set({ previousListingReason: "removed", previousListingAt: now })
    .where(
      and(
        atLocation,
        absent,
        unmarked,
        lte(pinballmapComments.entryMissingSince, windowStart)
      )
    );
}

/**
 * Mark every comment imported from a location other than the one now tracked
 * as belonging to a previous listing, permanently (spec 10.9). Runs in the
 * transaction that commits a location change. Resuming the same location
 * marks nothing, since its comments share the new location id.
 */
export async function markCommentsFromOtherLocations(
  tx: DbTransaction,
  trackedLocationId: number,
  at: Date
): Promise<void> {
  await tx
    .update(pinballmapComments)
    .set({ previousListingReason: "location_changed", previousListingAt: at })
    .where(
      and(
        ne(pinballmapComments.locationId, trackedLocationId),
        or(
          isNull(pinballmapComments.previousListingReason),
          ne(pinballmapComments.previousListingReason, "location_changed")
        )
      )
    );
}
