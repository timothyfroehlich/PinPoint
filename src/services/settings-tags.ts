import { and, eq, like, ne, or, sql } from "drizzle-orm";

import {
  getPostgresErrorConstraint,
  isPgErrorCode,
} from "~/lib/db/postgres-errors";
import { canManageSettingsTags } from "~/lib/permissions";
import { type Result, err, ok } from "~/lib/result";
import {
  slugifyTagName,
  TAG_SLUG_FALLBACK,
  tagNameSchema,
  uniqueSlug,
} from "~/lib/tags/names";
import { emitSettingsSetEvent } from "~/lib/timeline/machine-events";
import { db, type DbTransaction } from "~/server/db";
import {
  machineSettingsSetTags,
  machineSettingsSets,
  machines,
  settingsTags,
} from "~/server/db/schema";
import {
  ensureBuiltinSettingsTags,
  type SettingsActor,
  type SettingsWriteError,
} from "~/services/machine-settings";

/**
 * Settings tag writes (docs/feature-specs/machine-settings.md §3): create,
 * rename, and delete the tags people add beside the built-in House and
 * Tournament. Server Actions parse and call these; this layer owns the
 * `machines.settings.tags.manage` check, name uniqueness, and slugs.
 *
 * A tag's slug is set once from its name and survives a rename, so links to
 * its page keep working (there is no alias table). Applying a tag to a set is
 * `setSettingsSetTag` in `~/services/machine-settings`.
 */

export interface SettingsTagRow {
  id: string;
  slug: string;
  name: string;
}

const NAME_INDEX = "uq_settings_tags_name";

/** The name, normalized, or why it cannot be a tag name (§3.3). */
function parseName(
  raw: string
): { ok: true; name: string } | { ok: false; message: string } {
  const parsed = tagNameSchema.safeParse(raw);
  if (parsed.success) return { ok: true, name: parsed.data };
  return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid" };
}

export function settingsTagExistsMessage(name: string): string {
  return `“${name}” already exists`;
}

/** The tag already named `name`, ignoring capitalization (§3.3). */
async function tagNamed(
  tx: DbTransaction,
  name: string,
  exceptId?: string
): Promise<{ name: string } | undefined> {
  const [row] = await tx
    .select({ name: settingsTags.name })
    .from(settingsTags)
    .where(
      and(
        eq(sql`lower(${settingsTags.name})`, name.toLowerCase()),
        exceptId === undefined ? undefined : ne(settingsTags.id, exceptId)
      )
    );
  return row;
}

/** A unique violation on the name index: someone took the name first. */
function nameRace(error: unknown, name: string): Result<never, "conflict"> {
  if (
    isPgErrorCode(error, "23505") &&
    getPostgresErrorConstraint(error) === NAME_INDEX
  ) {
    return err("conflict", settingsTagExistsMessage(name));
  }
  throw error;
}

function refuseUnlessManager(
  actor: SettingsActor
): Result<never, "denied"> | null {
  return canManageSettingsTags(actor.access)
    ? null
    : err("denied", "Only technicians and admins can manage settings tags.");
}

/** Create a settings tag (§3.3). Its slug comes from its name. */
export async function createSettingsTag({
  actor,
  name: rawName,
}: {
  actor: SettingsActor;
  name: string;
}): Promise<Result<SettingsTagRow, SettingsWriteError>> {
  const refused = refuseUnlessManager(actor);
  if (refused) return refused;
  const parsed = parseName(rawName);
  if (!parsed.ok) return err("invalid", parsed.message);
  const { name } = parsed;

  try {
    return await db.transaction(async (tx) => {
      // House and Tournament hold their names and slugs even where the
      // database was built from the schema alone (§3.2).
      await ensureBuiltinSettingsTags(tx);
      const existing = await tagNamed(tx, name);
      if (existing) {
        return err("conflict", settingsTagExistsMessage(existing.name));
      }
      const base = slugifyTagName(name, TAG_SLUG_FALLBACK);
      const taken = await tx
        .select({ slug: settingsTags.slug })
        .from(settingsTags)
        .where(
          or(eq(settingsTags.slug, base), like(settingsTags.slug, `${base}-%`))
        );
      const slug = uniqueSlug(base, new Set(taken.map((row) => row.slug)));
      const [row] = await tx
        .insert(settingsTags)
        .values({ slug, name, createdBy: actor.userId })
        .returning({
          id: settingsTags.id,
          slug: settingsTags.slug,
          name: settingsTags.name,
        });
      if (!row) throw new Error("Could not create settings tag");
      return ok(row);
    });
  } catch (error) {
    // A concurrent create with the same slug is retried by the person; the
    // same name reads as taken.
    if (isPgErrorCode(error, "23505")) {
      if (getPostgresErrorConstraint(error) === NAME_INDEX) {
        return nameRace(error, name);
      }
      return err("conflict", "Settings tags changed. Try again.");
    }
    throw error;
  }
}

