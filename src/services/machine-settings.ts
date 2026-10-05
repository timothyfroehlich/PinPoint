import { Buffer } from "node:buffer";
import { isDeepStrictEqual } from "node:util";
import { and, eq } from "drizzle-orm";

import { isPgErrorCode } from "~/lib/db/postgres-errors";
import { canEditSet, type SettingsSetAuth } from "~/lib/permissions";
import { checkPermission } from "~/lib/permissions/helpers";
import { type AccessLevel } from "~/lib/permissions/matrix";
import {
  type SettingsSection,
  type SettingsSetPayload,
} from "~/lib/machines/settings-types";
import { type Result, err, ok } from "~/lib/result";
import { type ProseMirrorDoc } from "~/lib/tiptap/types";
import { emitSettingsSetEvent } from "~/lib/timeline/machine-events";
import { db } from "~/server/db";
import { machineSettingsSets, machines } from "~/server/db/schema";

/**
 * Settings-set writes shared by the Settings tab's Server Actions and the MCP
 * tools (PP-u4ab.25). Callers authenticate and validate the payload shape
 * (`settingsSetPayloadSchema`); this layer owns authorization against the
 * per-set rules in `~/lib/permissions/settings`, the writes, and the timeline
 * events. Path revalidation stays with the Server Actions.
 */

/** Who is acting, resolved by the caller from its own auth. */
export interface SettingsActor {
  userId: string;
  access: AccessLevel;
}

export type SettingsWriteError =
  "not_found" | "denied" | "invalid" | "conflict";

// Aggregate byte ceiling on the persisted JSON content of one set — a backstop
// against payload bloat beyond the per-field/array caps in the Zod schema.
const PAYLOAD_BYTES_MAX = 200_000;

/**
 * The validated payload as the column stores it. Zod stripped the client-only
 * `_key` from each row/switch, so the runtime value is the persist-ready shape;
 * the casts bridge the compile-time gap to the branded types (whose `_key` is
 * re-derived on read). `proseMirrorDocSchema` checked the top-level doc shape.
 */
function toStored(payload: SettingsSetPayload): {
  name: string;
  description: ProseMirrorDoc | null;
  sections: SettingsSection[];
} {
  return {
    name: payload.name,
    description: payload.description as ProseMirrorDoc | null,
    sections: payload.sections as unknown as SettingsSection[],
  };
}

function exceedsByteCeiling(stored: ReturnType<typeof toStored>): boolean {
  // True UTF-8 byte count (not UTF-16 code units) so multibyte content is
  // measured accurately against the ceiling.
  const bytes =
    Buffer.byteLength(JSON.stringify(stored.sections), "utf8") +
    Buffer.byteLength(JSON.stringify(stored.description ?? null), "utf8");
  return bytes > PAYLOAD_BYTES_MAX;
}

/** Project a settings-set row's auth-relevant columns to `SettingsSetAuth`. */
export function toSettingsSetAuth(row: {
  isOwnerSet: boolean;
  isPublic: boolean;
  isPreferred: boolean;
  createdBy: string | null;
}): SettingsSetAuth {
  return {
    isOwnerSet: row.isOwnerSet,
    isPublic: row.isPublic,
    isPreferred: row.isPreferred,
    createdById: row.createdBy,
  };
}

export interface CreateSettingsSetParams {
  machineId: string;
  actor: SettingsActor;
  payload: SettingsSetPayload;
  /** Publish on creation. Omitted → a private draft (the default). */
  isPublic?: boolean;
  isTournament?: boolean;
}

export interface CreatedSettingsSet {
  id: string;
  machineInitials: string;
  isOwnerSet: boolean;
  isPublic: boolean;
  isPreferred: boolean;
  isTournament: boolean;
}

