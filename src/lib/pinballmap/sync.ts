import "server-only";
import { clearResolvedAbandonments } from "./abandoned-listings";
import { getPinballMapState } from "./state";

/**
 * PinballMap post-sync reconciliation (PP-o355.11, PP-o355.21).
 *
 * The foundation (PP-o355.16) owns the fetch-and-persist (`syncLocationSnapshot`
 * in `./state`). What is left here is the one cleanup that a fresh lineup makes
 * possible and nothing else can do.
 *
 * **This pass used to link and heal, and no longer does either** (spec 5.1).
 * Listing intent is an operator decision, so nothing automatic may set it — the
 * auto-link that captured a lone eligible cabinet is deleted rather than
 * narrowed, because "PinPoint decided you wanted this on the lineup" is the
 * failure mode, not a bug in how it chose. The lmx heal went with the
 * per-machine `pinballmap_lmx_id` column: with the handle resolved by title from
 * the snapshot at every use, there is no stored copy left to drift.
 */

/** Outcome of a reconcile pass. */
export interface ReconcileResult {
  /**
   * Abandoned-listing records cleared because their entry is no longer on the
   * lineup — someone removed it by hand on pinballmap.com
   * (`./abandoned-listings`).
   */
  abandonmentsCleared: number;
}

/**
 * Drop abandoned-listing records whose entry has left the lineup.
 *
 * No PBM HTTP (CORE-ARCH-011 / CORE-PBM-001): it reads the already-stored
 * snapshot. A `null` snapshot (never synced) is a no-op, and so is an
 * unconfigured integration — a stale lineup must not be read as "the entry is gone".
 */
export async function reconcileAfterSync(): Promise<ReconcileResult> {
  const state = await getPinballMapState();
  if (state?.locationId === null || state?.locationId === undefined)
    return { abandonmentsCleared: 0 };
  const snapshot = state.snapshotJson ?? null;
  if (!snapshot) return { abandonmentsCleared: 0 };

  // Safe here because we only ever run on a freshly synced snapshot: both
  // callers return early unless the sync succeeded, and a failed sync leaves
  // `snapshotJson` untouched rather than emptying it.
  const abandonmentsCleared = await clearResolvedAbandonments(
    snapshot,
    state.locationId
  );
  return { abandonmentsCleared };
}
