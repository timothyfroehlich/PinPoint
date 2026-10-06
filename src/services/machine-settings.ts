import { Buffer } from "node:buffer";
import { isDeepStrictEqual } from "node:util";
import { and, eq, inArray } from "drizzle-orm";

import { isPgErrorCode } from "~/lib/db/postgres-errors";
import {
  canDeleteSet,
  canEditSet,
  canMakeCommunity,
  canManageMachineSettings,
  type SettingsSetAuth,
} from "~/lib/permissions";
import { type AccessLevel } from "~/lib/permissions/matrix";
import {
  BUILTIN_SETTINGS_TAG_NAMES,
  BUILTIN_SETTINGS_TAGS,
  NAME_MAX,
  type SettingsPreferredSlot,
  type SettingsSection,
  type SettingsSetPayload,
} from "~/lib/machines/settings-types";
import { type Result, err, ok } from "~/lib/result";
import { type ProseMirrorDoc } from "~/lib/tiptap/types";
import { emitSettingsSetEvent } from "~/lib/timeline/machine-events";
import { db, type DbTransaction } from "~/server/db";
import {
  machineSettingsSetTags,
  machineSettingsSets,
  machines,
  settingsTags,
} from "~/server/db/schema";

/**
 * Settings-set writes shared by the Settings tab's Server Actions and the MCP
 * tools. Callers authenticate and validate the payload shape
 * (`settingsSetPayloadSchema`); this layer owns authorization against
 * `~/lib/permissions/settings`, the writes, and the timeline events
 * (docs/feature-specs/machine-settings.md). Path revalidation stays with the
 * Server Actions.
 *
 * Only content writes bump a set's `updatedAt` — it is the version MCP callers
 * pass back — so tagging, preferring, and making a set community never make an
 * agent's held version stale.
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
  isCommunity: boolean;
  createdBy: string | null;
}): SettingsSetAuth {
  return { isCommunity: row.isCommunity, createdById: row.createdBy };
}

function preferredPatch(
  slot: SettingsPreferredSlot,
  value: boolean
): { isPreferredHouse: boolean } | { isPreferredTournament: boolean } {
  return slot === "house"
    ? { isPreferredHouse: value }
    : { isPreferredTournament: value };
}

/**
 * The built-in House and Tournament tags' ids (spec §3.2). Migration 0105
 * inserts them; this also creates them where a database was built from the
 * schema alone (the PGlite test schema), so callers never see them missing.
 */
export async function ensureBuiltinSettingsTags(
  tx: DbTransaction = db
): Promise<Record<SettingsPreferredSlot, string>> {
  await tx
    .insert(settingsTags)
    .values(
      BUILTIN_SETTINGS_TAGS.map((slug) => ({
        slug,
        name: BUILTIN_SETTINGS_TAG_NAMES[slug],
        isBuiltin: true,
      }))
    )
    .onConflictDoNothing({ target: settingsTags.slug });
  const rows = await tx
    .select({ id: settingsTags.id, slug: settingsTags.slug })
    .from(settingsTags)
    .where(inArray(settingsTags.slug, [...BUILTIN_SETTINGS_TAGS]));
  const house = rows.find((r) => r.slug === "house");
  const tournament = rows.find((r) => r.slug === "tournament");
  if (!house || !tournament) throw new Error("Built-in settings tags missing");
  return { house: house.id, tournament: tournament.id };
}

/** A rule refused the write inside its transaction; rolls the write back. */
class IneligibleError extends Error {}

/**
 * Lock a set's row for the rest of the transaction and read its preferred
 * flags. Tagging and preferring both take this lock, so "a preferred set keeps
 * its tag" (spec §4.2) can't be broken by the two racing each other.
 */
async function lockPreferredFlags(
  setId: string,
  tx: DbTransaction
): Promise<{ isPreferredHouse: boolean; isPreferredTournament: boolean }> {
  const [row] = await tx
    .select({
      isPreferredHouse: machineSettingsSets.isPreferredHouse,
      isPreferredTournament: machineSettingsSets.isPreferredTournament,
    })
    .from(machineSettingsSets)
    .where(eq(machineSettingsSets.id, setId))
    .for("update");
  if (!row) throw new IneligibleError("Settings set not found");
  return row;
}