/**
 * Create a settings set. Gated by `machines.settings.manage`; whoever may
 * create a set may also edit, publish, and tag it, so the optional flags need
 * no further check.
 *
 * Kind is captured at creation: a set the machine owner makes is an owner set
 * (protected); anyone else's is a community set. New sets are private drafts —
 * EXCEPT the owner's very first set with no existing default, which
 * auto-becomes the Owner's default (and so is published).
 */
export async function createSettingsSet({
  machineId,
  actor,
  payload,
  isPublic = false,
  isTournament = false,
}: CreateSettingsSetParams): Promise<
  Result<CreatedSettingsSet, SettingsWriteError>
> {
  const stored = toStored(payload);
  if (exceedsByteCeiling(stored)) {
    return err("invalid", "Settings are too large to save.");
  }

  const machine = await db.query.machines.findFirst({
    where: eq(machines.id, machineId),
    columns: { id: true, initials: true, ownerId: true },
  });
  if (!machine) return err("not_found", "Machine not found");

  if (
    !checkPermission("machines.settings.manage", actor.access, {
      userId: actor.userId,
      machineOwnerId: machine.ownerId,
    })
  ) {
    return err("denied", "Forbidden");
  }

  const isOwnerSet =
    machine.ownerId !== null && actor.userId === machine.ownerId;
  const existingPreferred = isOwnerSet
    ? await db.query.machineSettingsSets.findFirst({
        where: and(
          eq(machineSettingsSets.machineId, machineId),
          eq(machineSettingsSets.isPreferred, true)
        ),
        columns: { id: true },
      })
    : undefined;
  const autoDefault = isOwnerSet && !existingPreferred;

  const insertSet = (asDefault: boolean): Promise<string | undefined> =>
    db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(machineSettingsSets)
        .values({
          machineId,
          ...stored,
          isOwnerSet,
          isPublic: asDefault || isPublic,
          isPreferred: asDefault,
          isTournament,
          createdBy: actor.userId,
          updatedBy: actor.userId,
        })
        .returning({ id: machineSettingsSets.id });
      if (!inserted) return undefined;
      await emitSettingsSetEvent(
        machineId,
        "settings_set_created",
        stored.name,
        actor.userId,
        tx
      );
      return inserted.id;
    });

  // The `existingPreferred` probe above runs OUTSIDE the transaction, so two
  // concurrent first-set creates by the same owner (two tabs) both compute
  // autoDefault=true and the second collides on the partial unique index
  // `uniq_machine_settings_preferred`. Losing that race is not an error —
  // a default now exists, so retry as an ordinary set rather than 500-ing and
  // discarding the user's set.
  let asDefault = autoDefault;
  let newId: string | undefined;
  try {
    newId = await insertSet(asDefault);
  } catch (error) {
    if (!autoDefault || !isPgErrorCode(error, "23505")) throw error;
    asDefault = false;
    newId = await insertSet(false);
  }
  if (!newId) throw new Error("Could not create settings set");

  return ok({
    id: newId,
    machineInitials: machine.initials,
    isOwnerSet,
    isPublic: asDefault || isPublic,
    isPreferred: asDefault,
    isTournament,
  });
}

export interface UpdateSettingsSetParams {
  setId: string;
  actor: SettingsActor;
  /**
   * The machine the caller believes the set belongs to. A mismatch reads as
   * not-found, so a set can't be re-parented or probed across machines.
   */
  expectedMachineId?: string;
  /**
   * The set's `updatedAt` when the caller read it. A caller that builds the
   * payload from its own earlier read passes this so an edit landing in
   * between is refused (`conflict`) instead of overwritten.
   */
  expectedUpdatedAt?: Date;
  /** Full replacement of the set's name, description, and sections. */
  payload?: SettingsSetPayload;
  isPublic?: boolean;
  isTournament?: boolean;
}

export interface UpdatedSettingsSet {
  id: string;
  machineId: string;
  machineInitials: string;
  /** False when every supplied value already matched — nothing was written. */
  changed: boolean;
  contentChanged: boolean;
  isPublic: boolean;
  isTournament: boolean;
}

