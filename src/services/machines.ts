import { eq, and, type InferSelectModel } from "drizzle-orm";
import { db, type DbTransaction } from "~/server/db";
import {
  machines,
  machineWatchers,
  userProfiles,
  invitedUsers,
} from "~/server/db/schema";
import { type Result, ok, err } from "~/lib/result";
import { z } from "zod";
import {
  reportError,
  serverActionError,
} from "~/lib/observability/report-error";
import {
  emitMachineCreated,
  emitMachineUpdated,
  toMachineOwnerRef,
} from "~/lib/timeline/machine-lifecycle-helpers";
import {
  planNotification,
  getChannels,
  type DeliveryPlan,
} from "~/lib/notifications";
import { type MachinePresenceStatus } from "~/lib/machines/presence";
import { type ProseMirrorDoc } from "~/lib/tiptap/types";
import { recordAbandonedListing } from "~/lib/pinballmap/abandoned-listings";
import {
  resolvePbmLinkColumnsForUpdate,
  type AbandonedListing,
  type PbmLinkSelection,
  type StoredPbmLinkState,
} from "~/lib/pinballmap/link-columns";
import {
  captureAutoLink,
  resolveAutoLinkForMachine,
} from "~/lib/pinballmap/sync";

export type Machine = InferSelectModel<typeof machines>;

/**
 * Machine columns derived from a create/edit form's PinballMap link selection.
 * Callers resolve these (mutual-exclusion validation + catalog-derived metadata)
 * and pass the finished column set to {@link createMachine}; the service simply
 * spreads them into the insert. Defined here so both `m/actions.ts` and future
 * MCP tools share one shape (single source of truth).
 */
export interface MachinePbmColumns {
  pinballmapMachineId: number | null;
  pinballmapExcluded: boolean;
  pinballmapExcludedReason: string | null;
  pinballmapListed: boolean;
  // The PBM-side listing id. Two CHECK constraints tie it to the columns above
  // (`machines_pinballmap_lmx_requires_link` / `..._requires_listed`), so it has
  // to move as part of this set — leaving a stale lmx behind when a machine is
  // unlinked or unlisted makes the UPDATE throw.
  pinballmapLmxId: number | null;
  manufacturer: string | null;
  year: number | null;
  opdbId: string | null;
  ipdbId: number | null;
}

/**
 * Identifies a guest user to promote to `member` inside the same transaction
 * as a machine mutation. `type` selects the backing table (an active
 * `user_profiles` row vs a pending `invited_users` row). Callers gate this on
 * `admin.users.promote.guestToMember` before invoking the service.
 */
export interface PromoteGuest {
  userId: string;
  type: "active" | "invited";
}

const watchModeSchema = z.enum(["notify", "subscribe"]);

/**
 * Toggle watcher status for a user on a machine
 */
export async function toggleMachineWatcher({
  machineId,
  userId,
  watchMode = "notify",
}: {
  machineId: string;
  userId: string;
  watchMode?: "notify" | "subscribe";
}): Promise<Result<{ isWatching: boolean; watchMode: string }, "SERVER">> {
  try {
    // Check if already watching
    const existing = await db.query.machineWatchers.findFirst({
      where: and(
        eq(machineWatchers.machineId, machineId),
        eq(machineWatchers.userId, userId)
      ),
    });

    if (existing) {
      // Unwatch
      await db
        .delete(machineWatchers)
        .where(
          and(
            eq(machineWatchers.machineId, machineId),
            eq(machineWatchers.userId, userId)
          )
        );
      return ok({ isWatching: false, watchMode: existing.watchMode });
    } else {
      // Watch
      await db.insert(machineWatchers).values({
        machineId,
        userId,
        watchMode,
      });
      return ok({ isWatching: true, watchMode });
    }
  } catch (error) {
    return serverActionError(error, "SERVER", "Failed to toggle watch status", {
      action: "toggleMachineWatcher",
      machineId,
      userId,
    });
  }
}

/**
 * Update watch mode for a user on a machine
 */
