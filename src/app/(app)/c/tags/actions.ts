/**
 * Hand-applied tag Server Actions (spec collections-and-tags §11, PP-wqit.3).
 *
 * Two matrix permissions gate them:
 * - `tags.manage` (technicians, admins): create, rename, and delete tag types
 *   and tags, change a tag type's exclusivity, move a tag between tag types,
 *   merge one tag into another, and set a tag's machines from its page
 *   (11.1–11.3, 11.7–11.9, 11.11, 11.16–11.17).
 * - `tags.apply` (machine owners on their machines, technicians, admins): put
 *   one tag on one machine or take it off, as a machine's page does (11.4).
 *
 * Exclusive tag types (11.5) are enforced by a partial unique index; applying
 * a tag removes the machine's other tag of that type in the same transaction.
 * Transactions hold only database work (CORE-ARCH-011). No timeline events
 * are written for tagging (Tim, 2026-10-02).
 */

"use server";

import { and, asc, eq, inArray, like, ne, or, type SQL } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { createProtectedAction } from "~/lib/actions";
import {
  getPostgresErrorConstraint,
  isPgErrorCode,
} from "~/lib/db/postgres-errors";
import { serverActionError } from "~/lib/observability/report-error";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import type { AccessLevel } from "~/lib/permissions/matrix";
import { err, ok, type Result } from "~/lib/result";
import { createClient } from "~/lib/supabase/server";
import {
  slugifyTagName,
  TAG_SLUG_FALLBACK,
  TAG_TYPE_SLUG_FALLBACK,
  uniqueSlug,
} from "~/lib/tags/names";
import {
  exclusiveConflicts,
  mergeConflicts,
  moveConflicts,
  typesWithTagName,
} from "~/lib/tags/conflicts";
import {
  nameTakenMessage,
  tooManyTagsMessage,
  wouldHoldTwoMessage,
} from "~/lib/tags/messages";
import { handTagHref, handTagTypeHref } from "~/lib/tags/types";
import { db, type DbTransaction } from "~/server/db";
import {
  machines,
  machineTags,
  tags,
  tagSlugAliases,
  tagTypes,
  userProfiles,
} from "~/server/db/schema";
import {
  createTagSchema,
  createTagTypeSchema,
  deleteTagSchema,
  deleteTagTypeSchema,
  mergeTagSchema,
  moveTagSchema,
  renameTagSchema,
  renameTagTypeSchema,
  setMachineTagSchema,
  setTagMachinesSchema,
  setTagTypeExclusiveSchema,
  type TagActionCode,
  type TagActionResult,
  type TagConflictResult,
} from "./schemas";

interface Actor {
  userId: string | undefined;
  access: AccessLevel;
}

async function resolveActor(): Promise<Actor> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { userId: undefined, access: "unauthenticated" };
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { role: true },
  });
  return { userId: user.id, access: getAccessLevel(profile?.role) };
}

function denied(actor: Actor): TagActionResult<never> {
  return actor.userId === undefined
    ? err("UNAUTHORIZED", "Sign in required")
    : err("FORBIDDEN", "Not allowed");
}

/** The actor when they may manage tags (`tags.manage`), else the refusal. */
async function requireManager(): Promise<
  { ok: true; actor: Actor } | { ok: false; result: TagActionResult<never> }
> {
  const actor = await resolveActor();
  if (!checkPermission("tags.manage", actor.access)) {
    return { ok: false, result: denied(actor) };
  }
  return { ok: true, actor };
}

function invalid(error: {
  issues: readonly { message: string }[];
}): TagActionResult<never> {
  return err("VALIDATION", error.issues[0]?.message ?? "Invalid input");
}

const NAME_CONSTRAINTS = new Set(["uq_tag_types_name", "uq_tags_type_name"]);

/**
 * A unique or foreign-key violation means someone else's write raced this
 * one, or the name is taken (11.2–11.3). Anything else is a real failure.
 */
