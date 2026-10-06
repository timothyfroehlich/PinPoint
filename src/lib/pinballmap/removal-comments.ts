/**
 * The comment count a Pinball Map remove confirmation shows (spec 4.6) — the
 * domain half of `checkRemovalCommentsAction` in `m/pinballmap-actions.ts`.
 *
 * Page rendering stays on the stored snapshot; only the operator's deliberate
 * click on Remove may spend from the shared manual-refresh allowance (spec 3.4,
 * CORE-PBM-001), and only when the stored lineup is too old to trust.
 */
import "server-only";

import { type Result, ok, err } from "~/lib/result";
import type { PinballmapRuntimeState } from "~/lib/types";
import { findLmxForMachine } from "~/lib/pinballmap/resolve-lmx";
import {
  getPinballMapState,
  syncLocationSnapshot,
} from "~/lib/pinballmap/state";
import { reconcileAfterSync } from "~/lib/pinballmap/sync";

/** A stored lineup at most this old is trusted without a refresh (spec 4.6). */
const REMOVAL_COMMENTS_FRESH_MS = 5 * 60 * 1000;

export interface RemovalCommentCount {
  count: number;
  checkedAt: Date;
  freshness: "current" | "last_known";
  failure: "throttled" | "failed" | null;
}

export interface CountRemovalCommentsOutcome {
  result: Result<RemovalCommentCount, "NOT_FOUND" | "SERVER">;
  /**
   * A refresh was attempted. It changes the shared lineup, and even a failed
   * attempt can spend the header's allowance, so the caller revalidates the
   * `/m` layout to keep other machine pages and the header in step.
   */
  refreshAttempted: boolean;
}

/**
 * The stored count when the lineup is under 5 minutes old, otherwise a refresh
 * first, falling back to the last-known count and its age when the refresh
 * cannot run.
 */
export async function countRemovalComments(args: {
  state: PinballmapRuntimeState & { locationId: number };
  userId: string;
  entryId: number;
  /** The entry's title, to find it again if a refresh re-mints its id. */
  titleId: number | null;
}): Promise<CountRemovalCommentsOutcome> {
  const { state, userId, entryId, titleId } = args;
  const initialEntry = state.snapshotJson?.lmxes.find(
    (entry) => entry.id === entryId
  );
  const initialCheckedAt = state.lastSyncedAt;
  const now = Date.now();
  const isFresh =
    initialEntry !== undefined &&
    initialCheckedAt !== null &&
    now - initialCheckedAt.getTime() <= REMOVAL_COMMENTS_FRESH_MS;
  if (isFresh)
    return {
      result: ok({
        count: initialEntry.conditions.length,
        checkedAt: initialCheckedAt,
        freshness: "current",
        failure: null,
      }),
      refreshAttempted: false,
    };

  const refreshed = await syncLocationSnapshot({
    updatedBy: userId,
    trigger: "manual",
  });
  if (refreshed.ok) await reconcileAfterSync();
  const attempted = (
    result: CountRemovalCommentsOutcome["result"]
  ): CountRemovalCommentsOutcome => ({ result, refreshAttempted: true });

  // Another human or the hourly sync may have refreshed while our attempt was
  // busy or throttled. Prefer that new observation over a stale fallback.
  const latest = await getPinballMapState();
  if (latest?.locationId !== state.locationId)
    return attempted(
      err("SERVER", "The tracked location changed. Reload before removing.")
    );
  const latestEntry =
    latest.snapshotJson && titleId !== null
      ? findLmxForMachine(latest.snapshotJson, titleId)
      : undefined;
  if (
    latest.lastSyncedAt !== null &&
    latest.lastSyncedAt.getTime() > (initialCheckedAt?.getTime() ?? 0) &&
    now - latest.lastSyncedAt.getTime() <= REMOVAL_COMMENTS_FRESH_MS
  ) {
    if (!latestEntry)
      return attempted(
        err("NOT_FOUND", "This entry is no longer on the lineup.")
      );
    return attempted(
      ok({
        count: latestEntry.conditions.length,
        checkedAt: latest.lastSyncedAt,
        freshness: "current",
        failure: null,
      })
    );
  }
  if (refreshed.ok)
    return attempted(
      err("SERVER", "The refreshed lineup is unavailable. Try again.")
    );
  if (!initialEntry || !initialCheckedAt)
    return attempted(
      err("SERVER", "No last-known comment count is available.")
    );
  return attempted(
    ok({
      count: initialEntry.conditions.length,
      checkedAt: initialCheckedAt,
      freshness: "last_known",
      failure: refreshed.reason === "throttled" ? "throttled" : "failed",
    })
  );
}
