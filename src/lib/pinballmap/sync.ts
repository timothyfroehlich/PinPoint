import "server-only";
import { eq, isNotNull } from "drizzle-orm";
import { db } from "~/server/db";
import { machines } from "~/server/db/schema";
import { getPinballMapState } from "./state";
import { derivePbmMachineStatus } from "./status";

/**
 * PinballMap sync orchestration (PP-o355.11).
 *
 * The foundation (PP-o355.16) owns the fetch-and-persist (`syncLocationSnapshot`
 * in `./state`). This module adds the reconcile pass that heals stored lmx-id
 * drift off the persisted snapshot, and re-exports the pure status-derivation
 * surface so the rest of the app has one import point for "PBM status" concerns.
 */

export {
  derivePbmMachineStatus,
  shouldBeListedOnPbm,
  type PbmMachineStatus,
} from "./status";

/** Outcome of a reconcile pass. */
export interface ReconcileResult {
  /** Machines whose stored `pinballmapLmxId` was healed to the snapshot's id. */
  healed: number;
  /**
   * Machines still in a desynced state a human must resolve (listed here but
   * absent on PBM, or on PBM but not listed here). Drift is auto-healed, so
   * healed machines are NOT counted here.
   */
  desynced: number;
}

/**
 * Reconcile our stored per-machine PBM state against the persisted location
 * snapshot (written by `syncLocationSnapshot`). Two effects:
 *
 *  - HEAL: for a linked+listed machine whose title is present on PBM but under a
 *    different lmx id than we stored (`lmx_drifted`), update `pinballmapLmxId`
 *    to the snapshot's current id. Safe and lossless — the title is the same,
 *    only PBM's row id moved (a delete+re-add). Downstream write paths
 *    (PP-o355.12) rely on the stored id being current.
 *  - COUNT: tally machines that are desynced for another reason (listed here but
 *    gone from PBM, or on PBM but not listed here) so the control room / status
 *    card can surface "N need attention". We deliberately do NOT auto-flip
 *    `pinballmapListed` — that stays a human decision (three-concept model).
 *
 * No PBM HTTP here (CORE-ARCH-011 / CORE-PBM-001): it reads the already-stored
 * snapshot and writes only heals, in one transaction. A `null` snapshot (never
 * synced) is a no-op.
 */
export async function reconcileAfterSync(): Promise<ReconcileResult> {
  const state = await getPinballMapState();
  const snapshot = state?.snapshotJson ?? null;
  if (!snapshot) return { healed: 0, desynced: 0 };

  const linked = await db
    .select({
      id: machines.id,
      pinballmapMachineId: machines.pinballmapMachineId,
      pinballmapListed: machines.pinballmapListed,
      pinballmapLmxId: machines.pinballmapLmxId,
    })
    .from(machines)
    .where(isNotNull(machines.pinballmapMachineId));

  const heals: { id: string; lmxId: number }[] = [];
  let desynced = 0;

  for (const m of linked) {
    const status = derivePbmMachineStatus({
      pinballmapMachineId: m.pinballmapMachineId,
      pinballmapListed: m.pinballmapListed,
      pinballmapLmxId: m.pinballmapLmxId,
      snapshot,
    });
    if (status.reason === "lmx_drifted" && status.lmxId !== null) {
      heals.push({ id: m.id, lmxId: status.lmxId });
    } else if (status.desynced) {
      desynced += 1;
    }
  }

  if (heals.length > 0) {
    await db.transaction(async (tx) => {
      for (const heal of heals) {
        await tx
          .update(machines)
          .set({ pinballmapLmxId: heal.lmxId })
          .where(eq(machines.id, heal.id));
      }
    });
  }

  return { healed: heals.length, desynced };
}
