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
import type { PbmListingIntent } from "~/lib/pinballmap/listing-state";

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
  // The operator's lineup decision (spec §1). It moves with this set because a
  // CHECK ties it to the link — `machines_pinballmap_intent_requires_link`
  // forbids intent On without a title — so a plan that unlinked a cabinet
  // without clearing intent would write a row the constraint rejects.
  pinballmapIntent: PbmListingIntent;
  // Hand-entered model identity, and only ever alongside `pinballmapExcluded`
  // (PP-3bbr). A linked machine's model comes from the catalog mirror, so this
  // moves with the set for the same reason intent does: a CHECK ties it to a
  // sibling column, and leaving it behind makes the UPDATE throw.
  modelName: string | null;
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
// One seam, two steps, shared by `updateMachineAction` (the machine edit page)
// and the MCP `set_machine_pinballmap` tool:
//
//   1. {@link planMachinePbmLink}  — decide, before any transaction opens.
//   2. {@link applyMachinePbmLink} — write, inside the caller's transaction.
//
// Split rather than fused because the two callers have genuinely different
// transaction shapes: the edit form saves the link alongside
// name/owner/presence/description and must keep all of that atomic, while the
// MCP tool changes the link and nothing else. Collapsing them into one
// `db.transaction` would either fork the seam or make a machine save two
// transactions — and a half-saved edit is the regression this bead was warned
// about. What is NOT split is every decision that carries a rule: the intent
// carry-over and the abandonment record each exist once.
//
// There used to be a third step — a best-effort auto-link capture after the
// commit. It is gone with the rest of the automatic layer (spec 5.1): nothing
// may set listing intent except a person.