function writeFailure(error: unknown, action: string): TagActionResult<never> {
  if (isPgErrorCode(error, "23505")) {
    const constraint = getPostgresErrorConstraint(error);
    if (constraint !== undefined && NAME_CONSTRAINTS.has(constraint)) {
      return err("CONFLICT", "Name already used");
    }
    return err("CONFLICT", "Tags changed elsewhere. Try again.");
  }
  if (isPgErrorCode(error, "23503")) {
    return err("CONFLICT", "Tags changed elsewhere. Try again.");
  }
  return serverActionError(error, "SERVER", "Could not save. Try again.", {
    action,
  });
}

/** Tag pages, tag type pages, the browse, and each affected machine's page. */
function revalidateTags(machineInitials: Iterable<string> = []): void {
  revalidatePath("/c/tags");
  // Route patterns name their route groups, or they match no route.
  revalidatePath("/(app)/c/tags/[type]", "page");
  revalidatePath("/(app)/c/tags/[type]/[slug]/(tabs)", "layout");
  for (const initials of new Set(machineInitials)) {
    revalidatePath(`/m/${initials}`);
  }
}

/**
 * Slugs already taken in `table` that `base` or `base-N` would collide with.
 * A new tag also avoids the slugs of merged tags, which lead to the tags they
 * were merged into (spec 11.19).
 */
async function takenSlugs(
  tx: DbTransaction,
  table: typeof tags | typeof tagTypes | typeof tagSlugAliases,
  base: string
): Promise<Set<string>> {
  const rows = await tx
    .select({ slug: table.slug })
    .from(table)
    .where(or(eq(table.slug, base), like(table.slug, `${base}-%`)));
  return new Set(rows.map((row) => row.slug));
}

/** Initials of the machines holding any tag of a type, or one tag. */
async function initialsTagged(
  tx: DbTransaction,
  where: SQL
): Promise<string[]> {
  const rows = await tx
    .selectDistinct({ initials: machines.initials })
    .from(machineTags)
    .innerJoin(machines, eq(machines.id, machineTags.machineId))
    .where(where);
  return rows.map((row) => row.initials);
}

// --- Tag types ---------------------------------------------------------------

/** Create a hand-applied tag type (spec 11.1–11.2). */
export async function createTagTypeAction(input: {
  name: string;
  exclusive: boolean;
}): Promise<TagActionResult<{ id: string; href: string }>> {
  const gate = await requireManager();
  if (!gate.ok) return gate.result;
  const parsed = createTagTypeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { name, exclusive } = parsed.data;

  try {
    const created = await db.transaction(async (tx) => {
      const base = slugifyTagName(name, TAG_TYPE_SLUG_FALLBACK);
      const slug = uniqueSlug(base, await takenSlugs(tx, tagTypes, base));
      const [row] = await tx
        .insert(tagTypes)
        .values({ name, slug, exclusive })
        .returning({ id: tagTypes.id, slug: tagTypes.slug });
      return row;
    });
    if (!created) return err("SERVER", "Could not save. Try again.");
    revalidateTags();
    return ok({ id: created.id, href: handTagTypeHref(created.slug) });
  } catch (error) {
    return writeFailure(error, "createTagTypeAction");
  }
}

/** Rename a hand-applied tag type; its slug and page stay put (spec 11.8). */
export async function renameTagTypeAction(input: {
  tagTypeId: string;
  name: string;
}): Promise<TagActionResult> {
  const gate = await requireManager();
  if (!gate.ok) return gate.result;
  const parsed = renameTagTypeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  try {
    const [row] = await db
      .update(tagTypes)
      .set({ name: parsed.data.name })
      .where(eq(tagTypes.id, parsed.data.tagTypeId))
      .returning({ id: tagTypes.id });
    if (!row) return err("NOT_FOUND", "Tag type not found");
  } catch (error) {
    return writeFailure(error, "renameTagTypeAction");
  }
  revalidateTags();
  return ok(undefined);
}

/**
 * Delete a hand-applied tag type and its tags, which takes them off every
 * machine (spec 11.9). The machines are otherwise untouched.
 */
