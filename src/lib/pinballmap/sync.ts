import "server-only";
import { eq, isNotNull } from "drizzle-orm";
import type { MachinePresenceStatus } from "~/lib/machines/presence";
import { createMachineTimelineEvent } from "~/lib/timeline/machine-events";
import { db, type DbTransaction } from "~/server/db";
import { machines } from "~/server/db/schema";
import { resolveAutoLink, type AutoLinkCandidate } from "./auto-link";
import { getPinballMapState } from "./state";
import { derivePbmMachineStatus } from "./status";

/**
 * PinballMap sync orchestration (PP-o355.11, PP-o355.20).
 *
 * The foundation (PP-o355.16) owns the fetch-and-persist (`syncLocationSnapshot`
 * in `./state`). This module adds the reconcile pass that runs off the persisted
 * snapshot — auto-linking matched cabinets and healing stored lmx drift — and
 * re-exports the pure status-derivation surface so the rest of the app has one
 * import point for "PBM status" concerns.
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
  /** Machines auto-linked: matched, unlisted, and present on the lineup. */
  linked: number;
  /**
   * Machines still in a desynced state a human must resolve (listed here but
   * absent on PBM). Drift is auto-healed and lineup presence is auto-linked, so
   * neither is counted here — and neither is a tie, which raises no alert by
   * design (`./listing-holder` §7).
   */
  desynced: number;
}

/** A write the reconcile pass decided on, ready to apply. */
interface AutoLinkWrite {
  machineId: string;
  lmxId: number;
  action: "linked" | "reconnected";
}

/** The machine columns both the tie guard and the status derivation need. */
const RECONCILE_COLUMNS = {
  id: machines.id,
  pinballmapMachineId: machines.pinballmapMachineId,
  pinballmapListed: machines.pinballmapListed,
  pinballmapLmxId: machines.pinballmapLmxId,
  presenceStatus: machines.presenceStatus,
} as const;

/**
 * Apply one auto-link write and mirror its timeline receipt, in the caller's
 * transaction. `pinballmapListed: true` is written on both actions: it is the
 * point of a `linked`, and a no-op for a `reconnected` (the incumbent already
 * holds the listing), which keeps the two branches one statement.
 */
async function applyAutoLinkWrite(
  tx: DbTransaction,
  write: AutoLinkWrite,
  actorId?: string
): Promise<void> {
  await tx
    .update(machines)
    .set({ pinballmapLmxId: write.lmxId, pinballmapListed: true })
    .where(eq(machines.id, write.machineId));
  await createMachineTimelineEvent(
    write.machineId,
    {
      sourceType: "lifecycle",
      tag: "lifecycle",
      eventData: {
        kind: "pinballmap_listing",
        action: write.action,
        lmxId: write.lmxId,
      },
      ...(actorId === undefined ? {} : { actorId }),
    },
    tx
  );
}

/**
 * Reconcile our stored per-machine PBM state against the persisted location
 * snapshot (written by `syncLocationSnapshot`). Three effects:
 *
 *  - LINK: a matched, unlisted cabinet whose title is on the lineup captures
 *    that lmx and is marked listed (PP-o355.20). One direction only — nothing
 *    here ever unlists.
 *  - HEAL: a listed cabinet whose title is present under a *different* lmx id
 *    has `pinballmapLmxId` updated to the snapshot's current id. Safe and
 *    lossless — same title, PBM's row id just moved (a delete + re-add).
 *  - COUNT: tally machines desynced for a reason we will not resolve (listed
 *    here but gone from PBM) so the control room / status card can surface
 *    "N need attention".
 *
 * Both writes are decided by `resolveAutoLink`, so both are gated by the tie
 * guard: where cabinets tie at the top presence rank we choose nothing and
 * count nothing.
 *
 * No PBM HTTP here (CORE-ARCH-011 / CORE-PBM-001): it reads the already-stored
 * snapshot and writes only its own decisions, in one transaction. A `null`
 * snapshot (never synced) is a no-op. The writes carry no actor — this pass runs
 * from the hourly cron, so the receipt is a system event.
 */
