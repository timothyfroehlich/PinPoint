/**
 * Machine Settings Server Actions (PP-43q3)
 *
 * Owner/technician/admin CRUD over a machine's settings sets. Authorization is
 * the matrix entry `machines.settings.manage` (member → owner-scoped;
 * technician/admin → any), checked via `checkPermission` per AGENTS.md rule 12.
 *
 * Save model: whole-set save-on-Done. `saveSettingsSetAction` upserts the
 * entire set; Delete / Duplicate / SetPreferred are instant single-set ops.
 *
 * Each mutation also emits a `settings`-tagged timeline event
 * (`emitSettingsSetEvent`) inside its transaction, so the event commits
 * atomically with the write. No-op saves and un-preferring emit nothing.
 */

"use server";

import { Buffer } from "node:buffer";
import { isDeepStrictEqual } from "node:util";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isPgErrorCode } from "~/lib/db/postgres-errors";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import {
  NAME_MAX,
  type SettingsSection,
  settingsSetPayloadSchema,
} from "~/lib/machines/settings-types";
import { type ProseMirrorDoc, proseMirrorDocSchema } from "~/lib/tiptap/types";
import { emitSettingsSetEvent } from "~/lib/timeline/machine-events";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
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

// Aggregate byte ceiling on the persisted JSON content of one set — a backstop
// against payload bloat beyond the per-field/array caps in the Zod schema.
const PAYLOAD_BYTES_MAX = 200_000;

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
const settingsInstructionsSchema = z.object({
  machineId: z.uuid(),
  value: proseMirrorDocSchema.nullable(),
});

/**
 * Resolve the authed user and confirm they may manage settings on a machine
 * with the given owner. Returns the actor id or a failure result.
 */
async function authorizeManage(
  machineOwnerId: string | null
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
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

  const allowed = checkPermission(
    "machines.settings.manage",
    getAccessLevel(profile.role),
    { userId: user.id, machineOwnerId }
  );
  if (!allowed) return { ok: false, error: "Forbidden" };

  return { ok: true, userId: user.id };
}

function revalidateMachine(initials: string): void {
  revalidatePath(`/m/${initials}/settings`);
  revalidatePath(`/m/${initials}/timeline`);
  revalidatePath(`/m/${initials}`);
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
  const { machineId, id, name } = parsed.data;
  // Validate-then-cast at the write boundary: `proseMirrorDocSchema` checks the
  // top-level doc shape; the branded ProseMirrorDoc / SettingsSection types are
  // trusted past that point (same pattern as the timeline comment actions).
  const description = parsed.data.description as ProseMirrorDoc | null;
  // Zod stripped the client-only `_key` from each row/switch, so the runtime
  // value is the persist-ready shape; the cast bridges the compile-time gap to
  // the branded SettingsSection (whose `_key` is re-derived on read).
  const sections = parsed.data.sections as unknown as SettingsSection[];

  // True UTF-8 byte count (not UTF-16 code units) so multibyte content is
  // measured accurately against the ceiling.
  const bytes =
    Buffer.byteLength(JSON.stringify(sections), "utf8") +
    Buffer.byteLength(JSON.stringify(description ?? null), "utf8");
  if (bytes > PAYLOAD_BYTES_MAX) {
    return { success: false, error: "Settings are too large to save." };
  }

  const machine = await db.query.machines.findFirst({
    where: eq(machines.id, machineId),
    columns: { id: true, initials: true, ownerId: true },
  });
  if (!machine) return { success: false, error: "Machine not found" };

  const auth = await authorizeManage(machine.ownerId);
  if (!auth.ok) return { success: false, error: auth.error };

  // ---- Insert ----
  if (!id) {
    const newId = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(machineSettingsSets)
        .values({
          machineId,
          name,
          description,
          sections,
          createdBy: auth.userId,
          updatedBy: auth.userId,
        })
        .returning({ id: machineSettingsSets.id });
      if (!inserted) return undefined;
      await emitSettingsSetEvent(
        machineId,
        "settings_set_created",
        name,
        auth.userId,
        tx
      );
      return inserted.id;
    });
    if (!newId) return { success: false, error: "Could not create set" };

    revalidateMachine(machine.initials);
    return { success: true, id: newId, changed: true };
  }

  // ---- Update ----
  const existing = await db.query.machineSettingsSets.findFirst({
    where: eq(machineSettingsSets.id, id),
    columns: {
      id: true,
      machineId: true,
      name: true,
      description: true,
      sections: true,
    },
  });
  if (!existing) return { success: false, error: "Settings set not found" };
  // IDOR guard: a set cannot be re-parented to another machine via the input.
  if (existing.machineId !== machineId) {
    return { success: false, error: "Settings set not found" };
  }

  // No-op guard: skip the write (and its timeline emit) when nothing changed.
  // Both sides are already `_key`-free (Zod stripped the input; the column
  // never stored it), so a structural deep-equal is exact.
  const unchanged = isDeepStrictEqual(
    {
      name: existing.name,
      description: existing.description ?? null,
      sections: existing.sections,
    },
    { name, description: description ?? null, sections }
  );
  if (unchanged) return { success: true, id, changed: false };

  await db.transaction(async (tx) => {
    await tx
      .update(machineSettingsSets)
      .set({
        name,
        description,
        sections,
        updatedBy: auth.userId,
        updatedAt: new Date(),
      })
      .where(eq(machineSettingsSets.id, id));
    await emitSettingsSetEvent(
      machineId,
      "settings_set_updated",
      name,
      auth.userId,
      tx
    );
  });

  revalidateMachine(machine.initials);
  return { success: true, id, changed: true };
}

