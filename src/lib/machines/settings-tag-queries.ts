import { countDistinct, eq } from "drizzle-orm";

import { type DbTransaction } from "~/server/db";
import {
  machineSettingsSetTags,
  machineSettingsSets,
  settingsTags,
} from "~/server/db/schema";
import {
  compareSettingsTags,
  type SettingsTagPage,
  type SettingsTagSummary,
} from "~/lib/machines/settings-tags";

/**
 * Settings tag reads (machine-settings §3.6–§3.7). Settings tags and every set
 * are public (§3.1, §2.5), so these take no viewer.
 */

/** Every settings tag with how many sets, on how many machines, carry it. */
export async function listSettingsTagSummaries(
  dbi: DbTransaction
): Promise<SettingsTagSummary[]> {
  const rows = await dbi
    .select({
      id: settingsTags.id,
      slug: settingsTags.slug,
      name: settingsTags.name,
      isBuiltin: settingsTags.isBuiltin,
      setCount: countDistinct(machineSettingsSetTags.setId),
      machineCount: countDistinct(machineSettingsSets.machineId),
    })
    .from(settingsTags)
    .leftJoin(
      machineSettingsSetTags,
      eq(machineSettingsSetTags.tagId, settingsTags.id)
    )
    .leftJoin(
      machineSettingsSets,
      eq(machineSettingsSets.id, machineSettingsSetTags.setId)
    )
    .groupBy(settingsTags.id);
  return rows.sort(compareSettingsTags);
}

/** A tag's page by slug: every set carrying it, by machine name (§3.6). */
export async function getSettingsTagPage(
  dbi: DbTransaction,
  slug: string
): Promise<SettingsTagPage | null> {
  const tag = await dbi.query.settingsTags.findFirst({
    where: eq(settingsTags.slug, slug),
    columns: { id: true, slug: true, name: true, isBuiltin: true },
  });
  if (!tag) return null;

  const rows = await dbi.query.machineSettingsSetTags.findMany({
    where: eq(machineSettingsSetTags.tagId, tag.id),
    columns: {},
    with: {
      set: {
        columns: {
          id: true,
          name: true,
          isCommunity: true,
          isPreferredHouse: true,
          isPreferredTournament: true,
          createdAt: true,
          updatedAt: true,
        },
        with: {
          machine: {
            columns: {
              id: true,
              initials: true,
              name: true,
              presenceStatus: true,
            },
          },
        },
      },
    },
  });

  const byMachine = new Map<string, SettingsTagPage["machines"][number]>();
  const sorted = [...rows].sort(
    (a, b) =>
      Number(b.set.isPreferredHouse) - Number(a.set.isPreferredHouse) ||
      Number(b.set.isPreferredTournament) -
        Number(a.set.isPreferredTournament) ||
      a.set.createdAt.getTime() - b.set.createdAt.getTime()
  );
  for (const { set } of sorted) {
    const { machine } = set;
    let entry = byMachine.get(machine.id);
    if (!entry) {
      entry = {
        id: machine.id,
        initials: machine.initials,
        name: machine.name,
        onTheFloor: machine.presenceStatus === "on_the_floor",
        sets: [],
      };
      byMachine.set(machine.id, entry);
    }
    entry.sets.push({
      id: set.id,
      name: set.name,
      isCommunity: set.isCommunity,
      isPreferredHouse: set.isPreferredHouse,
      isPreferredTournament: set.isPreferredTournament,
      updatedAt: set.updatedAt.toISOString(),
    });
  }

  return {
    ...tag,
    machines: [...byMachine.values()].sort(
      (a, b) =>
        a.name.localeCompare(b.name) || a.initials.localeCompare(b.initials)
    ),
  };
}