export async function reconcileAfterSync(): Promise<ReconcileResult> {
  const state = await getPinballMapState();
  const snapshot = state?.snapshotJson ?? null;
  if (!snapshot) return { healed: 0, linked: 0, desynced: 0 };

  const matched = await db
    .select(RECONCILE_COLUMNS)
    .from(machines)
    .where(isNotNull(machines.pinballmapMachineId));

  // Group by catalog title: the tie guard's unit of decision is every cabinet
  // sharing one title, because PBM gives that title a single lmx at our location.
  const byTitle = new Map<number, AutoLinkCandidate[]>();
  for (const m of matched) {
    if (m.pinballmapMachineId === null) continue;
    const group = byTitle.get(m.pinballmapMachineId);
    if (group) group.push(m);
    else byTitle.set(m.pinballmapMachineId, [m]);
  }

  const writes: AutoLinkWrite[] = [];
  let desynced = 0;

  for (const [pinballmapMachineId, group] of byTitle) {
    const outcome = resolveAutoLink(pinballmapMachineId, group, snapshot);
    // A tie is invisible on purpose (`./listing-holder` §7) — it must not show
    // up as "needs attention" either, or the guard would raise the alert it
    // exists to avoid. Skip the whole group's counting, not just one machine.
    if (outcome.kind === "tie") continue;
    if (outcome.kind === "write") writes.push(outcome);

    for (const m of group) {
      // Resolved by this pass — counting it would report a state we just fixed.
      if (outcome.kind === "write" && m.id === outcome.machineId) continue;
      const status = derivePbmMachineStatus({ ...m, snapshot });
      if (status.desynced) desynced += 1;
    }
  }

  if (writes.length > 0) {
    await db.transaction(async (tx) => {
      for (const write of writes) {
        await applyAutoLinkWrite(tx, write);
      }
    });
  }

  return {
    healed: writes.filter((w) => w.action === "reconnected").length,
    linked: writes.filter((w) => w.action === "linked").length,
    desynced,
  };
}

/**
 * Auto-link for ONE machine at title-save time (PP-o355.20) — the same decision
 * as the sync pass, against the cabinet's *prospective* state rather than its
 * stored row, so linking a machine and capturing its listing happen in one save.
 *
 * `prospective` describes the row as it will be AFTER the edit commits. Callers
 * must only reach here when that row is matched and NOT listed, which is what
 * makes the answer either "capture this lmx" or "do nothing":
 *
 *  - The stored row for `machineId` is replaced by `prospective` in the group,
 *    so a title change contends under its NEW title, not its old one.
 *  - A write naming a DIFFERENT machine is discarded. That is the incumbent-heal
 *    case, and an edit to one cabinet must not silently rewrite another; the
 *    hourly pass heals it.
 *
 * Returns the lmx to capture, or `null` for absent / tie / someone else holds it.
 * Reads the stored snapshot only — no PBM call (CORE-PBM-001).
 */
export async function resolveAutoLinkForMachine(prospective: {
  machineId: string;
  pinballmapMachineId: number;
  presenceStatus: MachinePresenceStatus;
}): Promise<{ lmxId: number } | null> {
  const snapshot = (await getPinballMapState())?.snapshotJson ?? null;
  if (!snapshot) return null;

  const stored = await db
    .select(RECONCILE_COLUMNS)
    .from(machines)
    .where(eq(machines.pinballmapMachineId, prospective.pinballmapMachineId));

  const group: AutoLinkCandidate[] = [
    ...stored.filter((m) => m.id !== prospective.machineId),
    {
      id: prospective.machineId,
      pinballmapMachineId: prospective.pinballmapMachineId,
      presenceStatus: prospective.presenceStatus,
      pinballmapListed: false,
      pinballmapLmxId: null,
    },
  ];

  const outcome = resolveAutoLink(
    prospective.pinballmapMachineId,
    group,
    snapshot
  );
  if (outcome.kind !== "write") return null;
  if (outcome.machineId !== prospective.machineId) return null;
  return { lmxId: outcome.lmxId };
}
