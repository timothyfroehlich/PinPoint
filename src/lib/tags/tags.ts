import "server-only";

import { asc } from "drizzle-orm";
import { db, type DbTransaction } from "~/server/db";
import { machines } from "~/server/db/schema";
import type { CollectionMachine } from "~/lib/collections/owner";
import {
  getCurrentManufacturer,
  groupManufacturerTags,
} from "~/lib/machines/manufacturer";
import { getOpdbRecords } from "~/lib/opdb/records";
import type { OpdbMachine } from "~/lib/opdb/types";
import { displayTag, playersTag, typeTag, type TagLabel } from "./opdb";
import { TAG_TYPE_IDS, type TagTypeId } from "./types";

/** One tag and its machines, alphabetical by machine name. */
export interface MachineTag {
  type: TagTypeId;
  slug: string;
  name: string;
  machines: CollectionMachine[];
}

export type TagsByType = Record<TagTypeId, MachineTag[]>;

interface Member {
  machine: CollectionMachine;
  manufacturer: string | null;
  opdb: OpdbMachine | null;
}

/** Group members under the label each maps to, ordered by the label's rank. */
function groupByLabel(
  type: TagTypeId,
  members: readonly Member[],
  labelOf: (opdb: OpdbMachine) => TagLabel | null
): MachineTag[] {
  const groups = new Map<
    string,
    { label: TagLabel; machines: CollectionMachine[] }
  >();
  for (const member of members) {
    const label = member.opdb === null ? null : labelOf(member.opdb);
    if (label === null) continue;
    const group = groups.get(label.slug);
    if (group) group.machines.push(member.machine);
    else groups.set(label.slug, { label, machines: [member.machine] });
  }
  return [...groups.values()]
    .sort((left, right) => left.label.rank - right.label.rank)
    .map(({ label, machines: tagged }) => ({
      type,
      slug: label.slug,
      name: label.name,
      machines: tagged,
    }));
}

/**
 * Every tag with at least one machine, by tag type, covering machines in any
 * presence state. Membership is derived from stored machine, catalog and OPDB
 * rows, so reading a tag never calls an external service (spec
 * collections-and-tags 7.6). Type, Display and Player Count tags come from the
 * OPDB record of a machine's catalog title (spec 9.1–9.2).
 */
export async function listTags(tx: DbTransaction = db): Promise<TagsByType> {
  const rows = await tx.query.machines.findMany({
    columns: {
      id: true,
      initials: true,
      name: true,
      presenceStatus: true,
      manufacturer: true,
      pinballmapMachineId: true,
      pinballmapExcluded: true,
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
      opdb: opdbId === null ? null : (records.get(opdbId) ?? null),
    };
  });

  return {
    manufacturer: groupManufacturerTags(members).map((group) => ({
      type: "manufacturer",
      slug: group.slug,
      name: group.name,
      machines: group.machines.map((member) => member.machine),
    })),
    type: groupByLabel("type", members, (opdb) => typeTag(opdb.type)),
    display: groupByLabel("display", members, (opdb) =>
      displayTag(opdb.display)
    ),
    "player-count": groupByLabel("player-count", members, (opdb) =>
      playersTag(opdb.playerCount)
    ),
  };
}

/** The tag at `type`/`slug`, or null when no machine currently carries it. */
export async function getTag(
  tx: DbTransaction,
  type: TagTypeId,
  slug: string
): Promise<MachineTag | null> {
  const tags = await listTags(tx);
  return tags[type].find((tag) => tag.slug === slug) ?? null;
}

/** Every tag a machine belongs to, in tag type order (spec 7.4). */
export async function getTagsForMachine(
  tx: DbTransaction,
  machineId: string
): Promise<MachineTag[]> {
  const tags = await listTags(tx);
  return TAG_TYPE_IDS.flatMap((type) =>
    tags[type].filter((tag) =>
      tag.machines.some((machine) => machine.id === machineId)
    )
  );
}
