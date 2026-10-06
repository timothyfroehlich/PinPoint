/**
 * Machine Settings Server Actions (PP-43q3, PP-tn6t)
 *
 * CRUD over a machine's settings sets. Two authorization layers:
 * - **Creating** rides on the matrix entry `machines.settings.manage`
 *   (member → owner-scoped; technician/admin → any), via `checkPermission`.
 * - **Editing an existing set** is per-set (`~/lib/permissions`):
 *   owner sets are owner+admin only (protected); community sets are co-edited
 *   by technicians+, the owner, and admin. Publish / tag Tournament need edit
 *   rights; setting the Owner's default needs owner/admin on an owner set.
 *
 * Save model: whole-set save-on-Done. `saveSettingsSetAction` upserts the
 * entire set; Delete / Duplicate / SetPreferred / Publish / TournamentTag are
 * instant single-set ops. New sets are born private drafts.
 *
 * Create/update/delete emit a `settings`-tagged timeline event inside their
 * transaction. Setting the default, publishing, and tagging Tournament emit
 * nothing (per PP-tn6t; the old `settings_set_preferred` event is no longer
 * emitted — full removal of the event type is a follow-up).
 */

"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isPgErrorCode } from "~/lib/db/postgres-errors";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { type AccessLevel } from "~/lib/permissions/matrix";
import { canEditSet, canSetOwnerDefault, canViewSet } from "~/lib/permissions";
import {
  NAME_MAX,
  settingsSetPayloadSchema,
} from "~/lib/machines/settings-types";
import { type ProseMirrorDoc, proseMirrorDocSchema } from "~/lib/tiptap/types";
import { emitSettingsSetEvent } from "~/lib/timeline/machine-events";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import {
  createSettingsSet,
  toSettingsSetAuth as toAuth,
  updateSettingsSet,
} from "~/services/machine-settings";
import {
  machineSettingsSets,
  machines,
  userProfiles,
} from "~/server/db/schema";

type ActionResult = { success: true } | { success: false; error: string };
type SaveResult =
  // `changed` is false only for a no-op update (deep-compare matched), so the
  // client can skip refreshing updatedBy/updatedAt for an unchanged save.
  | { success: true; id: string; changed: boolean }
  | { success: false; error: string };

const saveSchema = settingsSetPayloadSchema.extend({
  machineId: z.uuid(),
  // Absent → insert; present → update.
  id: z.uuid().optional(),
});

const idSchema = z.object({ id: z.uuid() });
const setPreferredSchema = z.object({
  id: z.uuid(),
  isPreferred: z.boolean(),
});
const publishSchema = z.object({ id: z.uuid(), isPublic: z.boolean() });
const tournamentTagSchema = z.object({
  id: z.uuid(),
  isTournament: z.boolean(),
});
const settingsInstructionsSchema = z.object({
  machineId: z.uuid(),
  value: proseMirrorDocSchema.nullable(),
});
// The owner-requests field ("Before you change anything") shares the exact same
// shape and permission gate as the instructions field — same machine-level jsonb
// ProseMirror column, nullable, no timeline event.
const settingsRequestsSchema = settingsInstructionsSchema;

/** Resolve the authed user's id + access level, or a failure. */
async function getActor(): Promise<
  | { ok: true; userId: string; access: AccessLevel }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { role: true },
  });
  if (!profile) return { ok: false, error: "Profile not found" };

  return { ok: true, userId: user.id, access: getAccessLevel(profile.role) };
}

/**
 * Confirm the actor may CREATE/manage settings on a machine with the given
 * owner (matrix `machines.settings.manage`: member→owner-scoped, tech/admin→
 * any). Returns the actor id + access level. Per-set edit rights (owner-set
 * protection) are enforced separately via `canEditSet`.
 */
async function authorizeManage(
  machineOwnerId: string | null
): Promise<
  | { ok: true; userId: string; access: AccessLevel }
  | { ok: false; error: string }
> {
  const actor = await getActor();
  if (!actor.ok) return actor;

  const allowed = checkPermission("machines.settings.manage", actor.access, {
    userId: actor.userId,
    machineOwnerId,
  });
  if (!allowed) return { ok: false, error: "Forbidden" };

  return { ok: true, userId: actor.userId, access: actor.access };
}

