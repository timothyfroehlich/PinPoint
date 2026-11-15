import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { type DbTransaction } from "~/server/db";
import { machines, settingsTags } from "~/server/db/schema";
import { type SettingsTagRef } from "~/lib/machines/settings-types";
import { compareSettingsTags } from "~/lib/machines/settings-tags";
import type { PrintRunMachine } from "~/lib/machines/settings-sheet-run";

/**
 * Settings sheet reads (PP-k3km). Every set is visible to everyone who can
 * open the machine (machine-settings §2.5), so these take no viewer.
 */

export type PrintRunMachineFilter =
  { kind: "ids"; ids: string[] } | { kind: "initials"; initials: string[] };

/**
 * The machines a print run can hold — only those On the Floor
 * (settings-sheets §2.3) — each with every settings set it has.
 */
export async function getPrintRunMachines(
  dbi: DbTransaction,
  filter: PrintRunMachineFilter
): Promise<PrintRunMachine[]> {
  const values = filter.kind === "ids" ? filter.ids : filter.initials;
  if (values.length === 0) return [];
  const rows = await dbi.query.machines.findMany({
    where: and(
      eq(machines.presenceStatus, "on_the_floor"),
      filter.kind === "ids"
        ? inArray(machines.id, filter.ids)
        : inArray(
            sql`upper(${machines.initials})`,
            filter.initials.map((value) => value.toUpperCase())
          )
    ),
    columns: { id: true, initials: true, name: true },
    with: {
      settingsSets: {
        columns: {
          id: true,
          name: true,
          updatedAt: true,
          isPreferredHouse: true,
          isPreferredTournament: true,
          sections: true,
        },
        with: {
          tags: { columns: {}, with: { tag: { columns: { slug: true } } } },
        },
        orderBy: (s, { desc }) => [
          desc(s.isPreferredHouse),
          desc(s.isPreferredTournament),
          asc(s.createdAt),
        ],
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    initials: row.initials,
    name: row.name,
    sets: row.settingsSets.map((set) => ({
      id: set.id,
      name: set.name,
      updatedAt: set.updatedAt.toISOString(),
      isPreferredHouse: set.isPreferredHouse,
      isPreferredTournament: set.isPreferredTournament,
      tagSlugs: set.tags.map((t) => t.tag.slug),
      sections: set.sections,
    })),
  }));
}

/** Every settings tag, House and Tournament first, then by name. */
export async function getSettingsTagOptions(
  dbi: DbTransaction
): Promise<SettingsTagRef[]> {
  const tags = await dbi
    .select({
      id: settingsTags.id,
      slug: settingsTags.slug,
      name: settingsTags.name,
    })
    .from(settingsTags);
  return tags.sort(compareSettingsTags);
}

/** The ids of every machine On the Floor (§2.3). */
export async function getOnTheFloorMachineIds(
  dbi: DbTransaction
): Promise<Set<string>> {
  const rows = await dbi
    .select({ id: machines.id })
    .from(machines)
    .where(eq(machines.presenceStatus, "on_the_floor"));
  return new Set(rows.map((row) => row.id));
}