export async function deleteTagTypeAction(input: {
  tagTypeId: string;
}): Promise<TagActionResult> {
  const gate = await requireManager();
  if (!gate.ok) return gate.result;
  const parsed = deleteTagTypeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { tagTypeId } = parsed.data;

  let affected: string[];
  try {
    const result = await db.transaction(async (tx) => {
      const initials = await initialsTagged(
        tx,
        eq(machineTags.tagTypeId, tagTypeId)
      );
      // Cascades: tag_types → tags → machine_tags.
      const deleted = await tx
        .delete(tagTypes)
        .where(eq(tagTypes.id, tagTypeId))
        .returning({ id: tagTypes.id });
      return deleted.length === 0 ? null : initials;
    });
    if (result === null) return err("NOT_FOUND", "Tag type not found");
    affected = result;
  } catch (error) {
    return writeFailure(error, "deleteTagTypeAction");
  }
  revalidateTags(affected);
  return ok(undefined);
}

/**
 * Make a hand-applied tag type exclusive, or not (spec 11.7). Making it
 * exclusive is refused, with the machines in the way, while any machine holds
 * more than one of its tags; making it non-exclusive always succeeds and
 * leaves every machine's tags as they are.
 *
 * The flag cascades through the composite foreign keys to each tag and each
 * machine's membership row, so the partial unique index on memberships is the
 * backstop if a concurrent write slips a second tag on after the check.
 */
export async function setTagTypeExclusiveAction(input: {
  tagTypeId: string;
  exclusive: boolean;
}): Promise<TagConflictResult> {
  const gate = await requireManager();
  if (!gate.ok) return gate.result;
  const parsed = setTagTypeExclusiveSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { tagTypeId, exclusive } = parsed.data;

  let outcome: TagConflictResult<string[]>;
  try {
    outcome = await db.transaction(
      async (tx): Promise<TagConflictResult<string[]>> => {
        const [type] = await tx
          .select({ name: tagTypes.name, exclusive: tagTypes.exclusive })
          .from(tagTypes)
          .where(eq(tagTypes.id, tagTypeId))
          .for("update");
        if (!type) return err("NOT_FOUND", "Tag type not found");
        if (type.exclusive === exclusive) return ok([]);
        if (exclusive) {
          const conflicts = await exclusiveConflicts(tx, tagTypeId);
          if (conflicts.length > 0) {
            return err(
              "CONFLICT",
              tooManyTagsMessage(type.name, conflicts.length),
              { machines: conflicts }
            );
          }
        }
        // Cascades: tag_types → tags → machine_tags.
        await tx
          .update(tagTypes)
          .set({ exclusive })
          .where(eq(tagTypes.id, tagTypeId));
        return ok(
          await initialsTagged(tx, eq(machineTags.tagTypeId, tagTypeId))
        );
      }
    );
  } catch (error) {
    return writeFailure(error, "setTagTypeExclusiveAction");
  }
  if (!outcome.ok) return outcome;
  revalidateTags(outcome.value);
  return ok(undefined);
}

// --- Tags --------------------------------------------------------------------

/**
 * Create a hand-applied tag in a hand-applied tag type or with none (spec
 * 11.3). Automatic tag types have no row, so no tag can join one.
 */
export async function createTagAction(input: {
  name: string;
  tagTypeId: string | null;
}): Promise<TagActionResult<{ id: string; href: string }>> {
  const gate = await requireManager();
  if (!gate.ok) return gate.result;
  const parsed = createTagSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { name, tagTypeId } = parsed.data;

  try {
    const created = await db.transaction(async (tx) => {
      let type: { slug: string; exclusive: boolean } | null = null;
      if (tagTypeId !== null) {
        const [row] = await tx
          .select({ slug: tagTypes.slug, exclusive: tagTypes.exclusive })
          .from(tagTypes)
          .where(eq(tagTypes.id, tagTypeId));
        if (!row) return null;
        type = row;
      }
      const base = slugifyTagName(name, TAG_SLUG_FALLBACK);
      const taken = new Set([
        ...(await takenSlugs(tx, tags, base)),
        ...(await takenSlugs(tx, tagSlugAliases, base)),
      ]);
      const slug = uniqueSlug(base, taken);
      const [row] = await tx
        .insert(tags)
        .values({
          name,
          slug,
          tagTypeId,
          typeExclusive: type?.exclusive ?? false,
        })
        .returning({ id: tags.id, slug: tags.slug });
      return row ? { ...row, typeSlug: type?.slug ?? null } : null;
    });
    if (!created) return err("NOT_FOUND", "Tag type not found");
    revalidateTags();
    return ok({
      id: created.id,
      href: handTagHref(created.typeSlug, created.slug),
    });
  } catch (error) {
    return writeFailure(error, "createTagAction");
  }
}