/** Which built-in tags a set carries. */
async function builtinSlotsOf(
  setId: string,
  builtin: Record<SettingsPreferredSlot, string>,
  tx: DbTransaction = db
): Promise<Set<SettingsPreferredSlot>> {
  const rows = await tx
    .select({ tagId: machineSettingsSetTags.tagId })
    .from(machineSettingsSetTags)
    .where(eq(machineSettingsSetTags.setId, setId));
  const ids = new Set(rows.map((r) => r.tagId));
  return new Set(
    BUILTIN_SETTINGS_TAGS.filter((slot) => ids.has(builtin[slot]))
  );
}

interface LoadedSet {
  set: {
    id: string;
    machineId: string;
    name: string;
    description: ProseMirrorDoc | null;
    sections: SettingsSection[];
    isCommunity: boolean;
    isPreferredHouse: boolean;
    isPreferredTournament: boolean;
    createdBy: string | null;
    updatedAt: Date;
  };
  machine: { id: string; initials: string; ownerId: string | null };
}

async function loadSet(
  setId: string,
  expectedMachineId?: string
): Promise<LoadedSet | null> {
  const set = await db.query.machineSettingsSets.findFirst({
    where: eq(machineSettingsSets.id, setId),
    columns: {
      id: true,
      machineId: true,
      name: true,
      description: true,
      sections: true,
      isCommunity: true,
      isPreferredHouse: true,
      isPreferredTournament: true,
      createdBy: true,
      updatedAt: true,
    },
  });
  if (!set) return null;
  if (expectedMachineId !== undefined && set.machineId !== expectedMachineId) {
    return null;
  }
  const machine = await db.query.machines.findFirst({
    where: eq(machines.id, set.machineId),
    columns: { id: true, initials: true, ownerId: true },
  });
  if (!machine) return null;
  return { set: { ...set, description: set.description ?? null }, machine };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export interface CreateSettingsSetParams {
  machineId: string;
  actor: SettingsActor;
  payload: SettingsSetPayload;
  /** Built-in tags to start with. Omitted → House only (spec §2.1). */
  builtinTags?: readonly SettingsPreferredSlot[];
}

export interface CreatedSettingsSet {
  id: string;
  machineInitials: string;
  isCommunity: boolean;
  isPreferredHouse: boolean;
  builtinTags: SettingsPreferredSlot[];
}

/**
 * Create a settings set: a personal set of its creator (spec §2.1). When the
 * machine has no preferred House set and the new set carries House, it becomes
 * the preferred House set and so a community set (§4.4, §4.2).
 */
export async function createSettingsSet({
  machineId,
  actor,
  payload,
  builtinTags = ["house"],
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

  if (!canManageMachineSettings(machine.ownerId, actor.userId, actor.access)) {
    return err("denied", "Forbidden");
  }

  const tags = [...new Set(builtinTags)];
  const insertSet = (
    tryPreferred: boolean
  ): Promise<{ id: string; preferred: boolean }> =>
    db.transaction(async (tx) => {
      const builtin = await ensureBuiltinSettingsTags(tx);
      const preferred =
        tryPreferred &&
        tags.includes("house") &&
        !(await tx.query.machineSettingsSets.findFirst({
          where: and(
            eq(machineSettingsSets.machineId, machineId),
            eq(machineSettingsSets.isPreferredHouse, true)
          ),
          columns: { id: true },
        }));
      const [inserted] = await tx
        .insert(machineSettingsSets)
        .values({
          machineId,
          ...stored,
          isCommunity: preferred,
          isPreferredHouse: preferred,
          createdBy: actor.userId,
          updatedBy: actor.userId,
        })
        .returning({ id: machineSettingsSets.id });
      if (!inserted) throw new Error("Could not create settings set");
      if (tags.length > 0) {
        await tx.insert(machineSettingsSetTags).values(
          tags.map((slot) => ({
            setId: inserted.id,
            tagId: builtin[slot],
            addedBy: actor.userId,
          }))
        );
      }
      await emitSettingsSetEvent(
        machineId,
        { kind: "settings_set_created", setName: stored.name },
        actor.userId,
        tx
      );
      if (preferred) {
        await emitSettingsSetEvent(
          machineId,
          {
            kind: "settings_preferred_changed",
            setName: stored.name,
            slot: "house",
            action: "set",
          },
          actor.userId,
          tx
        );
      }
      return { id: inserted.id, preferred };
    });

  // Two concurrent first creates can both see no preferred House set; the loser
  // collides on uniq_machine_settings_preferred. A preferred set now exists, so
  // retry as an ordinary set rather than discarding the user's set.
  let created: { id: string; preferred: boolean };
  try {
    created = await insertSet(true);
  } catch (error) {
    if (!isPgErrorCode(error, "23505")) throw error;
    created = await insertSet(false);
  }

  return ok({
    id: created.id,
    machineInitials: machine.initials,
    isCommunity: created.preferred,
    isPreferredHouse: created.preferred,
    builtinTags: tags,
  });
}

// ---------------------------------------------------------------------------
// Update content / make community
// ---------------------------------------------------------------------------

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
  /** Turn a personal set into a community set (spec §2.4, one-way). */
  makeCommunity?: boolean;
}

export interface UpdatedSettingsSet {
  id: string;
  machineId: string;
  machineInitials: string;
  /** False when every supplied value already matched — nothing was written. */
  changed: boolean;
  contentChanged: boolean;
  isCommunity: boolean;
}

/**
 * Update a set's content and/or make it a community set, in one transaction.
 * Content needs edit rights (§2.2–§2.3); making it community needs its author
 * (§2.4). Values that already match are skipped; an all-no-op call writes
 * nothing.
 */
export async function updateSettingsSet({
  setId,
  actor,
  expectedMachineId,
  expectedUpdatedAt,
  payload,
  makeCommunity,
}: UpdateSettingsSetParams): Promise<
  Result<UpdatedSettingsSet, SettingsWriteError>
> {
  const stored = payload ? toStored(payload) : undefined;
  if (stored && exceedsByteCeiling(stored)) {
    return err("invalid", "Settings are too large to save.");
  }

  const loaded = await loadSet(setId, expectedMachineId);
  if (!loaded) return err("not_found", "Settings set not found");
  const { set, machine } = loaded;
  const auth = toSettingsSetAuth(set);

  if (
    stored !== undefined &&
    !canEditSet(auth, machine.ownerId, actor.userId, actor.access)
  ) {
    return err(
      "denied",
      set.isCommunity
        ? "Only technicians, the machine owner, and admins can edit a community set."
        : "Only its author can edit a personal set."
    );
  }
  const communityChanged = makeCommunity === true && !set.isCommunity;
  if (communityChanged && !canMakeCommunity(auth, actor.userId, actor.access)) {
    return err("denied", "Only its author can make a personal set community.");
  }

  if (
    expectedUpdatedAt !== undefined &&
    set.updatedAt.getTime() !== expectedUpdatedAt.getTime()
  ) {
    return err(
      "conflict",
      "The set changed since it was read. Read it again and reapply the change."
    );
  }

  // Both sides are `_key`-free (Zod stripped the input; the column never
  // stored it), so a structural deep-equal is exact.
  const contentChanged =
    stored !== undefined &&
    !isDeepStrictEqual(
      {
        name: set.name,
        description: set.description,
        sections: set.sections,
      },
      {
        name: stored.name,
        description: stored.description ?? null,
        sections: stored.sections,
      }
    );
  const changed = contentChanged || communityChanged;

  if (changed) {
    await db.transaction(async (tx) => {
      await tx
        .update(machineSettingsSets)
        .set({
          ...(contentChanged
            ? { ...stored, updatedBy: actor.userId, updatedAt: new Date() }
            : {}),
          ...(communityChanged ? { isCommunity: true } : {}),
        })
        .where(eq(machineSettingsSets.id, setId));
      const setName = contentChanged ? stored.name : set.name;
      if (contentChanged) {
        await emitSettingsSetEvent(
          machine.id,
          { kind: "settings_set_updated", setName },
          actor.userId,
          tx
        );
      }
      if (communityChanged) {
        await emitSettingsSetEvent(
          machine.id,
          { kind: "settings_set_made_community", setName },
          actor.userId,
          tx
        );
      }
    });
  }

  return ok({
    id: set.id,
    machineId: machine.id,
    machineInitials: machine.initials,
    changed,
    contentChanged,
    isCommunity: set.isCommunity || communityChanged,
  });
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export interface SetSettingsSetTagParams {
  setId: string;
  actor: SettingsActor;
  /** A built-in tag's slot (custom tags arrive with PP-k3km.2). */
  tag: SettingsPreferredSlot;
  applied: boolean;
}

export interface SettingsSetRef {
  id: string;
  machineId: string;
  machineInitials: string;
  changed: boolean;
}

/**
 * Apply or remove a settings tag (spec §3.4). A preferred set keeps its slot's
 * tag until it stops being preferred (§4.2).
 */
export async function setSettingsSetTag({
  setId,
  actor,
  tag,
  applied,
}: SetSettingsSetTagParams): Promise<
  Result<SettingsSetRef, SettingsWriteError>
> {
  const loaded = await loadSet(setId);
  if (!loaded) return err("not_found", "Settings set not found");
  const { set, machine } = loaded;
  if (!canManageMachineSettings(machine.ownerId, actor.userId, actor.access)) {
    return err("denied", "Forbidden");
  }
  let changed: boolean;
  try {
    changed = await db.transaction(async (tx) => {
      if (!applied) {
        const flags = await lockPreferredFlags(setId, tx);
        const isPreferredInSlot =
          tag === "house"
            ? flags.isPreferredHouse
            : flags.isPreferredTournament;
        if (isPreferredInSlot) {
          throw new IneligibleError(
            `Unset the preferred ${BUILTIN_SETTINGS_TAG_NAMES[tag]} set before removing its tag.`
          );
        }
      }
      const builtin = await ensureBuiltinSettingsTags(tx);
      const tagId = builtin[tag];
      const rows = applied
        ? await tx
            .insert(machineSettingsSetTags)
            .values({ setId, tagId, addedBy: actor.userId })
            .onConflictDoNothing()
            .returning({ setId: machineSettingsSetTags.setId })
        : await tx
            .delete(machineSettingsSetTags)
            .where(
              and(
                eq(machineSettingsSetTags.setId, setId),
                eq(machineSettingsSetTags.tagId, tagId)
              )
            )
            .returning({ setId: machineSettingsSetTags.setId });
      if (rows.length === 0) return false;
      await emitSettingsSetEvent(
        machine.id,
        {
          kind: "settings_set_tagged",
          setName: set.name,
          tagName: BUILTIN_SETTINGS_TAG_NAMES[tag],
          added: applied,
        },
        actor.userId,
        tx
      );
      return true;
    });
  } catch (error) {
    if (error instanceof IneligibleError) return err("invalid", error.message);
    throw error;
  }

  return ok({
    id: set.id,
    machineId: machine.id,
    machineInitials: machine.initials,
    changed,
  });
}

// ---------------------------------------------------------------------------
// Preferred sets
// ---------------------------------------------------------------------------

export interface SetPreferredSettingsSetParams {
  setId: string;
  actor: SettingsActor;
  slot: SettingsPreferredSlot;
  preferred: boolean;
}

/**
 * Make a set the machine's preferred House or Tournament set, or clear it
 * (spec §4.2–§4.3). Only a set carrying the slot's tag is eligible; a personal
 * set becomes a community set as it is made preferred. The previous holder is
 * cleared in the same transaction (the partial unique index is the backstop).
 */
export async function setPreferredSettingsSet({
  setId,
  actor,
  slot,
  preferred,
}: SetPreferredSettingsSetParams): Promise<
  Result<SettingsSetRef, SettingsWriteError>
> {
  const loaded = await loadSet(setId);
  if (!loaded) return err("not_found", "Settings set not found");
  const { set, machine } = loaded;
  if (!canManageMachineSettings(machine.ownerId, actor.userId, actor.access)) {
    return err("denied", "Forbidden");
  }
  const slotName = BUILTIN_SETTINGS_TAG_NAMES[slot];
  const current =
    slot === "house" ? set.isPreferredHouse : set.isPreferredTournament;
  if (current === preferred) {
    return ok({
      id: set.id,
      machineId: machine.id,
      machineInitials: machine.initials,
      changed: false,
    });
  }

  try {
    await db.transaction(async (tx) => {
      if (preferred) {
        await lockPreferredFlags(setId, tx);
        const builtin = await ensureBuiltinSettingsTags(tx);
        const slots = await builtinSlotsOf(setId, builtin, tx);
        if (!slots.has(slot)) {
          throw new IneligibleError(
            `Only a set tagged ${slotName} can be the preferred ${slotName} set.`
          );
        }
        await tx
          .update(machineSettingsSets)
          .set(preferredPatch(slot, false))
          .where(
            and(
              eq(machineSettingsSets.machineId, machine.id),
              eq(
                slot === "house"
                  ? machineSettingsSets.isPreferredHouse
                  : machineSettingsSets.isPreferredTournament,
                true
              )
            )
          );
      }
      await tx
        .update(machineSettingsSets)
        .set({
          ...preferredPatch(slot, preferred),
          ...(preferred ? { isCommunity: true } : {}),
        })
        .where(eq(machineSettingsSets.id, setId));
      if (preferred && !set.isCommunity) {
        await emitSettingsSetEvent(
          machine.id,
          { kind: "settings_set_made_community", setName: set.name },
          actor.userId,
          tx
        );
      }
      await emitSettingsSetEvent(
        machine.id,
        {
          kind: "settings_preferred_changed",
          setName: set.name,
          slot,
          action: preferred ? "set" : "cleared",
        },
        actor.userId,
        tx
      );
    });
  } catch (error) {
    if (error instanceof IneligibleError) return err("invalid", error.message);
    // Two callers promoting different sets concurrently can collide on the
    // slot's partial unique index.
    if (isPgErrorCode(error, "23505")) {
      return err(
        "conflict",
        `Another set was just made the preferred ${slotName} set. Please try again.`
      );
    }
    throw error;
  }

  return ok({
    id: set.id,
    machineId: machine.id,
    machineInitials: machine.initials,
    changed: true,
  });
}

// ---------------------------------------------------------------------------
// Delete / duplicate
// ---------------------------------------------------------------------------

/** Delete a set (spec §2.2–§2.3). A preferred slot it held is left empty (§4.5). */
export async function deleteSettingsSet({
  setId,
  actor,
}: {
  setId: string;
  actor: SettingsActor;
}): Promise<Result<SettingsSetRef, SettingsWriteError>> {
  const loaded = await loadSet(setId);
  if (!loaded) return err("not_found", "Settings set not found");
  const { set, machine } = loaded;
  if (
    !canDeleteSet(
      toSettingsSetAuth(set),
      machine.ownerId,
      actor.userId,
      actor.access
    )
  ) {
    return err("denied", "Forbidden");
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(machineSettingsSets)
      .where(eq(machineSettingsSets.id, setId));
    await emitSettingsSetEvent(
      machine.id,
      { kind: "settings_set_deleted", setName: set.name },
      actor.userId,
      tx
    );
  });

  return ok({
    id: set.id,
    machineId: machine.id,
    machineInitials: machine.initials,
    changed: true,
  });
}

/**
 * Duplicate a set: the copy is a personal set of the duplicator with the same
 * tags, never preferred (spec §4.5). Needs create rights on the machine.
 */
export async function duplicateSettingsSet({
  setId,
  actor,
}: {
  setId: string;
  actor: SettingsActor;
}): Promise<Result<SettingsSetRef, SettingsWriteError>> {
  const loaded = await loadSet(setId);
  if (!loaded) return err("not_found", "Settings set not found");
  const { set, machine } = loaded;
  if (!canManageMachineSettings(machine.ownerId, actor.userId, actor.access)) {
    return err("denied", "Forbidden");
  }

  // Cap the copy name so a long original (up to NAME_MAX) plus the " (copy)"
  // suffix can't exceed NAME_MAX — otherwise the duplicate would persist but
  // fail the save schema on any later edit.
  const COPY_SUFFIX = " (copy)";
  const copyName = `${set.name.slice(0, NAME_MAX - COPY_SUFFIX.length)}${COPY_SUFFIX}`;

  const newId = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(machineSettingsSets)
      .values({
        machineId: machine.id,
        name: copyName,
        description: set.description,
        sections: set.sections,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      })
      .returning({ id: machineSettingsSets.id });
    if (!inserted) throw new Error("Could not duplicate set");
    const tagRows = await tx
      .select({ tagId: machineSettingsSetTags.tagId })
      .from(machineSettingsSetTags)
      .where(eq(machineSettingsSetTags.setId, setId));
    if (tagRows.length > 0) {
      await tx.insert(machineSettingsSetTags).values(
        tagRows.map((r) => ({
          setId: inserted.id,
          tagId: r.tagId,
          addedBy: actor.userId,
        }))
      );
    }
    await emitSettingsSetEvent(
      machine.id,
      { kind: "settings_set_created", setName: copyName },
      actor.userId,
      tx
    );
    return inserted.id;
  });

  return ok({
    id: newId,
    machineId: machine.id,
    machineInitials: machine.initials,
    changed: true,
  });
}