/** Everything a PBM link change decided, before anything is written. */
export interface MachinePbmLinkPlan {
  /** The full column set to write — catalog-derived, never caller-supplied. */
  columns: MachinePbmColumns;
  /** A live PBM entry this change walks away from (PP-l81u), or null. */
  abandoned: AbandonedListing | null;
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
 * Decide a machine's new PinballMap columns, plus the abandonment that rides
 * with them. Pure decision-making: reads the catalog mirror and the stored
 * lineup, writes nothing, and opens no transaction (so it is also the right
 * side of CORE-ARCH-011 for that lineup read).
 *
 * Listing intent is never an input. `resolvePbmLinkColumnsForUpdate` takes the
 * STORED row and owns the carry-over decision, so no caller can take a machine
 * off the lineup by leaving an argument out (PP-l81u), and no caller can put one
 * on it by putting intent in a request body (PP-o355.29).
 */
export async function planMachinePbmLink({
  selection,
  stored,
}: PlanMachinePbmLinkParams): Promise<PlanMachinePbmLinkResult> {
  const resolved = await resolvePbmLinkColumnsForUpdate(selection, stored);
  if (!resolved.ok) {
    return { ok: false, message: resolved.message };
  }

  return {
    ok: true,
    plan: { columns: resolved.columns, abandoned: resolved.abandoned },
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
  pinballmapExcluded: boolean;
  pinballmapExcludedReason: string | null;
};

const PBM_LINK_COLUMNS = {
  pinballmapMachineId: true,
  pinballmapExcluded: true,
  pinballmapExcludedReason: true,
  pinballmapIntent: true,
  // Hand-entered identity for a cabinet with no catalog title (PP-3bbr). It
  // belongs in this set for the same reason manufacturer/year do: linking to a
  // title CLEARS it — the `machines_model_name_requires_excluded` CHECK makes
  // "linked and hand-entered" unrepresentable — so a plan that did not carry it
  // would write a row the constraint rejects.
  modelName: true,
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
    a.pinballmapIntent === b.pinballmapIntent &&
    a.presenceStatus === b.presenceStatus &&
    // The exclusion pair is in the basis because {@link carryExcludedReason}
    // reads it. Anything the plan is derived from has to be compared, or the
    // CAS would wave through a write built on a value that has since moved.
    a.pinballmapExcluded === b.pinballmapExcluded &&
    a.pinballmapExcludedReason === b.pinballmapExcludedReason
  );
}

/**
 * Keep a stored exclusion reason when the caller re-states the exclusion without
 * one.
 *
 * `resolvePbmLinkColumnsForUpdate` writes `reason ?? null`, which is right for
 * the edit form — that form always posts the field, so an absent one means a
 * human emptied the box. An MCP caller re-confirming an exclusion it did not
 * author has no such intent, and the fleet pass (PP-h059) does exactly that
 * across the whole floor: `{ machine: "UM", pinballmapExcluded: true }` would
 * have nulled "homebrew — one-off cabinet" on every machine it touched. Same
 * shape as the listing carry-over, and the same rule behind it — a forgotten
 * argument must not destroy stored state (CORE-ARCH-012).
 *
 * An explicit empty string is still a clear: it is a value the caller sent.
 */
function carryExcludedReason(
  selection: PbmLinkSelection,
  stored: Pick<PbmLinkBasis, "pinballmapExcluded" | "pinballmapExcludedReason">
): PbmLinkSelection {
  if (
    selection.pinballmapExcluded !== true ||
    selection.pinballmapExcludedReason !== undefined ||
    !stored.pinballmapExcluded ||
    stored.pinballmapExcludedReason === null
  ) {
    return selection;
  }
  return {
    ...selection,
    pinballmapExcludedReason: stored.pinballmapExcludedReason,
  };
}

/**
 * Change a machine's PinballMap link and nothing else — the focused slice of
 * `updateMachineAction`'s PBM logic, for the MCP `set_machine_pinballmap` tool.
 *
 * Runs the same steps the edit page runs, in the same order, over the same seam:
 * plan, then apply in a transaction. Authorization stays in the caller
 * (`machines.pinballmap.link`).
 *
 * **Reads its own basis, and writes it back under compare-and-set.** The plan
 * has to be decided before the transaction opens — it reads the catalog mirror
 * and the stored lineup, and neither belongs inside a held row lock — so the
 * state it planned against can move in between. Any concurrent writer of
 * `pinballmap_intent` does it: the control's toggle, or another MCP call. Since
 * {@link applyMachinePbmLink} writes the whole column set, a plan made from the
 * older read would put the previous intent back and — having seen the wrong
 * one — could record no abandonment, leaving a live pinballmap.com entry nobody
 * tracks. That is the PP-l81u defect exactly. The fleet linking pass (PP-h059)
 * drives this tool across ~100 machines in one session, so the window is wide
 * open in practice, not theoretically.
 *
 * The `FOR UPDATE` re-read inside the transaction closes it: whoever holds the
 * lock sees the other writer's committed state, and a basis that moved means the
 * plan is void, so it is thrown away and re-planned rather than written. Same
 * read-modify-write serialization `editStoredSnapshot` uses in
 * `m/pinballmap-actions.ts`, for the same reason.
 *
 * A missing row is reported as `not_found` rather than a success payload
 * describing a link that was never stored (CORE-ARCH-012). An exclusion
 * re-stated without a reason keeps the stored one ({@link carryExcludedReason}).
 *
 * Returns the planned columns, which are also the stored ones: the CAS above is
 * what makes those the same claim, since a write only lands when the basis it
 * was planned against is still the row. `previous` comes from the locked read,
 * so it describes the state this change actually replaced — not whatever the
 * caller happened to read earlier.
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
      selection: carryExcludedReason(selection, basisRow),
      stored: {
        pinballmapMachineId: basisRow.pinballmapMachineId,
        pinballmapIntent: basisRow.pinballmapIntent,
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
          pinballmapIntent: machines.pinballmapIntent,
          // Spelled out rather than spread from PBM_LINK_COLUMNS because this
          // is a `db.select` over column refs, not a `findFirst` columns mask —
          // the two shapes are not interchangeable. Keep them in step: this row
          // becomes `previous`, the pre-change record the caller compares
          // against, so a column missing here is a field that silently reads as
          // unchanged. (PP-3bbr added `modelName`.)
          modelName: machines.modelName,
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

    return {
      ok: true,
      columns: planned.plan.columns,
      previous: outcome.previous,
    };
  }
}

const MACHINE_GONE_MESSAGE =
  "That machine no longer exists — it was deleted while the update was being applied. Nothing was written.";

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