/** Rename a hand-applied tag; its slug and page stay put (spec 11.8). */
export async function renameTagAction(input: {
  tagId: string;
  name: string;
}): Promise<TagActionResult> {
  const gate = await requireManager();
  if (!gate.ok) return gate.result;
  const parsed = renameTagSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  let affected: string[];
  try {
    const result = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(tags)
        .set({ name: parsed.data.name })
        .where(eq(tags.id, parsed.data.tagId))
        .returning({ id: tags.id });
      if (!row) return null;
      return initialsTagged(tx, eq(machineTags.tagId, row.id));
    });
    if (result === null) return err("NOT_FOUND", "Tag not found");
    affected = result;
  } catch (error) {
    return writeFailure(error, "renameTagAction");
  }
  revalidateTags(affected);
  return ok(undefined);
}

/** Delete a hand-applied tag, taking it off every machine (spec 11.9). */
export async function deleteTagAction(input: {
  tagId: string;
}): Promise<TagActionResult> {
  const gate = await requireManager();
  if (!gate.ok) return gate.result;
  const parsed = deleteTagSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { tagId } = parsed.data;

  let affected: string[];
  try {
    const result = await db.transaction(async (tx) => {
      const initials = await initialsTagged(tx, eq(machineTags.tagId, tagId));
      const deleted = await tx
        .delete(tags)
        .where(eq(tags.id, tagId))
        .returning({ id: tags.id });
      return deleted.length === 0 ? null : initials;
    });
    if (result === null) return err("NOT_FOUND", "Tag not found");
    affected = result;
  } catch (error) {
    return writeFailure(error, "deleteTagAction");
  }
  revalidateTags(affected);
  return ok(undefined);
}

/**
 * Move a hand-applied tag into a hand-applied tag type, to another, or out of
 * its tag type (spec 11.16). Refused when another tag where it is going has
 * its name, or, going into an exclusive tag type, when a machine holding it
 * already holds a tag of that type; the second refusal lists the machines.
 * Its slug is unique on its own, so only the type segment of its page moves;
 * the old address redirects to the returned one.
 */