/**
 * Update an existing set's content and/or its Public and Tournament flags in
 * one transaction. All three need edit rights on the set (owner sets: owner +
 * admin; community sets: technicians+, the owner, admin). A content change
 * emits `settings_set_updated`; flag changes emit nothing (PP-tn6t). Values
 * that already match are skipped, and an all-no-op call writes nothing.
 */
export async function updateSettingsSet({
  setId,
  actor,
  expectedMachineId,
  expectedUpdatedAt,
  payload,
  isPublic,
  isTournament,
}: UpdateSettingsSetParams): Promise<
  Result<UpdatedSettingsSet, SettingsWriteError>
> {
  const stored = payload ? toStored(payload) : undefined;
  if (stored && exceedsByteCeiling(stored)) {
    return err("invalid", "Settings are too large to save.");
  }

  const existing = await db.query.machineSettingsSets.findFirst({
    where: eq(machineSettingsSets.id, setId),
    columns: {
      id: true,
      machineId: true,
      name: true,
      description: true,
      sections: true,
      isOwnerSet: true,
      isPublic: true,
      isPreferred: true,
      isTournament: true,
      createdBy: true,
      updatedAt: true,
    },
  });
  if (
    !existing ||
    (expectedMachineId !== undefined &&
      existing.machineId !== expectedMachineId)
  ) {
    return err("not_found", "Settings set not found");
  }

  const machine = await db.query.machines.findFirst({
    where: eq(machines.id, existing.machineId),
    columns: { id: true, initials: true, ownerId: true },
  });
  if (!machine) return err("not_found", "Machine not found");

  // canEditSet includes view rights, so another user's private draft is
  // refused here too.
  if (
    !canEditSet(
      toSettingsSetAuth(existing),
      machine.ownerId,
      actor.userId,
      actor.access
    )
  ) {
    return err("denied", "Forbidden");
  }

  if (
    expectedUpdatedAt !== undefined &&
    existing.updatedAt.getTime() !== expectedUpdatedAt.getTime()
  ) {
    return err(
      "conflict",
      "The set changed since it was read. Read it again and reapply the change."
    );
  }

  // The Owner's default is always public — unset it before hiding.
  if (isPublic === false && existing.isPreferred) {
    return err(
      "invalid",
      "Unset the Owner's default before making it private."
    );
  }

  // Both sides are `_key`-free (Zod stripped the input; the column never
  // stored it), so a structural deep-equal is exact.
  const contentChanged =
    stored !== undefined &&
    !isDeepStrictEqual(
      {
        name: existing.name,
        description: existing.description ?? null,
        sections: existing.sections,
      },
      {
        name: stored.name,
        description: stored.description ?? null,
        sections: stored.sections,
      }
    );
  const publicChanged =
    isPublic !== undefined && isPublic !== existing.isPublic;
  const tournamentChanged =
    isTournament !== undefined && isTournament !== existing.isTournament;
  const changed = contentChanged || publicChanged || tournamentChanged;

  if (changed) {
    await db.transaction(async (tx) => {
      await tx
        .update(machineSettingsSets)
        .set({
          ...(contentChanged ? stored : {}),
          ...(publicChanged ? { isPublic } : {}),
          ...(tournamentChanged ? { isTournament } : {}),
          updatedBy: actor.userId,
          updatedAt: new Date(),
        })
        .where(eq(machineSettingsSets.id, setId));
      if (contentChanged) {
        await emitSettingsSetEvent(
          machine.id,
          "settings_set_updated",
          stored.name,
          actor.userId,
          tx
        );
      }
    });
  }

  return ok({
    id: existing.id,
    machineId: machine.id,
    machineInitials: machine.initials,
    changed,
    contentChanged,
    isPublic: isPublic ?? existing.isPublic,
    isTournament: isTournament ?? existing.isTournament,
  });
}
