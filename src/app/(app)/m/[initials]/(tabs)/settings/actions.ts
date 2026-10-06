/**
 * Machine Settings Server Actions (docs/feature-specs/machine-settings.md)
 *
 * Thin wrappers over `~/services/machine-settings`, which owns authorization,
 * the writes, and the timeline events. These resolve the actor, validate the
 * input, and revalidate the machine's pages.
 *
 * Save model: whole-set save-on-Done. `saveSettingsSetAction` upserts the
 * entire set; Delete / Duplicate / MakeCommunity / Tag / Preferred are instant
 * single-set ops.
 */

"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { type AccessLevel } from "~/lib/permissions/matrix";
import {
  BUILTIN_SETTINGS_TAGS,
  settingsSetPayloadSchema,
} from "~/lib/machines/settings-types";
import { type ProseMirrorDoc, proseMirrorDocSchema } from "~/lib/tiptap/types";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import {
  createSettingsSet,
  deleteSettingsSet,
  duplicateSettingsSet,
  setPreferredSettingsSet,
  setSettingsSetTag,
  updateSettingsSet,
} from "~/services/machine-settings";
import { machines, userProfiles } from "~/server/db/schema";

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
const slotSchema = z.enum(BUILTIN_SETTINGS_TAGS);
const preferredSchema = z.object({
  id: z.uuid(),
  slot: slotSchema,
  preferred: z.boolean(),
});
const tagSchema = z.object({
  id: z.uuid(),
  tag: slotSchema,
  applied: z.boolean(),
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
 * Confirm the actor may manage settings on a machine with the given owner
 * (matrix `machines.settings.manage`). Used by the machine-level fields.
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

/** Delete a settings set. */
export async function deleteSettingsSetAction(
  input: z.input<typeof idSchema>
): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid input" };
  const actor = await getActor();
  if (!actor.ok) return { success: false, error: actor.error };

  const deleted = await deleteSettingsSet({ setId: parsed.data.id, actor });
  if (!deleted.ok) return serviceError(deleted);
  revalidateMachine(deleted.value.machineInitials);
  return { success: true };
}

/**
 * Duplicate a settings set into a personal set of the duplicator, carrying its
 * tags. Returns the new id so the client can reconcile its optimistic copy.
 */
export async function duplicateSettingsSetAction(
  input: z.input<typeof idSchema>
): Promise<SaveResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid input" };
  const actor = await getActor();
  if (!actor.ok) return { success: false, error: actor.error };

  const copy = await duplicateSettingsSet({ setId: parsed.data.id, actor });
  if (!copy.ok) return serviceError(copy);
  revalidateMachine(copy.value.machineInitials);
  return { success: true, id: copy.value.id, changed: true };
}

/** Turn the author's personal set into a community set (one-way). */
export async function makeCommunitySettingsSetAction(
  input: z.input<typeof idSchema>
): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid input" };
  const actor = await getActor();
  if (!actor.ok) return { success: false, error: actor.error };

  const updated = await updateSettingsSet({
    setId: parsed.data.id,
    actor,
    makeCommunity: true,
  });
  if (!updated.ok) return serviceError(updated);
  if (updated.value.changed) revalidateMachine(updated.value.machineInitials);
  return { success: true };
}

/** Apply or remove the House or Tournament tag. */
export async function setSettingsSetTagAction(
  input: z.input<typeof tagSchema>
): Promise<ActionResult> {
  const parsed = tagSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid input" };
  const actor = await getActor();
  if (!actor.ok) return { success: false, error: actor.error };

  const tagged = await setSettingsSetTag({
    setId: parsed.data.id,
    actor,
    tag: parsed.data.tag,
    applied: parsed.data.applied,
  });
  if (!tagged.ok) return serviceError(tagged);
  if (tagged.value.changed) revalidateMachine(tagged.value.machineInitials);
  return { success: true };
}

/** Make a set the machine's preferred House or Tournament set, or clear it. */
export async function setPreferredSettingsSetAction(
  input: z.input<typeof preferredSchema>
): Promise<ActionResult> {
  const parsed = preferredSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid input" };
  const actor = await getActor();
  if (!actor.ok) return { success: false, error: actor.error };

  const result = await setPreferredSettingsSet({
    setId: parsed.data.id,
    actor,
    slot: parsed.data.slot,
    preferred: parsed.data.preferred,
  });
  if (!result.ok) return serviceError(result);
  if (result.value.changed) revalidateMachine(result.value.machineInitials);
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