/**
 * Load a set + its machine for the single-set (id-only) operations.
 */
async function loadSetWithMachine(setId: string): Promise<{
  set: { id: string; machineId: string; name: string; isPreferred: boolean };
  machine: { id: string; initials: string; ownerId: string | null };
} | null> {
  const set = await db.query.machineSettingsSets.findFirst({
    where: eq(machineSettingsSets.id, setId),
    columns: { id: true, machineId: true, name: true, isPreferred: true },
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

  const auth = await authorizeManage(loaded.machine.ownerId);
  if (!auth.ok) return { success: false, error: auth.error };

  await db.transaction(async (tx) => {
    await tx
      .delete(machineSettingsSets)
      .where(eq(machineSettingsSets.id, parsed.data.id));
    await emitSettingsSetEvent(
      loaded.machine.id,
      "settings_set_deleted",
      loaded.set.name,
      auth.userId,
      tx
    );
  });

  revalidateMachine(loaded.machine.initials);
  return { success: true };
}

/**
 * Duplicate a settings set (never preferred; fresh authorship/timestamps).
 * Returns the new id so the client can reconcile its optimistic copy.
 */
export async function duplicateSettingsSetAction(
  input: z.input<typeof idSchema>
): Promise<SaveResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid input" };

  const original = await db.query.machineSettingsSets.findFirst({
    where: eq(machineSettingsSets.id, parsed.data.id),
    columns: { machineId: true, name: true, description: true, sections: true },
  });
  if (!original) return { success: false, error: "Settings set not found" };

  const machine = await db.query.machines.findFirst({
    where: eq(machines.id, original.machineId),
    columns: { id: true, initials: true, ownerId: true },
  });
  if (!machine) return { success: false, error: "Machine not found" };

  const auth = await authorizeManage(machine.ownerId);
  if (!auth.ok) return { success: false, error: auth.error };

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
        isPreferred: false,
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

  const auth = await authorizeManage(loaded.machine.ownerId);
  if (!auth.ok) return { success: false, error: auth.error };

  // Idempotent: already in the requested state → no write, no timeline event.
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
          updatedBy: auth.userId,
          updatedAt: new Date(),
        })
        .where(eq(machineSettingsSets.id, parsed.data.id));

      // Only promotion is timeline-worthy; un-preferring has no event kind.
      if (parsed.data.isPreferred) {
        await emitSettingsSetEvent(
          loaded.machine.id,
          "settings_set_preferred",
          loaded.set.name,
          auth.userId,
          tx
        );
      }
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