function revalidateMachine(initials: string): void {
  revalidatePath(`/m/${initials}/settings`);
  revalidatePath(`/m/${initials}/timeline`);
  revalidatePath(`/m/${initials}`);
}

/** Map a service failure to the action's error string. */
function serviceError(error: { message: string }): {
  success: false;
  error: string;
} {
  return { success: false, error: error.message };
}

/**
 * Upsert a whole settings set. Insert when `id` is absent (returns the new id),
 * else update the existing row. On update the set's `machineId` is taken from
 * the persisted row and cross-checked against the input (no re-parenting).
 * A no-op save (no content change) skips the write, the `updatedAt` bump, and
 * the timeline emit, and reports `changed: false`.
 */
export async function saveSettingsSetAction(
  input: z.input<typeof saveSchema>
): Promise<SaveResult> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const { machineId, id, ...payload } = parsed.data;

  const actor = await getActor();
  if (!actor.ok) return { success: false, error: actor.error };

  if (!id) {
    const created = await createSettingsSet({ machineId, actor, payload });
    if (!created.ok) return serviceError(created);
    revalidateMachine(created.value.machineInitials);
    return { success: true, id: created.value.id, changed: true };
  }

  const updated = await updateSettingsSet({
    setId: id,
    actor,
    expectedMachineId: machineId,
    payload,
  });
  if (!updated.ok) return serviceError(updated);
  if (updated.value.changed) revalidateMachine(updated.value.machineInitials);
  return { success: true, id, changed: updated.value.changed };
}

/**
 * Load a set + its machine for the single-set (id-only) operations.
 */
async function loadSetWithMachine(setId: string): Promise<{
  set: {
    id: string;
    machineId: string;
    name: string;
    isPreferred: boolean;
    isOwnerSet: boolean;
    isPublic: boolean;
    isTournament: boolean;
    createdBy: string | null;
  };
  machine: { id: string; initials: string; ownerId: string | null };
} | null> {
  const set = await db.query.machineSettingsSets.findFirst({
    where: eq(machineSettingsSets.id, setId),
    columns: {
      id: true,
      machineId: true,
      name: true,
      isPreferred: true,
      isOwnerSet: true,
      isPublic: true,
      isTournament: true,
      createdBy: true,
    },
  });
  if (!set) return null;
  const machine = await db.query.machines.findFirst({
    where: eq(machines.id, set.machineId),
    columns: { id: true, initials: true, ownerId: true },
  });
  if (!machine) return null;
  return { set, machine };
}

/** Delete a settings set. */
export async function deleteSettingsSetAction(
  input: z.input<typeof idSchema>
): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid input" };

  const loaded = await loadSetWithMachine(parsed.data.id);
  if (!loaded) return { success: false, error: "Settings set not found" };

  const actor = await getActor();
  if (!actor.ok) return { success: false, error: actor.error };
  if (
    !canEditSet(
      toAuth(loaded.set),
      loaded.machine.ownerId,
      actor.userId,
      actor.access
    )
  ) {
    return { success: false, error: "Forbidden" };
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(machineSettingsSets)
      .where(eq(machineSettingsSets.id, parsed.data.id));
    await emitSettingsSetEvent(
      loaded.machine.id,
      "settings_set_deleted",
      loaded.set.name,
      actor.userId,
      tx
    );
  });

  revalidateMachine(loaded.machine.initials);
  return { success: true };
}

/**
 * Duplicate a settings set into a fresh private draft owned by the duplicator:
 * carries the Tournament tag, re-derives ownership (a tech's copy of an owner
 * set is a community set), never preferred, fresh authorship/timestamps.
 * Returns the new id so the client can reconcile its optimistic copy.
 */
