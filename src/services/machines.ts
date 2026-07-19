import { eq, and, type InferSelectModel } from "drizzle-orm";
import { db } from "~/server/db";
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
//     updateMachinePresence) -------------------------------------------------
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
  // Resolve channels before the transaction (Supabase Vault RPC is an external
  // round-trip — keep it out of the DB connection window). Only consumed on the
  // active-promotion notification path, but resolving unconditionally keeps the
  // control flow flat and matches the issues service.
  const channels = await getChannels();

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
  const channels = await getChannels();
  const oldOwnerId = current.ownerId;
  const { ownerId: newOwnerId, invitedOwnerId: newInvitedOwnerId } = newOwner;

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