export async function updateMachineWatchMode({
  machineId,
  userId,
  watchMode,
}: {
  machineId: string;
  userId: string;
  watchMode: "notify" | "subscribe";
}): Promise<Result<{ watchMode: string }, "SERVER" | "VALIDATION">> {
  const validation = watchModeSchema.safeParse(watchMode);
  if (!validation.success) {
    return err("VALIDATION", "Invalid watch mode");
  }

  try {
    const [updated] = await db
      .update(machineWatchers)
      .set({ watchMode })
      .where(
        and(
          eq(machineWatchers.machineId, machineId),
          eq(machineWatchers.userId, userId)
        )
      )
      .returning();

    if (!updated) {
      // If we try to update a non-existent watcher, should we create it or fail?
      // Logic implies "update mode", so failing if not watching makes sense,
      // but simplistic approach might just be treating it as a no-op/error.
      // Let's assume the UI only shows this when watching.
      return ok({ watchMode }); // Return verified mode even if no-op? Or error?
      // Better to imply success if state matches intent, or fail if context missing.
      // Let's stick to simple return for now, or check 'updated'.
      // If NOT updated, it means they weren't watching.
      // We could return err("NOT_FOUND") but "SERVER" is generically defined above.
      // Let's keep it simple for now matching strict return types.
    }

    return ok({ watchMode });
  } catch (error) {
    return serverActionError(error, "SERVER", "Failed to update watch mode", {
      action: "updateMachineWatchMode",
      machineId,
      userId,
      watchMode,
    });
  }
}

// --- Machine mutation services (createMachine / updateMachineOwner /
//     updateMachinePresence / updateMachineName) ------------------------------
//
// These mirror `~/services/issues.ts`: a typed params object (with an explicit
// `actorUserId`), the whole `db.transaction` — row writes, watcher
// reconciliation, timeline emits, and notification *planning* — inside the
// service, external channel config fetched before the transaction, and a
// `{ machine, deliveryPlan }` result. Authorization stays in the caller (server
// action or MCP tool): the caller authenticates, loads the machine for the
// permission decision, runs `checkPermission()`, resolves owner identities, then
// invokes the service and dispatches the returned plan post-commit via
// `after(() => dispatchNotification(deliveryPlan))` (CORE-ARCH-011: no external
// effects inside the transaction).

/**
 * Pre-loaded machine snapshot the owner/presence services need to compute
 * timeline deltas (and the presence no-op guard) without re-reading a row the
 * caller already fetched for its permission check.
 */
export interface MachineMutationSnapshot {
  name: string;
  ownerId: string | null;
  invitedOwnerId: string | null;
  presenceStatus: MachinePresenceStatus;
}

export interface CreateMachineParams {
  name: string;
  initials: string;
  /** The acting user, attributed on the lifecycle timeline events. */
  actorUserId: string;
  /** Active owner (`user_profiles`), or null/undefined for none. */
  ownerId?: string | null | undefined;
  /** Invited owner (`invited_users`), or null/undefined for none. */
  invitedOwnerId?: string | null | undefined;
  presenceStatus?: MachinePresenceStatus | undefined;
  description?: ProseMirrorDoc | null | undefined;
  /** Resolved PinballMap columns to apply, or null to leave them at defaults. */
  pbmColumns?: MachinePbmColumns | null | undefined;
  /**
   * When set, promote this guest to `member` inside the same transaction before
   * the insert. Callers gate this on `admin.users.promote.guestToMember`.
   */
  promoteGuest?: PromoteGuest | null | undefined;
}

/**
 * Create a machine, atomically: (optional) guest→member promotion, the machine
 * insert, the owner's `subscribe` watcher row, and the `machine_added` /
 * `owner_set` lifecycle events. When an active guest is promoted into ownership
 * the new owner is notified (`machine_ownership_changed` → "added"), matching
 * `createMachineAction`'s original post-commit dispatch; the plan is returned
 * for the caller to deliver via `after()`.
 */
