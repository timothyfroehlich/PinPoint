import "server-only";
import { eq, isNotNull } from "drizzle-orm";
import type { MachinePresenceStatus } from "~/lib/machines/presence";
import {
  getPostgresErrorConstraint,
  isPgErrorCode,
} from "~/lib/db/postgres-errors";
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
   * Machines in a desynced state a human can actually resolve. Everything this
   * pass fixes itself is excluded (drift is healed, lineup presence is
   * auto-linked), and so is everything nobody can fix:
   *
   *  - a tie, which raises no alert by design (`./listing-holder` §7);
   *  - a same-title cabinet that is not the listing holder, which can never be
   *    listed while the holder is (see the counting loop).
   *
   * In practice what survives is "listed here but absent on PBM".
   */
  desynced: number;
}

/** A write the reconcile pass decided on, ready to apply. */
export interface AutoLinkWrite {
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
 * Apply one auto-link write in its OWN transaction, standing down when another
 * writer took the listing first. Returns whether the write landed.
 *
 * Auto-link is opportunistic bookkeeping, so a collision is never an error: a
 * violation of `machines_pinballmap_listed_unique` means some concurrent writer
 * already listed a cabinet of this title, which is the outcome we wanted.
 *
 * Matched by constraint NAME, not by a bare 23505. The transaction holds two
 * statements, and the second one — the timeline receipt — writes a table with
 * its own partial unique index (`idx_timeline_events_idempotency_key`). A bare
 * code check would reinterpret a violation there as "someone else took the
 * listing", returning `false` with nothing linked and nothing logged: a silent
 * failure the hourly pass would repeat forever. An unnamed 23505 rethrows for
 * the same reason — better a loud pass than a quiet lie.
 *
 * The per-write transaction is what makes standing down possible. A rolled-back
 * transaction cannot be continued, so batching every write into one would turn a
 * single collision into "lose the whole hour's links and heals, and 500 the
 * cron" (PP-o355.20 review).
 */
const LISTED_UNIQUE_CONSTRAINT = "machines_pinballmap_listed_unique";

export async function captureAutoLink(
  write: AutoLinkWrite,
  actorId?: string
): Promise<boolean> {
  try {
    await db.transaction(async (tx) => {
      await applyAutoLinkWrite(tx, write, actorId);
    });
    return true;
  } catch (error) {
    if (
      isPgErrorCode(error, "23505") &&
      getPostgresErrorConstraint(error) === LISTED_UNIQUE_CONSTRAINT
    ) {
      return false;
    }
    throw error;
  }
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
 * snapshot and writes only its own decisions. A `null` snapshot (never synced)
 * is a no-op. The writes carry no actor — this pass runs from the hourly cron,
 * so the receipt is a system event.
 *
 * Gated on `state.enabled` here rather than left to callers, because the two
 * callers disagree: the cron route gates, and "Sync now" deliberately does not
 * (a human refresh owns its own decision, PP-hbi0). That asymmetry was fine
 * while this pass only healed lmx ids. Now that it also LISTS, ungated it would
 * mean one technician clicking "Sync now" auto-lists the whole fleet while the
 * integration is switched off — the exact thing `resolveAutoLinkForMachine`
 * refuses. Fetching a snapshot while disabled is harmless; writing listing state
 * off it is not.
 */
export async function reconcileAfterSync(): Promise<ReconcileResult> {
  const state = await getPinballMapState();
  if (!state?.enabled) return { healed: 0, linked: 0, desynced: 0 };
  const snapshot = state.snapshotJson ?? null;
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

    // Who holds this title's single listing: the cabinet we are about to write,
    // or whoever already has the flag. `null` means nobody does.
    const holderId =
      outcome.kind === "write"
        ? outcome.machineId
        : (group.find((m) => m.pinballmapListed)?.id ?? null);

    for (const m of group) {
      const isHolder = m.id === holderId;
      // Resolved by this pass — counting it would report a state we just fixed.
      if (isHolder && outcome.kind === "write") continue;
      const status = derivePbmMachineStatus({ ...m, snapshot });
      if (!status.desynced) continue;
      // A same-title cabinet that is NOT the holder can never be listed: PBM
      // gives the title one lmx at our location and
      // `machines_pinballmap_listed_unique` enforces one lister. Its
      // "on PBM, not listed here" is therefore not a state any human can
      // resolve, and counting it would inflate "N need attention" by one per
      // duplicate cabinet, permanently — the same reason a tie is excluded.
      //
      // The test is UNRESOLVABLE, not "duplicate". A group with no holder at all
      // — every cabinet `pending_arrival`/`removed` while PBM still shows the
      // title — keeps counting, and should: a human can clear it by fixing an
      // availability or unlisting on PBM. Only "the index forbids it" earns the
      // exclusion.
      if (
        holderId !== null &&
        !isHolder &&
        status.reason === "on_pbm_not_listed_locally"
      ) {
        continue;
      }
      desynced += 1;
    }
  }

  // One transaction per write, not one for the batch: a collision stands down
  // alone instead of voiding every other title's link and heal (see
  // `captureAutoLink`).
  //
  // `desynced` is tallied above, from the DECISIONS, and deliberately not
  // adjusted for a write that then stood down. That is not a stale count: a
  // stand-down means a concurrent writer took the listing, which makes this
  // cabinet a non-holder — and a non-holder's desync is exactly what the loop
  // above excludes as unresolvable. The two rules agree.
  const applied: AutoLinkWrite[] = [];
  for (const write of writes) {
    if (await captureAutoLink(write)) applied.push(write);
  }

  return {
    healed: applied.filter((w) => w.action === "reconnected").length,
    linked: applied.filter((w) => w.action === "linked").length,
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
 *
 * Gated on `state.enabled`, unlike `reconcileAfterSync`. Both sync paths are
 * explicit PinballMap operations whose callers own that gate (the cron route
 * checks it; "Sync now" is a deliberate human act on the PBM admin surface). A
 * "Save details" is neither — while the integration is off, editing a machine's
 * name must not quietly flip listing state off a snapshot nobody is refreshing.
 */
export async function resolveAutoLinkForMachine(prospective: {
  machineId: string;
  pinballmapMachineId: number;
  presenceStatus: MachinePresenceStatus;
}): Promise<{ lmxId: number } | null> {
  const state = await getPinballMapState();
  if (!state?.enabled) return null;
  const snapshot = state.snapshotJson ?? null;
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