/** The tag's row, refusing House and Tournament (§3.2). */
async function loadCustomTag(
  tx: DbTransaction,
  tagId: string
): Promise<Result<SettingsTagRow, "not_found" | "invalid">> {
  const [row] = await tx
    .select({
      id: settingsTags.id,
      slug: settingsTags.slug,
      name: settingsTags.name,
      isBuiltin: settingsTags.isBuiltin,
    })
    .from(settingsTags)
    .where(eq(settingsTags.id, tagId))
    .for("update");
  if (!row) return err("not_found", "Settings tag not found");
  if (row.isBuiltin) {
    return err("invalid", `${row.name} is built in and can't be changed.`);
  }
  return ok({ id: row.id, slug: row.slug, name: row.name });
}

/** Rename a settings tag (§3.3). Its slug, and so its page, stay put. */
export async function renameSettingsTag({
  actor,
  tagId,
  name: rawName,
}: {
  actor: SettingsActor;
  tagId: string;
  name: string;
}): Promise<Result<SettingsTagRow, SettingsWriteError>> {
  const refused = refuseUnlessManager(actor);
  if (refused) return refused;
  const parsed = parseName(rawName);
  if (!parsed.ok) return err("invalid", parsed.message);
  const { name } = parsed;

  try {
    return await db.transaction(async (tx) => {
      const tag = await loadCustomTag(tx, tagId);
      if (!tag.ok) return tag;
      const existing = await tagNamed(tx, name, tagId);
      if (existing) {
        return err("conflict", settingsTagExistsMessage(existing.name));
      }
      if (tag.value.name === name) return ok(tag.value);
      await tx
        .update(settingsTags)
        .set({ name })
        .where(eq(settingsTags.id, tagId));
      return ok({ ...tag.value, name });
    });
  } catch (error) {
    return nameRace(error, name);
  }
}

export interface DeletedSettingsTag {
  slug: string;
  /** The machines whose sets lost the tag, for revalidation. */
  machineInitials: string[];
}

/**
 * Delete a settings tag (§3.3): it comes off every set, which otherwise stay
 * as they were. Each set records losing the tag (§5.1); nobody is notified
 * (§5.3).
 */
export async function deleteSettingsTag({
  actor,
  tagId,
}: {
  actor: SettingsActor;
  tagId: string;
}): Promise<Result<DeletedSettingsTag, SettingsWriteError>> {
  const refused = refuseUnlessManager(actor);
  if (refused) return refused;

  return await db.transaction(async (tx) => {
    const tag = await loadCustomTag(tx, tagId);
    if (!tag.ok) return tag;
    const carriers = await tx
      .select({
        setName: machineSettingsSets.name,
        machineId: machines.id,
        initials: machines.initials,
      })
      .from(machineSettingsSetTags)
      .innerJoin(
        machineSettingsSets,
        eq(machineSettingsSets.id, machineSettingsSetTags.setId)
      )
      .innerJoin(machines, eq(machines.id, machineSettingsSets.machineId))
      .where(eq(machineSettingsSetTags.tagId, tagId));
    for (const carrier of carriers) {
      await emitSettingsSetEvent(
        carrier.machineId,
        {
          kind: "settings_set_tagged",
          setName: carrier.setName,
          tagName: tag.value.name,
          added: false,
        },
        actor.userId,
        tx
      );
    }
    // Cascades: settings_tags → machine_settings_set_tags.
    await tx.delete(settingsTags).where(eq(settingsTags.id, tagId));
    return ok({
      slug: tag.value.slug,
      machineInitials: [...new Set(carriers.map((c) => c.initials))],
    });
  });
}