export async function duplicateSettingsSetAction(
  input: z.input<typeof idSchema>
): Promise<SaveResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid input" };

  const original = await db.query.machineSettingsSets.findFirst({
    where: eq(machineSettingsSets.id, parsed.data.id),
    columns: {
      machineId: true,
      name: true,
      description: true,
      sections: true,
      isTournament: true,
      isOwnerSet: true,
      isPublic: true,
      isPreferred: true,
      createdBy: true,
    },
  });
  if (!original) return { success: false, error: "Settings set not found" };

  const machine = await db.query.machines.findFirst({
    where: eq(machines.id, original.machineId),
    columns: { id: true, initials: true, ownerId: true },
  });
  if (!machine) return { success: false, error: "Machine not found" };

  const auth = await authorizeManage(machine.ownerId);
  if (!auth.ok) return { success: false, error: auth.error };
  // Must be able to SEE the source to copy it — blocks duplicating another
  // user's private draft.
  if (!canViewSet(toAuth(original), auth.userId, auth.access)) {
    return { success: false, error: "Settings set not found" };
  }

  // Cap the copy name so a long original (up to NAME_MAX) plus the " (copy)"
  // suffix can't exceed NAME_MAX — otherwise the duplicate would persist but
  // fail the save schema on any later edit.
  const COPY_SUFFIX = " (copy)";
  const copyName = `${original.name.slice(0, NAME_MAX - COPY_SUFFIX.length)}${COPY_SUFFIX}`;
  const newId = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(machineSettingsSets)
      .values({
        machineId: original.machineId,
        name: copyName,
        description: original.description,
        sections: original.sections,
        // The copy is a fresh private draft owned by the duplicator: ownership
        // is re-derived (a tech's copy of an owner set is a community set they
        // can edit), never preferred, but it CARRIES the Tournament tag.
        isOwnerSet: machine.ownerId !== null && auth.userId === machine.ownerId,
        isPublic: false,
        isPreferred: false,
        isTournament: original.isTournament,
        createdBy: auth.userId,
        updatedBy: auth.userId,
      })
      .returning({ id: machineSettingsSets.id });
    if (!inserted) return undefined;
    await emitSettingsSetEvent(
      machine.id,
      "settings_set_created",
      copyName,
      auth.userId,
      tx
    );
    return inserted.id;
  });
  if (!newId) return { success: false, error: "Could not duplicate set" };

  revalidateMachine(machine.initials);
  return { success: true, id: newId, changed: true };
}

/**
 * Set (or clear) the preferred set. Exclusive: promoting one clears the
 * current preferred first (the partial unique index is the DB backstop).
 */
export async function setPreferredSettingsSetAction(
  input: z.input<typeof setPreferredSchema>
): Promise<ActionResult> {
  const parsed = setPreferredSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid input" };

  const loaded = await loadSetWithMachine(parsed.data.id);
  if (!loaded) return { success: false, error: "Settings set not found" };

  // The Owner's default is owner-scoped: only the owner/admin may set it, and
  // only an owner set is eligible (a community set can't become the default).
  const actor = await getActor();
  if (!actor.ok) return { success: false, error: actor.error };
  if (
    !canSetOwnerDefault(
      toAuth(loaded.set),
      loaded.machine.ownerId,
      actor.userId,
      actor.access
    )
  ) {
    return { success: false, error: "Forbidden" };
  }

  // Idempotent: already in the requested state → no write.
  if (loaded.set.isPreferred === parsed.data.isPreferred) {
    return { success: true };
  }

  try {
    await db.transaction(async (tx) => {
      if (parsed.data.isPreferred) {
        // Clear the machine's current preferred set first so the partial unique
        // index never sees two preferred rows (per-statement check, same tx).
        await tx
          .update(machineSettingsSets)
          .set({ isPreferred: false })
          .where(
            and(
              eq(machineSettingsSets.machineId, loaded.machine.id),
              eq(machineSettingsSets.isPreferred, true)
            )
          );
      }
      await tx
        .update(machineSettingsSets)
        .set({
          isPreferred: parsed.data.isPreferred,
          // The Owner's default is ALWAYS public (`publishSettingsSetAction`
          // refuses to unpublish it, and the ⋮ menu hides its Publish toggle).
          // Promoting a private draft must therefore publish it too, or the row
          // is left `isPublic: false` while everyone can see it — a "Private
          // draft" badge on a public set, with no control left to correct it,
          // and a silent disappearance for other viewers once it's unset.
          ...(parsed.data.isPreferred ? { isPublic: true } : {}),
          updatedBy: actor.userId,
          updatedAt: new Date(),
        })
        .where(eq(machineSettingsSets.id, parsed.data.id));
      // No timeline event for the Owner's default (PP-tn6t).
    });
  } catch (error) {
    // Two callers promoting different sets concurrently can collide on the
    // partial unique index (uniq_machine_settings_preferred). Surface a
    // retryable message instead of a 500.
    if (isPgErrorCode(error, "23505")) {
      return {
        success: false,
        error: "Another set was just made preferred. Please try again.",
      };
    }
    throw error;
  }

  revalidateMachine(loaded.machine.initials);
  return { success: true };
}

