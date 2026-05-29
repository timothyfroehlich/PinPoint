/**
 * Machine Lifecycle Event Helpers (PP-0x98, PP-tv9l)
 *
 * Thin wrappers around `createMachineTimelineEvent` for the two server actions
 * that mutate `machines` rows:
 *
 * - `emitMachineCreated` — used by `createMachineAction` after a successful
 *   insert. Always emits `machine_added`; emits `owner_set` (with a `to_owner`
 *   person-reference) when the new machine has an owner — real OR invited.
 *
 * - `emitMachineUpdated` — used by `updateMachineAction` after a successful
 *   update. Emits one event per tracked field that changed:
 *     - `name_changed` — when `before.name !== next.name`
 *     - `owner_changed` — when caller passes `ownerChanged: true` and the
 *       owner identity actually changed (set / removed / swapped). Records
 *       `from_owner`/`to_owner` person-references; which rows exist tells the
 *       renderer set-vs-changed-vs-removed.
 *     - `presence_changed` — when `next.presenceStatus !== undefined` and
 *       differs from `before.presenceStatus`
 *
 * Owners are stored as stable id person-references (real `user_id` xor invited
 * `invited_id`), never as snapshotted names — names resolve live at render
 * (PP-tv9l). This is what makes an *invited* owner emit a correct, resolvable
 * event instead of "Owner removed" (review findings #1–4).
 *
 * Both helpers MUST be called inside the same DB transaction as the row
 * mutation so an emit failure rolls back the underlying change.
 */

import {
  createMachineTimelineEvent,
  type TimelinePersonRef,
} from "~/lib/timeline/machine-events";
import type { MachinePresenceStatus } from "~/lib/machines/presence";
import type { DbTransaction } from "~/server/db";

/**
 * A machine owner reference — a real user xor an invited (not-yet-signed-up)
 * user. Exactly one id is present; the discriminated union enforces it.
 */
export type MachineOwnerRef = { userId: string } | { invitedId: string };

/** Stable key for owner-identity comparison across the two id kinds. */
function ownerKey(owner: MachineOwnerRef | null): string | null {
  if (owner === null) return null;
  return "userId" in owner ? `u:${owner.userId}` : `i:${owner.invitedId}`;
}

/** Build a `timeline_event_people` reference for an owner in a given role. */
function ownerPersonRef(
  role: string,
  owner: MachineOwnerRef
): TimelinePersonRef {
  return "userId" in owner
    ? { role, userId: owner.userId }
    : { role, invitedId: owner.invitedId };
}

/**
 * Build a {@link MachineOwnerRef} from the raw owner-id columns on a
 * `machines` row. Returns null when neither id is present (unowned machine).
 *
 * Both call sites in `m/actions.ts` and any other code that owns the
 * `(ownerId, invitedOwnerId)` pair share this single factory so the XOR
 * priority and the discriminated-union shape live in one place.
 */
export function toMachineOwnerRef(
  userId: string | null | undefined,
  invitedId: string | null | undefined
): MachineOwnerRef | null {
  if (userId != null) return { userId };
  if (invitedId != null) return { invitedId };
  return null;
}

export interface MachineCreatedSnapshot {
  id: string;
  owner: MachineOwnerRef | null;
}

/**
 * Emit lifecycle events for a newly created machine.
 *
 * Always emits `machine_added`. Additionally emits `owner_set` with a
 * `to_owner` person-reference when the machine has an owner (real or invited).
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

  if (machine.owner) {
    await createMachineTimelineEvent(
      machine.id,
      {
        sourceType: "lifecycle",
        tag: "lifecycle",
        eventData: { kind: "owner_set" },
        actorId,
        people: [ownerPersonRef("to_owner", machine.owner)],
      },
      tx
    );
  }
}

export interface MachineBeforeSnapshot {
  id: string;
  name: string;
  owner: MachineOwnerRef | null;
  presenceStatus: MachinePresenceStatus;
}

export interface MachineUpdateNext {
  name: string;
  /**
   * Whether the caller is updating ownership in this action invocation. When
   * `false`, no `owner_changed` event is considered even if the owner differs
   * (the caller didn't intend to change ownership in this request).
   */
  ownerChanged: boolean;
  /** New owner (real or invited), or null when removed. Only consulted if `ownerChanged`. */
  owner: MachineOwnerRef | null;
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

  if (next.ownerChanged && ownerKey(before.owner) !== ownerKey(next.owner)) {
    // `from_owner`/`to_owner` person-references; presence of each tells the
    // renderer whether this is a set (to-only), removal (from-only), or swap.
    const people: TimelinePersonRef[] = [];
    if (before.owner) people.push(ownerPersonRef("from_owner", before.owner));
    if (next.owner) people.push(ownerPersonRef("to_owner", next.owner));
    await createMachineTimelineEvent(
      before.id,
      {
        sourceType: "lifecycle",
        tag: "lifecycle",
        eventData: { kind: "owner_changed" },
        actorId,
        people,
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