export async function moveTagAction(input: {
  tagId: string;
  tagTypeId: string | null;
}): Promise<TagConflictResult<{ href: string }>> {
  const gate = await requireManager();
  if (!gate.ok) return gate.result;
  const parsed = moveTagSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { tagId, tagTypeId } = parsed.data;

  type Moved = TagConflictResult<{ href: string; initials: string[] }>;
  let outcome: Moved;
  try {
    outcome = await db.transaction(async (tx): Promise<Moved> => {
      // Locked so no membership copies the old type columns meanwhile (see
      // loadTag, which takes the matching share lock).
      const [tag] = await tx
        .select({
          name: tags.name,
          slug: tags.slug,
          tagTypeId: tags.tagTypeId,
        })
        .from(tags)
        .where(eq(tags.id, tagId))
        .for("update");
      if (!tag) return err("NOT_FOUND", "Tag not found");
      if (tag.tagTypeId === tagTypeId) {
        return err("VALIDATION", "Tag is already there");
      }

      let type: { slug: string; name: string; exclusive: boolean } | null =
        null;
      if (tagTypeId !== null) {
        // Shared, so the type's exclusivity cannot change under the move.
        const [row] = await tx
          .select({
            slug: tagTypes.slug,
            name: tagTypes.name,
            exclusive: tagTypes.exclusive,
          })
          .from(tagTypes)
          .where(eq(tagTypes.id, tagTypeId))
          .for("share");
        if (!row) return err("NOT_FOUND", "Tag type not found");
        type = row;
      }

      if ((await typesWithTagName(tx, tagId)).has(tagTypeId)) {
        return err("CONFLICT", nameTakenMessage(type?.name ?? null, tag.name));
      }
      if (type?.exclusive && tagTypeId !== null) {
        const conflicts = (await moveConflicts(tx, tagId)).get(tagTypeId);
        if (conflicts !== undefined && conflicts.length > 0) {
          return err(
            "CONFLICT",
            wouldHoldTwoMessage(type.name, conflicts.length),
            { machines: conflicts }
          );
        }
      }

      const columns = { tagTypeId, typeExclusive: type?.exclusive ?? false };
      await tx.update(tags).set(columns).where(eq(tags.id, tagId));
      // A typed tag's memberships follow it through ON UPDATE CASCADE, but a
      // membership of a tag with no type has a null in its foreign key, which
      // MATCH SIMPLE never checks or cascades to. Set every row explicitly.
      await tx
        .update(machineTags)
        .set(columns)
        .where(eq(machineTags.tagId, tagId));
      return ok({
        href: handTagHref(type?.slug ?? null, tag.slug),
        initials: await initialsTagged(tx, eq(machineTags.tagId, tagId)),
      });
    });
  } catch (error) {
    return writeFailure(error, "moveTagAction");
  }
  if (!outcome.ok) return outcome;
  revalidateTags(outcome.value.initials);
  return ok({ href: outcome.value.href });
}

type Merged = Result<{ href: string; initials: string[] }, TagActionCode>;

const mergeTagProtected = createProtectedAction({
  actionName: "mergeTagAction",
  schema: mergeTagSchema,
  permission: "tags.manage",
  forbiddenMessage: "Not allowed",
  handler: async ({
    tagId,
    targetTagId,
  }): Promise<TagActionResult<{ href: string }>> => {
    let outcome: Merged;
    try {
      outcome = await db.transaction(async (tx): Promise<Merged> => {
        // The source is deleted and the target must keep its type (see
        // loadTag). Locked in id order, so opposite merges cannot deadlock.
        const locked = await tx
          .select({
            id: tags.id,
            slug: tags.slug,
            name: tags.name,
            tagTypeId: tags.tagTypeId,
            typeExclusive: tags.typeExclusive,
          })
          .from(tags)
          .where(inArray(tags.id, [tagId, targetTagId]))
          .orderBy(asc(tags.id))
          .for("update");
        const source = locked.find((row) => row.id === tagId);
        const target = locked.find((row) => row.id === targetTagId);
        if (!source || !target) return err("NOT_FOUND", "Tag not found");

        let typeSlug: string | null = null;
        if (target.tagTypeId !== null) {
          // Shared, so the type's exclusivity cannot change under the merge.
          const [type] = await tx
            .select({ slug: tagTypes.slug, name: tagTypes.name })
            .from(tagTypes)
            .where(eq(tagTypes.id, target.tagTypeId))
            .for("share");
          if (!type) return err("NOT_FOUND", "Tag type not found");
          typeSlug = type.slug;
          if (target.typeExclusive) {
            const conflicts = mergeConflicts(await moveConflicts(tx, tagId), {
              typeId: target.tagTypeId,
              name: target.name,
            });
            if (conflicts.length > 0) {
              return err(
                "CONFLICT",
                wouldHoldTwoMessage(type.name, conflicts.length)
              );
            }
          }
        }

        const holders = await tx
          .select({
            machineId: machineTags.machineId,
            addedAt: machineTags.addedAt,
            addedBy: machineTags.addedBy,
            initials: machines.initials,
          })
          .from(machineTags)
          .innerJoin(machines, eq(machines.id, machineTags.machineId))
          .where(eq(machineTags.tagId, tagId));

        // Links that led to the source lead to the target now (11.19). The
        // repoint runs first: deleting the source cascades to its aliases.
        await tx
          .update(tagSlugAliases)
          .set({ tagId: targetTagId })
          .where(eq(tagSlugAliases.tagId, tagId));
        // Cascades: tags → machine_tags, which frees a machine's one tag of
        // an exclusive type when the target shares the source's type.
        await tx.delete(tags).where(eq(tags.id, tagId));
        await tx
          .insert(tagSlugAliases)
          .values({ slug: source.slug, tagId: targetTagId });
        if (holders.length > 0) {
          // Machines already holding the target keep their row. Any other
          // unique violation is a concurrent write and fails the merge.
          await tx
            .insert(machineTags)
            .values(
              holders.map((holder) => ({
                machineId: holder.machineId,
                tagId: targetTagId,
                tagTypeId: target.tagTypeId,
                typeExclusive: target.typeExclusive,
                addedAt: holder.addedAt,
                addedBy: holder.addedBy,
              }))
            )
            .onConflictDoNothing({
              target: [machineTags.machineId, machineTags.tagId],
            });
        }
        return ok({
          href: handTagHref(typeSlug, target.slug),
          initials: holders.map((holder) => holder.initials),
        });
      });
    } catch (error) {
      return writeFailure(error, "mergeTagAction");
    }
    if (!outcome.ok) return outcome;
    revalidateTags(outcome.value.initials);
    return ok({ href: outcome.value.href });
  },
});