export async function createMachine({
  name,
  initials,
  actorUserId,
  ownerId,
  invitedOwnerId,
  presenceStatus,
  description,
  pbmColumns,
  promoteGuest,
}: CreateMachineParams): Promise<{
  machine: Machine;
  deliveryPlan: DeliveryPlan;
}> {
  // `getChannels()` is a live Supabase Vault round-trip, so resolve it only when
  // a notification will actually be planned (active-guest promotion) — every
  // other create path discards it. Must happen before the transaction
  // (CORE-ARCH-011: no external effects inside the DB connection window).
  const channels = promoteGuest?.type === "active" ? await getChannels() : [];

  return db.transaction(async (tx) => {
    if (promoteGuest) {
      if (promoteGuest.type === "active") {
        await tx
          .update(userProfiles)
          .set({ role: "member" })
          .where(eq(userProfiles.id, promoteGuest.userId));
      } else {
        await tx
          .update(invitedUsers)
          .set({ role: "member" })
          .where(eq(invitedUsers.id, promoteGuest.userId));
      }
    }

    const [machine] = await tx
      .insert(machines)
      .values({
        name,
        initials,
        ownerId: ownerId ?? undefined,
        invitedOwnerId: invitedOwnerId ?? undefined,
        ...(presenceStatus !== undefined && { presenceStatus }),
        ...(description !== undefined &&
          description !== null && { description }),
        ...(pbmColumns ?? {}),
      })
      .returning();

    if (!machine) {
      throw new Error("Machine creation failed");
    }

    // Auto-subscribe an active owner to the machine (full subscribe mode).
    if (ownerId) {
      await tx
        .insert(machineWatchers)
        .values({
          machineId: machine.id,
          userId: ownerId,
          watchMode: "subscribe",
        })
        .onConflictDoUpdate({
          target: [machineWatchers.machineId, machineWatchers.userId],
          set: { watchMode: "subscribe" },
        });
    }

    // Lifecycle: `machine_added` (+ `owner_set` when owned). Atomic with the
    // insert — a failed emit rolls the machine back.
    await emitMachineCreated(
      tx,
      {
        id: machine.id,
        owner: toMachineOwnerRef(machine.ownerId, machine.invitedOwnerId),
      },
      actorUserId
    );

    // Notify a newly promoted active owner. Best-effort inside the tx (a
    // planning failure must not roll back the committed machine), mirroring the
    // issues service. Only the active-promotion path notified in the original.
    const deliveries: DeliveryPlan["deliveries"] = [];
    if (promoteGuest?.type === "active") {
      try {
        const plan = await planNotification(
          {
            type: "machine_ownership_changed",
            resourceId: machine.id,
            resourceType: "machine",
            actorId: actorUserId,
            includeActor: false,
            machineName: machine.name,
            newStatus: "added",
            additionalRecipientIds: [promoteGuest.userId],
          },
          tx,
          channels
        );
        deliveries.push(...plan.deliveries);
      } catch (error) {
        reportError(error, {
          action: "createMachineNotify",
          bestEffort: true,
          machineId: machine.id,
        });
      }
    }

    return { machine, deliveryPlan: { deliveries } };
  });
}

export interface UpdateMachineOwnerParams {
  machineId: string;
  actorUserId: string;
  /** Current machine state, pre-loaded by the caller for the permission check. */
  current: MachineMutationSnapshot;
  /**
   * The new owner. At most one id is set (active XOR invited); both null clears
   * ownership. The caller resolves the raw name/UUID to the right column.
   */
  newOwner: { ownerId: string | null; invitedOwnerId: string | null };
  /** Optional guest→member promotion for the incoming owner (see {@link PromoteGuest}). */
  promoteGuest?: PromoteGuest | null | undefined;
}

/**
 * Change (or clear) a machine's owner and nothing else — the focused slice of
 * `updateMachineAction`'s owner logic, for the MCP `set_machine_owner` tool.
 * Atomically: (optional) guest→member promotion, the owner-column update,
 * watcher reconciliation (drop the old owner, subscribe the new), and the
 * `owner_changed` lifecycle event. Name and presence are untouched. Removed and
 * added owners are notified (`machine_ownership_changed`); the plan is returned
 * for post-commit delivery.
 */
