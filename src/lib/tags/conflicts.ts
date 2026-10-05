import "server-only";

import { and, asc, eq, isNotNull, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { DbTransaction } from "~/server/db";
import { machines, machineTags, tags } from "~/server/db/schema";
import type { TagConflictMachine } from "./types";

/**
 * What blocks changing a hand-applied tag type's exclusivity (spec
 * collections-and-tags 11.7) or moving a tag between tag types (11.16). The
 * tag pages read these to open their dialogs already knowing; the Server
 * Actions read them again inside the write's transaction.
 *
 * Machines in every presence state count: the database's one-per-machine
 * index does not know about presence.
 */

interface ConflictRow {
  machineId: string;
  initials: string;
  name: string;
  tag: string;
}

/** Rows ordered by machine, then tag, folded into one entry per machine. */
function byMachine(rows: readonly ConflictRow[]): TagConflictMachine[] {
  const machinesById = new Map<string, TagConflictMachine>();
  for (const row of rows) {
    const entry = machinesById.get(row.machineId);
    if (entry) entry.tags.push(row.tag);
    else
      machinesById.set(row.machineId, {
        initials: row.initials,
        name: row.name,
        tags: [row.tag],
      });
  }
  return [...machinesById.values()];
}

/**
 * The machines holding more than one tag of a tag type, which keep it from
 * being made exclusive (spec 11.7). Alphabetical by machine name.
 */
export async function exclusiveConflicts(
  tx: DbTransaction,
  tagTypeId: string
): Promise<TagConflictMachine[]> {
  const rows = await tx
    .select({
      machineId: machineTags.machineId,
      initials: machines.initials,
      name: machines.name,
      tag: tags.name,
    })
    .from(machineTags)
    .innerJoin(tags, eq(tags.id, machineTags.tagId))
    .innerJoin(machines, eq(machines.id, machineTags.machineId))
    .where(eq(tags.tagTypeId, tagTypeId))
    .orderBy(asc(machines.name), asc(machines.initials), asc(tags.name));
  return byMachine(rows).filter((machine) => machine.tags.length > 1);
}

/**
 * For each tag type, the machines holding `tagId` that also hold a tag of
 * that type. Moving the tag into an exclusive type is blocked by that type's
 * entry (spec 11.16). Types no such machine touches are absent.
 */
export async function moveConflicts(
  tx: DbTransaction,
  tagId: string
): Promise<Map<string, TagConflictMachine[]>> {
  const holder = alias(machineTags, "holder");
  const rows = await tx
    .select({
      typeId: tags.tagTypeId,
      machineId: holder.machineId,
      initials: machines.initials,
      name: machines.name,
      tag: tags.name,
    })
    .from(holder)
    .innerJoin(
      machineTags,
      and(
        eq(machineTags.machineId, holder.machineId),
        ne(machineTags.tagId, holder.tagId)
      )
    )
    .innerJoin(tags, eq(tags.id, machineTags.tagId))
    .innerJoin(machines, eq(machines.id, holder.machineId))
    .where(and(eq(holder.tagId, tagId), isNotNull(tags.tagTypeId)))
    .orderBy(asc(machines.name), asc(machines.initials), asc(tags.name));

  const rowsByType = new Map<string, ConflictRow[]>();
  for (const { typeId, ...row } of rows) {
    if (typeId === null) continue;
    const list = rowsByType.get(typeId);
    if (list) list.push(row);
    else rowsByType.set(typeId, [row]);
  }
  return new Map(
    [...rowsByType].map(([typeId, list]) => [typeId, byMachine(list)])
  );
}

/**
 * The tag types (null for no tag type) where another tag already has this
 * tag's name, ignoring case, so the tag cannot move there (spec 11.3, 11.16).
 * Stored names are normalized, so lower-casing matches the unique index.
 */
export async function typesWithTagName(
  tx: DbTransaction,
  tagId: string
): Promise<Set<string | null>> {
  const self = alias(tags, "self");
  const rows = await tx
    .select({ typeId: tags.tagTypeId })
    .from(tags)
    .innerJoin(
      self,
      and(eq(self.id, tagId), sql`lower(${tags.name}) = lower(${self.name})`)
    )
    .where(ne(tags.id, tagId));
  return new Set(rows.map((row) => row.typeId));
}
