import "server-only";

import { cache } from "react";
import { asc, eq, inArray, or } from "drizzle-orm";
import { db, type DbTransaction } from "~/server/db";
import { machines, machineTags, tags, tagTypes } from "~/server/db/schema";
import type { CollectionMachine } from "~/lib/collections/owner";
import type { PickerMachine } from "~/lib/collections/user";
import { isRemoved } from "~/lib/machines/presence";
import { machineNotRemoved } from "~/lib/machines/queries";
import {
  getCurrentManufacturer,
  groupManufacturerTags,
} from "~/lib/machines/manufacturer";
import { getOpdbRecords } from "~/lib/opdb/records";
import type { OpdbMachine } from "~/lib/opdb/types";
import { buildTagGroups } from "./groups";
import { displayTag, playersTag, typeTag, type TagLabel } from "./opdb";
import {
  handTagHref,
  handTagTypeHref,
  isTagTypeId,
  tagHref,
  type AutomaticTag,
  type HandTag,
  type HandTagGroup,
  type HandTagType,
  type MachineTag,
  type TagGroup,
  type TagTypeId,
} from "./types";

type AutomaticTagsByType = Record<TagTypeId, AutomaticTag[]>;

/** Members other than Removed ones: the count a tag shows (spec 7.9). */
function countNotRemoved(tagged: readonly CollectionMachine[]): number {
  return tagged.filter((machine) => !isRemoved(machine.presenceStatus)).length;
}

/**
 * The model facts the Type, Display and Player Count tags read. A catalog-linked
 * machine gets them from its title's OPDB record; an uncataloged one from its
 * own hand-entered columns (spec 9.1). Null when the machine has neither.
 */
type ModelFacts = Pick<OpdbMachine, "type" | "display" | "playerCount">;

interface Member {
  machine: CollectionMachine;
  manufacturer: string | null;
  model: ModelFacts | null;
}

/** Group members under the label each maps to, ordered by the label's rank. */
function groupByLabel(
  type: TagTypeId,
  members: readonly Member[],
  labelOf: (model: ModelFacts) => TagLabel | null
): AutomaticTag[] {
  const groups = new Map<
    string,
    { label: TagLabel; machines: CollectionMachine[] }
  >();
  for (const member of members) {
    const label = member.model === null ? null : labelOf(member.model);
    if (label === null) continue;
    const group = groups.get(label.slug);
    if (group) group.machines.push(member.machine);
    else groups.set(label.slug, { label, machines: [member.machine] });
  }
  return [...groups.values()]
    .sort((left, right) => left.label.rank - right.label.rank)
    .map(({ label, machines: tagged }): AutomaticTag => ({
      kind: "automatic",
      type,
      slug: label.slug,
      name: label.name,
      href: tagHref(type, label.slug),
      machines: tagged,
      machineCount: countNotRemoved(tagged),
    }));
}

/**
 * Every tag with at least one machine, by tag type, covering machines in any
 * presence state. Membership is derived from stored machine, catalog and OPDB
 * rows, so reading a tag never calls an external service (spec
 * collections-and-tags 7.6). Type, Display and Player Count tags come from the
 * OPDB record of a machine's catalog title, or from the hand-entered model of
 * an uncataloged machine (spec 9.1–9.2).
 */
async function loadAutomaticTags(
  tx: DbTransaction
): Promise<AutomaticTagsByType> {
  const rows = await tx.query.machines.findMany({
    columns: {
      id: true,
      initials: true,
      name: true,
      presenceStatus: true,
      manufacturer: true,
      pinballmapMachineId: true,
      pinballmapExcluded: true,
      type: true,
      display: true,
      playerCount: true,
    },
    with: {
      pinballmapTitle: { columns: { manufacturer: true, opdbId: true } },
    },
    orderBy: [asc(machines.name)],
  });

  const opdbIdOf = (row: (typeof rows)[number]): string | null =>
    row.pinballmapMachineId === null
      ? null
      : (row.pinballmapTitle?.opdbId ?? null);
  const records = await getOpdbRecords(
    tx,
    rows.flatMap((row) => {
      const id = opdbIdOf(row);
      return id === null ? [] : [id];
    })
  );

  const members: Member[] = rows.map((row) => {
    const opdbId = opdbIdOf(row);
    return {
      machine: {
        id: row.id,
        initials: row.initials,
        name: row.name,
        presenceStatus: row.presenceStatus,
      },
      manufacturer: getCurrentManufacturer(row),
      // The CHECK `machines_manual_model_requires_excluded` keeps the
      // hand-entered columns null on any other machine, so the two sources
      // never both apply.
      model: row.pinballmapExcluded
        ? {
            type: row.type,
            display: row.display,
            playerCount: row.playerCount,
          }
        : opdbId === null
          ? null
          : (records.get(opdbId) ?? null),
    };
  });

  return {
    manufacturer: groupManufacturerTags(members).map((group): AutomaticTag => {
      const tagged = group.machines.map((member) => member.machine);
      return {
        kind: "automatic",
        type: "manufacturer",
        slug: group.slug,
        name: group.name,
        href: tagHref("manufacturer", group.slug),
        machines: tagged,
        machineCount: countNotRemoved(tagged),
      };
    }),
    type: groupByLabel("type", members, (model) => typeTag(model.type)),
    display: groupByLabel("display", members, (model) =>
      displayTag(model.display)
    ),
    "player-count": groupByLabel("player-count", members, (model) =>
      playersTag(model.playerCount)
    ),
  };
}

/**
 * Every hand-applied tag type and tag with its machines (spec §11). A tag's
 * machines come from the rows applying it, in every presence state.
 */