export async function updateMachineOwner({
  machineId,
  actorUserId,
  current,
  newOwner,
  promoteGuest,
}: UpdateMachineOwnerParams): Promise<{
  machine: Machine;
  deliveryPlan: DeliveryPlan;
}> {
  const oldOwnerId = current.ownerId;
  const { ownerId: newOwnerId, invitedOwnerId: newInvitedOwnerId } = newOwner;

  // A notification fires only when the active owner actually changes (old owner
  // removed and/or new owner added). `getChannels()` is a live Vault round-trip,
  // so resolve it only then, and before the transaction (CORE-ARCH-011).
  const willNotify =
    (oldOwnerId !== null && oldOwnerId !== newOwnerId) ||
    (newOwnerId !== null && newOwnerId !== oldOwnerId);
  const channels = willNotify ? await getChannels() : [];

  return db.transaction(async (tx) => {
    if (promoteGuest) {
      if (promoteGuest.type === "active") {
        await tx
          .update(userProfiles)
          .set({ role: "member" })
          .where(eq(userProfiles.id, promoteGuest.userId));
      } else {
        await tx
          .update(invitedUsers)
          .set({ role: "member" })
          .where(eq(invitedUsers.id, promoteGuest.userId));
      }
    }

    const [machine] = await tx
      .update(machines)
      .set({ ownerId: newOwnerId, invitedOwnerId: newInvitedOwnerId })
      .where(eq(machines.id, machineId))
      .returning();

    if (!machine) {
      throw new Error("Machine not found");
    }

    // Reconcile watcher rows (roll back with the owner change if anything below
    // throws). Old-owner removal + new-owner subscription mirror the action.
    if (oldOwnerId && oldOwnerId !== newOwnerId) {
      await tx
        .delete(machineWatchers)
        .where(
          and(
            eq(machineWatchers.machineId, machineId),
            eq(machineWatchers.userId, oldOwnerId)
          )
        );
    }
    if (newOwnerId && newOwnerId !== oldOwnerId) {
      await tx
        .insert(machineWatchers)
        .values({ machineId, userId: newOwnerId, watchMode: "subscribe" })
        .onConflictDoUpdate({
          target: [machineWatchers.machineId, machineWatchers.userId],
          set: { watchMode: "subscribe" },
        });
    }

    // Lifecycle: emit only `owner_changed`. Name is passed unchanged and
    // presence is left `undefined` so no spurious name/presence events fire.
    await emitMachineUpdated(
      tx,
      {
        id: machineId,
        name: current.name,
        owner: toMachineOwnerRef(current.ownerId, current.invitedOwnerId),
        presenceStatus: current.presenceStatus,
      },
      {
        name: current.name,
        ownerChanged: true,
        owner: toMachineOwnerRef(newOwnerId, newInvitedOwnerId),
        presenceStatus: undefined,
      },
      actorUserId
    );

    // Notifications planned in-tx (transactional in-app rows), delivered by the
    // caller post-commit. Best-effort: a planning failure never rolls back the
    // committed owner change.
    const deliveries: DeliveryPlan["deliveries"] = [];
    try {
      if (oldOwnerId && oldOwnerId !== newOwnerId) {
        const removed = await planNotification(
          {
            type: "machine_ownership_changed",
            resourceId: machine.id,
            resourceType: "machine",
            actorId: actorUserId,
            includeActor: false,
            machineName: machine.name,
            newStatus: "removed",
            additionalRecipientIds: [oldOwnerId],
          },
          tx,
          channels
        );
        deliveries.push(...removed.deliveries);
      }
      if (newOwnerId && newOwnerId !== oldOwnerId) {
        const added = await planNotification(
          {
            type: "machine_ownership_changed",
            resourceId: machine.id,
            resourceType: "machine",
            actorId: actorUserId,
            includeActor: false,
            machineName: machine.name,
            newStatus: "added",
            additionalRecipientIds: [newOwnerId],
          },
          tx,
          channels
        );
        deliveries.push(...added.deliveries);
      }
    } catch (error) {
      reportError(error, {
        action: "updateMachineOwnerNotify",
        bestEffort: true,
        machineId: machine.id,
      });
    }

    return { machine, deliveryPlan: { deliveries } };
  });
}

