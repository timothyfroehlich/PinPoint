/**
 * Machine Lifecycle Event Helpers (PP-0x98)
 *
 * Thin wrappers around `createMachineTimelineEvent` for the two server actions
 * that mutate `machines` rows:
 *
 * - `emitMachineCreated` — used by `createMachineAction` after a successful
 *   insert. Always emits `machine_added`; emits `owner_set` when the new
 *   machine has an active `ownerId`.
 *
 * - `emitMachineUpdated` — used by `updateMachineAction` after a successful
 *   update. Emits one event per tracked field that changed:
 *     - `name_changed` — when `before.name !== next.name`
 *     - `owner_changed` — when caller passes `ownerChanged: true` and the
 *       owner id actually changed (or owner was set/removed)
 *     - `presence_changed` — when `next.presenceStatus !== undefined` and
 *       differs from `before.presenceStatus`
 *
 * Both helpers MUST be called inside the same DB transaction as the row
 * mutation so an emit failure rolls back the underlying change.
 */

import { eq } from "drizzle-orm";

import { createMachineTimelineEvent } from "~/lib/timeline/machine-events";
import type { MachinePresenceStatus } from "~/lib/machines/presence";
import type { DbTransaction } from "~/server/db";
import { userProfiles } from "~/server/db/schema";

export interface MachineCreatedSnapshot {
  id: string;
  ownerId: string | null;
}

/**
 * Emit lifecycle events for a newly created machine.
 *
 * Always emits `machine_added`. Additionally emits `owner_set` when the
 * machine has an active `ownerId`; resolves the owner's display name from
 * `user_profiles.name` via the supplied transaction.
 */
export async function emitMachineCreated(
  tx: DbTransaction,
  machine: MachineCreatedSnapshot,
  actorId: string
): Promise<void> {
  await createMachineTimelineEvent(
    machine.id,
    {
      sourceType: "lifecycle",
      tag: "lifecycle",
      eventData: { kind: "machine_added" },
      actorId,
    },
    tx
  );

  if (machine.ownerId) {
    const ownerProfile = await tx.query.userProfiles.findFirst({
      where: eq(userProfiles.id, machine.ownerId),
      columns: { id: true, name: true },
    });
    if (ownerProfile) {
      await createMachineTimelineEvent(
        machine.id,
        {
          sourceType: "lifecycle",
          tag: "lifecycle",
          eventData: {
            kind: "owner_set",
            toOwnerId: ownerProfile.id,
            toOwnerName: ownerProfile.name,
          },
          actorId,
        },
        tx
      );
    }
  }
}

export interface MachineBeforeSnapshot {
  id: string;
  name: string;
  ownerId: string | null;
  ownerName: string | null;
  presenceStatus: MachinePresenceStatus;
}

export interface MachineUpdateNext {
  name: string;
  /**
   * Whether the caller is updating ownership in this action invocation. When
   * `false`, no `owner_changed` event is considered even if `ownerId` differs
   * (the caller didn't intend to change ownership in this request).
   */
  ownerChanged: boolean;
  /** New active owner id (or null when removed). Only consulted if `ownerChanged`. */
  ownerId: string | null;
  /**
   * New presence status, or `undefined` when the action did not touch
   * presence. `undefined` skips the `presence_changed` event entirely.
   */
  presenceStatus: MachinePresenceStatus | undefined;
}

/**
 * Emit lifecycle events for a machine update — one event per tracked field
 * that changed. Skips fields that did not change or were not part of the
 * update.
 */
export async function emitMachineUpdated(
  tx: DbTransaction,
  before: MachineBeforeSnapshot,
  next: MachineUpdateNext,
  actorId: string
): Promise<void> {
  if (next.name !== before.name) {
    await createMachineTimelineEvent(
      before.id,
      {
        sourceType: "lifecycle",
        tag: "lifecycle",
        eventData: { kind: "name_changed", from: before.name, to: next.name },
        actorId,
      },
      tx
    );
  }

  if (next.ownerChanged && next.ownerId !== before.ownerId) {
    let toOwnerName: string | null = null;
    if (next.ownerId) {
      const newOwner = await tx.query.userProfiles.findFirst({
        where: eq(userProfiles.id, next.ownerId),
        columns: { name: true },
      });
      toOwnerName = newOwner?.name ?? null;
    }
    await createMachineTimelineEvent(
      before.id,
      {
        sourceType: "lifecycle",
        tag: "lifecycle",
        eventData: {
          kind: "owner_changed",
          fromOwnerId: before.ownerId,
          fromOwnerName: before.ownerName,
          toOwnerId: next.ownerId,
          toOwnerName,
        },
        actorId,
      },
      tx
    );
  }

  if (
    next.presenceStatus !== undefined &&
    next.presenceStatus !== before.presenceStatus
  ) {
    await createMachineTimelineEvent(
      before.id,
      {
        sourceType: "lifecycle",
        tag: "lifecycle",
        eventData: {
          kind: "presence_changed",
          from: before.presenceStatus,
          to: next.presenceStatus,
        },
        actorId,
      },
      tx
    );
  }
}