/**
 * Merge a hand-applied tag into another, in any tag type or none (spec
 * 11.17): every machine holding it holds the target afterward, and it is
 * deleted. Refused when a machine would hold two tags of the target's
 * exclusive tag type (11.18). Its slug then leads to the target's page
 * (11.19), as do the slugs of tags merged into it earlier.
 */
export async function mergeTagAction(input: {
  tagId: string;
  targetTagId: string;
}): Promise<TagActionResult<{ href: string }>> {
  return await mergeTagProtected(input);
}

// --- Machines on a tag -------------------------------------------------------

interface TagKey {
  id: string;
  tagTypeId: string | null;
  typeExclusive: boolean;
}

/**
 * The tag's type columns, locked until the transaction ends. A membership row
 * copies them, and the composite foreign key cannot check a copy whose
 * `tag_type_id` is null, so the tag must not change type in between.
 */
async function loadTag(
  tx: DbTransaction,
  tagId: string
): Promise<TagKey | null> {
  const [row] = await tx
    .select({
      id: tags.id,
      tagTypeId: tags.tagTypeId,
      typeExclusive: tags.typeExclusive,
    })
    .from(tags)
    .where(eq(tags.id, tagId))
    .for("share");
  return row ?? null;
}

/**
 * In an exclusive tag type, take each machine's other tag of that type off
 * before `tag` goes on (spec 11.5). Returns nothing; the partial unique index
 * is the backstop if a concurrent write slips in.
 */
async function clearExclusiveSiblings(
  tx: DbTransaction,
  tag: TagKey,
  machineIds: readonly string[]
): Promise<void> {
  if (!tag.typeExclusive || tag.tagTypeId === null || machineIds.length === 0)
    return;
  await tx
    .delete(machineTags)
    .where(
      and(
        inArray(machineTags.machineId, [...machineIds]),
        eq(machineTags.tagTypeId, tag.tagTypeId),
        eq(machineTags.typeExclusive, true),
        ne(machineTags.tagId, tag.id)
      )
    );
}

/**
 * Give a tag exactly `machineIds`, from the tag page's Edit machines dialog
 * (spec 11.11). Machines left out lose the tag; machines added gain it, and
 * in an exclusive type lose their other tag of that type (11.5).
 */