export interface UpdateMachinePresenceParams {
  machineId: string;
  presenceStatus: MachinePresenceStatus;
  actorUserId: string;
  /** Current machine state, pre-loaded by the caller for the permission check. */
  current: MachineMutationSnapshot;
}

/**
 * Change a machine's presence (availability) and emit a `presence_changed`
 * lifecycle event, atomically. Returns `{ changed: false }` without writing when
 * the value is unchanged (no bumped `updatedAt`, no timeline row) — the caller
 * skips revalidation in that case. No notifications.
 */
export async function updateMachinePresence({
  machineId,
  presenceStatus,
  actorUserId,
  current,
}: UpdateMachinePresenceParams): Promise<{ changed: boolean }> {
  if (current.presenceStatus === presenceStatus) {
    return { changed: false };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(machines)
      .set({ presenceStatus })
      .where(eq(machines.id, machineId));

    await emitMachineUpdated(
      tx,
      {
        id: machineId,
        name: current.name,
        owner: toMachineOwnerRef(current.ownerId, current.invitedOwnerId),
        presenceStatus: current.presenceStatus,
      },
      {
        name: current.name,
        ownerChanged: false,
        owner: toMachineOwnerRef(current.ownerId, current.invitedOwnerId),
        presenceStatus,
      },
      actorUserId
    );
  });

  return { changed: true };
}

// --- PinballMap link seam (PP-u4ab.12) --------------------------------------
//
// One seam, three steps, shared by `updateMachineAction` (the machine edit
// page) and the MCP `set_machine_pinballmap` tool:
//
//   1. {@link planMachinePbmLink}  — decide, before any transaction opens.
//   2. {@link applyMachinePbmLink} — write, inside the caller's transaction.
//   3. {@link captureMachineAutoLink} — best-effort listing capture, after it
//      commits.
//
// Split into three rather than one function because the two callers have
// genuinely different transaction shapes: the edit form saves the link
// alongside name/owner/presence/description and must keep all of that atomic,
// while the MCP tool changes the link and nothing else. Collapsing them into
// one `db.transaction` would either fork the seam or make a machine save
// two transactions — and a half-saved edit is the regression this bead was
// warned about. What is NOT split is every decision that carries a rule: the
// carry-over, the abandonment record, and the auto-link choice each exist once.

/** Everything a PBM link change decided, before anything is written. */
export interface MachinePbmLinkPlan {
  /** The full column set to write — catalog-derived, never caller-supplied. */
  columns: MachinePbmColumns;
  /** A live PBM entry this change walks away from (PP-l81u), or null. */
  abandoned: AbandonedListing | null;
  /**
   * The listing this change decided to capture (PP-o355.20), or null.
   *
   * Decided here and applied AFTER the caller's transaction commits — the
   * one-lister index makes the listing write the only statement that can
   * collide, and derived bookkeeping must never discard the edit a human (or an
   * MCP caller) actually asked for.
   */
  autoLink: { lmxId: number } | null;
}

export type PlanMachinePbmLinkResult =
  { ok: true; plan: MachinePbmLinkPlan } | { ok: false; message: string };

export interface PlanMachinePbmLinkParams {
  machineId: string;
  /** The requested link selection. Listing state is never part of it. */
  selection: PbmLinkSelection;
  /** The machine's STORED PBM state, read from the row — never from a request. */
  stored: StoredPbmLinkState;
  /**
   * The machine's presence as it will be AFTER this change — the tie guard
   * ranks on it, and an edit form can change availability in the same submit.
   */
  presenceStatus: MachinePresenceStatus;
}

