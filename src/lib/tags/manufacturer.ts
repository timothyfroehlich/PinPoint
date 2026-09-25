import "server-only";

import { asc } from "drizzle-orm";
import { db, type DbTransaction } from "~/server/db";
import { machines } from "~/server/db/schema";
import type { CollectionMachine } from "~/lib/collections/owner";
import {
  getCurrentManufacturer,
  groupManufacturerTags,
} from "~/lib/machines/manufacturer";

/** One manufacturer tag and its machines, alphabetical by machine name. */
export interface ManufacturerTag {
  slug: string;
  name: string;
  machines: CollectionMachine[];
}

/**
 * Every manufacturer tag with at least one machine, in any presence state.
 * Membership is derived from stored machine and catalog rows, so reading a
 * tag never calls Pinball Map (spec collections-and-tags 7.6).
 */
export async function listManufacturerTags(
  tx: DbTransaction = db
): Promise<ManufacturerTag[]> {
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
    with: { pinballmapTitle: { columns: { manufacturer: true } } },
    orderBy: [asc(machines.name)],
  });
  return groupManufacturerTags(
    rows.map((row) => ({
      machine: {
        id: row.id,
        initials: row.initials,
        name: row.name,
        presenceStatus: row.presenceStatus,
      },
      manufacturer: getCurrentManufacturer(row),
    }))
  ).map((group) => ({
    slug: group.slug,
    name: group.name,
    machines: group.machines.map((member) => member.machine),
  }));
}

/** The tag at `slug`, or null when no machine currently carries it. */
export async function getManufacturerTag(
  tx: DbTransaction = db,
  slug: string
): Promise<ManufacturerTag | null> {
  const tags = await listManufacturerTags(tx);
  return tags.find((tag) => tag.slug === slug) ?? null;
}