/**
 * Publish or unpublish a set (visibility toggle). Publishing makes a private
 * draft visible to everyone; both directions need edit rights on the set. The
 * Owner's default must stay public, so unpublishing it is refused.
 */
export async function publishSettingsSetAction(
  input: z.input<typeof publishSchema>
): Promise<ActionResult> {
  const parsed = publishSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid input" };

  const actor = await getActor();
  if (!actor.ok) return { success: false, error: actor.error };

  const updated = await updateSettingsSet({
    setId: parsed.data.id,
    actor,
    isPublic: parsed.data.isPublic,
  });
  if (!updated.ok) return serviceError(updated);
  if (updated.value.changed) revalidateMachine(updated.value.machineInitials);
  return { success: true };
}

/**
 * Toggle the orthogonal "Tournament" tag on a set. Needs edit rights on the
 * set; no timeline event (PP-tn6t).
 */
export async function setTournamentTagAction(
  input: z.input<typeof tournamentTagSchema>
): Promise<ActionResult> {
  const parsed = tournamentTagSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid input" };

  const actor = await getActor();
  if (!actor.ok) return { success: false, error: actor.error };

  const updated = await updateSettingsSet({
    setId: parsed.data.id,
    actor,
    isTournament: parsed.data.isTournament,
  });
  if (!updated.ok) return serviceError(updated);
  if (updated.value.changed) revalidateMachine(updated.value.machineInitials);
  return { success: true };
}

/**
 * Update a machine's "How to change settings" instructions (machine-level, shared
 * by every settings set; rendered at the top of the Settings tab). Gated by the
 * same `machines.settings.manage` permission as the sets themselves. No timeline
 * event — this is reference metadata, not a per-set change.
 */
export async function updateMachineSettingsInstructionsAction(
  input: z.input<typeof settingsInstructionsSchema>
): Promise<ActionResult> {
  const parsed = settingsInstructionsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const { machineId } = parsed.data;
  // Validate-then-cast at the write boundary (same pattern as saveSettingsSet).
  const value = parsed.data.value as ProseMirrorDoc | null;

  const machine = await db.query.machines.findFirst({
    where: eq(machines.id, machineId),
    columns: { id: true, initials: true, ownerId: true },
  });
  if (!machine) return { success: false, error: "Machine not found" };

  const auth = await authorizeManage(machine.ownerId);
  if (!auth.ok) return { success: false, error: auth.error };

  await db
    .update(machines)
    .set({ settingsInstructions: value, updatedAt: new Date() })
    .where(eq(machines.id, machineId));

  revalidateMachine(machine.initials);
  return { success: true };
}

/**
 * Update a machine's "Before you change anything" owner requests (machine-level,
 * shared by every settings set; rendered FIRST at the top of the Settings tab).
 * A near-clone of `updateMachineSettingsInstructionsAction` — same
 * `machines.settings.manage` gate, same null-on-clear semantics, no timeline
 * event — differing only in the column it writes (`settingsRequests`). The two
 * are intentionally separate one-field actions rather than one merged write so
 * each section's inline Save persists independently (the InlineEditableField
 * contract is one `onSave(machineId, value)` per field).
 */
export async function updateMachineSettingsRequestsAction(
  input: z.input<typeof settingsRequestsSchema>
): Promise<ActionResult> {
  const parsed = settingsRequestsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const { machineId } = parsed.data;
  // Validate-then-cast at the write boundary (same pattern as the sibling action).
  const value = parsed.data.value as ProseMirrorDoc | null;

  const machine = await db.query.machines.findFirst({
    where: eq(machines.id, machineId),
    columns: { id: true, initials: true, ownerId: true },
  });
  if (!machine) return { success: false, error: "Machine not found" };

  const auth = await authorizeManage(machine.ownerId);
  if (!auth.ok) return { success: false, error: auth.error };

  await db
    .update(machines)
    .set({ settingsRequests: value, updatedAt: new Date() })
    .where(eq(machines.id, machineId));

  revalidateMachine(machine.initials);
  return { success: true };
}