/**
 * Decide a machine's new PinballMap columns, plus the two follow-ups that ride
 * with them. Pure decision-making: reads the catalog mirror and the stored PBM
 * snapshot, writes nothing, and opens no transaction (so it is also the right
 * side of CORE-ARCH-011 for the auto-link lookup).
 *
 * `pinballmapListed` is never an input. `resolvePbmLinkColumnsForUpdate` takes
 * the STORED row and owns the carry-over decision, so no caller can unlist a
 * machine by leaving an argument out (PP-l81u), and no caller can list one by
 * putting it in a request body (PP-o355.29).
 */
export async function planMachinePbmLink({
  machineId,
  selection,
  stored,
  presenceStatus,
}: PlanMachinePbmLinkParams): Promise<PlanMachinePbmLinkResult> {
  const resolved = await resolvePbmLinkColumnsForUpdate(selection, stored);
  if (!resolved.ok) {
    return { ok: false, message: resolved.message };
  }

  // Only from unlinked/re-targeted → not-yet-listed. A row the carry-over kept
  // listed is skipped entirely, which is also why this can never produce a heal:
  // lmx drift belongs to the hourly reconcile pass, not to whoever hit Save.
  const autoLink =
    resolved.columns.pinballmapMachineId !== null &&
    !resolved.columns.pinballmapListed
      ? await resolveAutoLinkForMachine({
          machineId,
          pinballmapMachineId: resolved.columns.pinballmapMachineId,
          presenceStatus,
        })
      : null;

  return {
    ok: true,
    plan: {
      columns: resolved.columns,
      abandoned: resolved.abandoned,
      autoLink,
    },
  };
}

/**
 * Write a planned link change in the CALLER's transaction: the columns, and the
 * record of any listing the change walks away from.
 *
 * Both must commit together — a retitle that lands without its abandonment
 * record leaves a public PinballMap entry nobody can find (PP-l81u), which is
 * exactly the defect this pairing closes. Both writes are local, so nothing here
 * violates CORE-ARCH-011.
 *
 * The columns go out as their own UPDATE rather than being spread into a
 * caller's statement, so the pairing cannot be half-adopted by a new caller.
 * `machines_owner_not_guest` is the only trigger on this table and it fires only
 * `OF owner_id, invited_owner_id`, so a second UPDATE in the same transaction
 * costs a round trip and nothing else.
 */
export async function applyMachinePbmLink(
  tx: DbTransaction,
  machineId: string,
  plan: MachinePbmLinkPlan,
  actorUserId: string
): Promise<void> {
  await tx.update(machines).set(plan.columns).where(eq(machines.id, machineId));

  if (plan.abandoned) {
    await recordAbandonedListing(tx, machineId, plan.abandoned, actorUserId);
  }
}

/**
 * Apply a plan's auto-link, best-effort, AFTER the caller's transaction has
 * committed. Swallows everything.
 *
 * `captureAutoLink` already stands down on the one collision that is expected
 * (another cabinet of this title took the listing first), but a deadlock, a
 * dropped connection, or a failure writing the receipt would otherwise surface
 * as "failed to save" for a change that is already saved — sending the caller to
 * redo work that landed. Auto-link is derived bookkeeping: it is allowed to not
 * happen, and the hourly reconcile pass picks it up next time round.
 */
export async function captureMachineAutoLink(
  machineId: string,
  lmxId: number,
  actorUserId: string
): Promise<void> {
  try {
    await captureAutoLink({ machineId, lmxId, action: "linked" }, actorUserId);
  } catch (error) {
    reportError(error, {
      action: "captureMachineAutoLink",
      bestEffort: true,
      machineId,
    });
  }
}

export interface UpdateMachinePbmLinkParams {
  machineId: string;
  actorUserId: string;
  /** The requested link selection. Listing state is never part of it. */
  selection: PbmLinkSelection;
}

export type UpdateMachinePbmLinkResult =
  | { ok: true; columns: MachinePbmColumns; previous: MachinePbmColumns }
  | {
      ok: false;
      reason: "invalid" | "not_found" | "conflict";
      message: string;
    };

/** The PBM + presence state a plan was decided against, for the CAS check. */
type PbmLinkBasis = StoredPbmLinkState & {
  presenceStatus: MachinePresenceStatus;
};