export async function setTagMachinesAction(input: {
  tagId: string;
  machineIds: string[];
}): Promise<TagActionResult<{ added: number; removed: number }>> {
  const gate = await requireManager();
  if (!gate.ok) return gate.result;
  const parsed = setTagMachinesSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { tagId } = parsed.data;
  const desired = [...new Set(parsed.data.machineIds)];

  // Reject ids that are not machines; silently dropping them would hide bugs.
  const desiredRows =
    desired.length === 0
      ? []
      : await db
          .select({ id: machines.id, initials: machines.initials })
          .from(machines)
          .where(inArray(machines.id, desired));
  if (desiredRows.length !== desired.length) {
    return err("VALIDATION", "Unknown machine");
  }

  let outcome: { added: string[]; removed: string[] } | null;
  try {
    outcome = await db.transaction(async (tx) => {
      const tag = await loadTag(tx, tagId);
      if (!tag) return null;
      const current = await tx
        .select({
          machineId: machineTags.machineId,
          initials: machines.initials,
        })
        .from(machineTags)
        .innerJoin(machines, eq(machines.id, machineTags.machineId))
        .where(eq(machineTags.tagId, tagId));
      const currentIds = new Set(current.map((row) => row.machineId));
      const desiredIds = new Set(desired);
      const toRemove = current.filter((row) => !desiredIds.has(row.machineId));
      const toAdd = desiredRows.filter((row) => !currentIds.has(row.id));

      if (toRemove.length > 0) {
        await tx.delete(machineTags).where(
          and(
            eq(machineTags.tagId, tagId),
            inArray(
              machineTags.machineId,
              toRemove.map((row) => row.machineId)
            )
          )
        );
      }
      if (toAdd.length > 0) {
        await clearExclusiveSiblings(
          tx,
          tag,
          toAdd.map((row) => row.id)
        );
        await tx.insert(machineTags).values(
          toAdd.map((row) => ({
            machineId: row.id,
            tagId,
            tagTypeId: tag.tagTypeId,
            typeExclusive: tag.typeExclusive,
            addedBy: gate.actor.userId,
          }))
        );
      }
      return {
        added: toAdd.map((row) => row.initials),
        removed: toRemove.map((row) => row.initials),
      };
    });
  } catch (error) {
    return writeFailure(error, "setTagMachinesAction");
  }
  if (outcome === null) return err("NOT_FOUND", "Tag not found");

  revalidateTags([...outcome.added, ...outcome.removed]);
  return ok({ added: outcome.added.length, removed: outcome.removed.length });
}

/**
 * Put one hand-applied tag on one machine or take it off (spec 11.4–11.6). A
 * machine's owner may tag their own machines; technicians and admins any.
 */
export async function setMachineTagAction(input: {
  machineId: string;
  tagId: string;
  applied: boolean;
}): Promise<TagActionResult> {
  const actor = await resolveActor();
  if (actor.userId === undefined) return denied(actor);
  const parsed = setMachineTagSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { machineId, tagId, applied } = parsed.data;

  const machine = await db.query.machines.findFirst({
    where: eq(machines.id, machineId),
    columns: { initials: true, ownerId: true },
  });
  if (!machine) return err("NOT_FOUND", "Machine not found");
  if (
    !checkPermission("tags.apply", actor.access, {
      userId: actor.userId,
      machineOwnerId: machine.ownerId,
    })
  ) {
    return denied(actor);
  }

  let found: boolean;
  try {
    found = await db.transaction(async (tx) => {
      const tag = await loadTag(tx, tagId);
      if (!tag) return false;
      if (!applied) {
        await tx
          .delete(machineTags)
          .where(
            and(
              eq(machineTags.machineId, machineId),
              eq(machineTags.tagId, tagId)
            )
          );
        return true;
      }
      await clearExclusiveSiblings(tx, tag, [machineId]);
      await tx
        .insert(machineTags)
        .values({
          machineId,
          tagId,
          tagTypeId: tag.tagTypeId,
          typeExclusive: tag.typeExclusive,
          addedBy: actor.userId,
        })
        .onConflictDoNothing({
          target: [machineTags.machineId, machineTags.tagId],
        });
      return true;
    });
  } catch (error) {
    return writeFailure(error, "setMachineTagAction");
  }
  if (!found) return err("NOT_FOUND", "Tag not found");

  revalidateTags([machine.initials]);
  return ok(undefined);
}