async function loadHandTags(
  tx: DbTransaction
): Promise<{ types: HandTagType[]; tags: HandTag[] }> {
  const typeRows = await tx
    .select({
      id: tagTypes.id,
      slug: tagTypes.slug,
      name: tagTypes.name,
      exclusive: tagTypes.exclusive,
    })
    .from(tagTypes);
  const tagRows = await tx
    .select({
      id: tags.id,
      typeId: tags.tagTypeId,
      slug: tags.slug,
      name: tags.name,
    })
    .from(tags);
  const memberRows = await tx
    .select({
      tagId: machineTags.tagId,
      id: machines.id,
      initials: machines.initials,
      name: machines.name,
      presenceStatus: machines.presenceStatus,
    })
    .from(machineTags)
    .innerJoin(machines, eq(machines.id, machineTags.machineId))
    .orderBy(asc(machines.name));

  const membersByTag = new Map<string, CollectionMachine[]>();
  for (const { tagId, ...machine } of memberRows) {
    const list = membersByTag.get(tagId);
    if (list) list.push(machine);
    else membersByTag.set(tagId, [machine]);
  }
  const types = typeRows.map((row): HandTagType => ({
    ...row,
    href: handTagTypeHref(row.slug),
  }));
  const typeSlugs = new Map(types.map((type) => [type.id, type.slug]));
  return {
    types,
    tags: tagRows.map((row): HandTag => ({
      kind: "hand",
      id: row.id,
      typeId: row.typeId,
      slug: row.slug,
      name: row.name,
      href: handTagHref(
        row.typeId === null ? null : (typeSlugs.get(row.typeId) ?? null),
        row.slug
      ),
      machines: membersByTag.get(row.id) ?? [],
      machineCount: countNotRemoved(membersByTag.get(row.id) ?? []),
    })),
  };
}

async function loadTagGroups(tx: DbTransaction): Promise<TagGroup[]> {
  const automatic = await loadAutomaticTags(tx);
  const hand = await loadHandTags(tx);
  return buildTagGroups(automatic, hand.types, hand.tags);
}

/**
 * Request-deduped: a tag page's layout and its Machine View both need the tags,
 * and each read scans every machine. `cache()` keys on the `tx` argument, so
 * reads in different transactions stay separate (CORE-PERF-001).
 */
const loadTagGroupsCached = cache(loadTagGroups);

/** Every tag group in browse order (spec 7.3, 11.13–11.14). */
export function listTags(tx: DbTransaction = db): Promise<TagGroup[]> {
  return loadTagGroupsCached(tx);
}

/** The automatic tag at `type`/`slug`, or null when no machine carries it. */
export async function getTag(
  tx: DbTransaction,
  type: TagTypeId,
  slug: string
): Promise<AutomaticTag | null> {
  for (const group of await listTags(tx)) {
    if (group.kind !== "automatic" || group.type.id !== type) continue;
    return group.tags.find((tag) => tag.slug === slug) ?? null;
  }
  return null;
}

/** A tag found from its page address, with the group it is listed in. */
export type ResolvedTag =
  | {
      tag: AutomaticTag;
      group: Extract<TagGroup, { kind: "automatic" }>;
    }
  | { tag: HandTag; group: HandTagGroup };

function findHandTag(
  groups: readonly TagGroup[],
  slug: string
): ResolvedTag | null {
  for (const group of groups) {
    if (group.kind === "automatic") continue;
    const tag = group.tags.find((candidate) => candidate.slug === slug);
    if (tag) return { tag, group };
  }
  return null;
}

/**
 * The tag at `/c/tags/<typeSegment>/<slug>`, or null when there is none. An
 * automatic tag exists only while a machine carries it (spec 7.3). A
 * hand-applied tag's slug is unique on its own, so it resolves whatever the
 * type segment says; the caller redirects when `tag.href` is not the address
 * it was reached by.
 */
export async function resolveTag(
  tx: DbTransaction,
  typeSegment: string,
  slug: string
): Promise<ResolvedTag | null> {
  const groups = await listTags(tx);
  if (isTagTypeId(typeSegment)) {
    for (const group of groups) {
      if (group.kind !== "automatic" || group.type.id !== typeSegment) continue;
      const tag = group.tags.find((candidate) => candidate.slug === slug);
      if (tag) return { tag, group };
    }
  }
  // A hand-applied tag reached under any other segment, including an
  // automatic type's, is still that tag; the page redirects to its address.
  return findHandTag(groups, slug);
}

/** Every tag a machine belongs to, in browse order (spec 7.4, 11.14). */
export async function getTagsForMachine(
  tx: DbTransaction,
  machineId: string
): Promise<MachineTag[]> {
  const groups = await listTags(tx);
  return groups.flatMap((group): MachineTag[] =>
    group.tags.filter((tag) =>
      tag.machines.some((machine) => machine.id === machineId)
    )
  );
}

/**
 * The machines offered on a hand-applied tag's Edit machines dialog,
 * alphabetical. Removed machines are left out, except ones already carrying
 * the tag, the same rule a Collection's machine choice follows (spec 2.7).
 */
export function getTagPickerMachines(
  tagId: string,
  tx: DbTransaction = db
): Promise<PickerMachine[]> {
  return tx.query.machines.findMany({
    where: or(
      machineNotRemoved(),
      inArray(
        machines.id,
        tx
          .select({ id: machineTags.machineId })
          .from(machineTags)
          .where(eq(machineTags.tagId, tagId))
      )
    ),
    columns: { id: true, initials: true, name: true },
    orderBy: [asc(machines.name)],
  });
}