const PBM_LINK_COLUMNS = {
  pinballmapMachineId: true,
  pinballmapExcluded: true,
  pinballmapExcludedReason: true,
  pinballmapListed: true,
  pinballmapLmxId: true,
  manufacturer: true,
  year: true,
  opdbId: true,
  ipdbId: true,
} as const;

/** How many times a losing CAS attempt re-plans before giving up. */
const PBM_LINK_MAX_ATTEMPTS = 3;

function pbmLinkBasisUnchanged(a: PbmLinkBasis, b: PbmLinkBasis): boolean {
  return (
    a.pinballmapMachineId === b.pinballmapMachineId &&
    a.pinballmapListed === b.pinballmapListed &&
    a.pinballmapLmxId === b.pinballmapLmxId &&
    a.presenceStatus === b.presenceStatus
  );
}

/**
 * Change a machine's PinballMap link and nothing else — the focused slice of
 * `updateMachineAction`'s PBM logic, for the MCP `set_machine_pinballmap` tool.
 *
 * Runs the same three steps the edit page runs, in the same order, over the same
 * seam: plan, apply in a transaction, then capture any auto-link post-commit.
 * Authorization stays in the caller (`machines.pinballmap.link`).
 *
 * **Reads its own basis, and writes it back under compare-and-set.** The plan
 * has to be decided before the transaction opens — it reads the catalog mirror
 * and ranks auto-link candidates, and neither belongs inside a held row lock —
 * so the snapshot it planned against can go stale in between. The hourly
 * reconcile pass is the writer that does it: it sets `pinballmapListed` true and
 * captures an lmx, and because {@link applyMachinePbmLink} writes the whole
 * column set, a plan made from the pre-reconcile snapshot would put `listed:
 * false, lmxId: null` back and — having seen no listing — record no abandonment,
 * leaving a live pinballmap.com entry nobody tracks. That is the PP-l81u defect
 * exactly. The fleet linking pass (PP-h059) drives this tool across ~100
 * machines in one session, so the window is wide open in practice, not
 * theoretically.
 *
 * The `FOR UPDATE` re-read inside the transaction closes it: whoever holds the
 * lock sees the other writer's committed state, and a basis that moved means the
 * plan is void, so it is thrown away and re-planned rather than written. Same
 * read-modify-write serialization `editStoredSnapshot` uses in
 * `m/pinballmap-actions.ts`, for the same reason.
 *
 * A missing row is reported as `not_found` rather than a success payload
 * describing a link that was never stored (CORE-ARCH-012).
 *
 * Returns the machine's PBM columns AS STORED after everything settled, not as
 * planned: an auto-link that lands sets `pinballmapListed`/`pinballmapLmxId`
 * outside the plan, and reporting the planned values would tell the caller the
 * machine is unlisted while the row says otherwise (CORE-ARCH-012). `previous`
 * comes from the locked read, so it describes the state this change actually
 * replaced — not whatever the caller happened to read earlier.
 */
export async function updateMachinePbmLink({
  machineId,
  actorUserId,
  selection,
}: UpdateMachinePbmLinkParams): Promise<UpdateMachinePbmLinkResult> {
  for (let attempt = 1; ; attempt++) {
    const basisRow = await db.query.machines.findFirst({
      where: eq(machines.id, machineId),
      columns: { ...PBM_LINK_COLUMNS, presenceStatus: true },
    });
    if (!basisRow) {
      return { ok: false, reason: "not_found", message: MACHINE_GONE_MESSAGE };
    }

    const planned = await planMachinePbmLink({
      machineId,
      selection,
      stored: {
        pinballmapMachineId: basisRow.pinballmapMachineId,
        pinballmapListed: basisRow.pinballmapListed,
        pinballmapLmxId: basisRow.pinballmapLmxId,
      },
      presenceStatus: basisRow.presenceStatus,
    });
    if (!planned.ok) {
      return { ok: false, reason: "invalid", message: planned.message };
    }

    const outcome = await db.transaction(async (tx) => {
      const [locked] = await tx
        .select({
          pinballmapMachineId: machines.pinballmapMachineId,
          pinballmapExcluded: machines.pinballmapExcluded,
          pinballmapExcludedReason: machines.pinballmapExcludedReason,
          pinballmapListed: machines.pinballmapListed,
          pinballmapLmxId: machines.pinballmapLmxId,
          manufacturer: machines.manufacturer,
          year: machines.year,
          opdbId: machines.opdbId,
          ipdbId: machines.ipdbId,
          presenceStatus: machines.presenceStatus,
        })
        .from(machines)
        .where(eq(machines.id, machineId))
        .for("update");
      if (!locked) return { state: "gone" } as const;
      if (!pbmLinkBasisUnchanged(locked, basisRow)) {
        return { state: "stale" } as const;
      }

      await applyMachinePbmLink(tx, machineId, planned.plan, actorUserId);
      const { presenceStatus: _presence, ...previous } = locked;
      return { state: "applied", previous } as const;
    });

    if (outcome.state === "gone") {
      return { ok: false, reason: "not_found", message: MACHINE_GONE_MESSAGE };
    }
    if (outcome.state === "stale") {
      if (attempt >= PBM_LINK_MAX_ATTEMPTS) {
        return {
          ok: false,
          reason: "conflict",
          message:
            "This machine's Pinball Map state kept changing while the update was being applied. Nothing was written — read it back and try again.",
        };
      }
      continue;
    }

    return finishMachinePbmLink(
      machineId,
      actorUserId,
      planned.plan,
      outcome.previous
    );
  }
}

const MACHINE_GONE_MESSAGE =
  "That machine no longer exists — it was deleted while the update was being applied. Nothing was written.";

/**
 * The post-commit half: capture any auto-link, then report the columns AS
 * STORED. Split out only so {@link updateMachinePbmLink}'s retry loop has a
 * single exit.
 */
async function finishMachinePbmLink(
  machineId: string,
  actorUserId: string,
  plan: MachinePbmLinkPlan,
  previous: MachinePbmColumns
): Promise<UpdateMachinePbmLinkResult> {
  if (plan.autoLink === null) {
    return { ok: true, columns: plan.columns, previous };
  }

  await captureMachineAutoLink(machineId, plan.autoLink.lmxId, actorUserId);

  const row = await db.query.machines.findFirst({
    where: eq(machines.id, machineId),
    columns: PBM_LINK_COLUMNS,
  });
  // The row was updated moments ago in a committed transaction, so a miss means
  // it was deleted concurrently. Fall back to the planned columns rather than
  // throwing away a change that did commit.
  return { ok: true, columns: row ?? plan.columns, previous };
}

export interface UpdateMachineNameParams {
  machineId: string;
  /** The new display name. Callers validate length/trim before calling. */
  name: string;
  actorUserId: string;
  /** Current machine state, pre-loaded by the caller for the permission check. */
  current: MachineMutationSnapshot;
}

/**
 * Rename a machine and emit a `name_changed` lifecycle event, atomically.
 * Returns `{ changed: false }` without writing when the name is unchanged (no
 * bumped `updatedAt`, no timeline row). No notifications.
 *
 * Only the `name` column moves. `initials` is the FK target for
 * `issues.machineInitials` and the `/m/<initials>` URL segment, so it is
 * deliberately not touched here (PP-u4ab.10).
 */
export async function updateMachineName({
  machineId,
  name,
  actorUserId,
  current,
}: UpdateMachineNameParams): Promise<{ changed: boolean }> {
  if (current.name === name) {
    return { changed: false };
  }

  await db.transaction(async (tx) => {
    await tx.update(machines).set({ name }).where(eq(machines.id, machineId));

    await emitMachineUpdated(
      tx,
      {
        id: machineId,
        name: current.name,
        owner: toMachineOwnerRef(current.ownerId, current.invitedOwnerId),
        presenceStatus: current.presenceStatus,
      },
      {
        name,
        ownerChanged: false,
        owner: toMachineOwnerRef(current.ownerId, current.invitedOwnerId),
        presenceStatus: undefined,
      },
      actorUserId
    );
  });

  return { changed: true };
}
