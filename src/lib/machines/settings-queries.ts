import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { type DbTransaction } from "~/server/db";
import { machineSettingsSets } from "~/server/db/schema";
import type {
  SettingsSection,
  SettingsSetData,
} from "~/lib/machines/settings-types";

/**
 * Re-derive the client-only `_key` render keys that were stripped before
 * persisting. Stable within one render pass (the mapper runs once server-side);
 * a fresh load gets fresh keys, which is fine since the client fully remounts.
 */
function withRenderKeys(sections: SettingsSection[]): SettingsSection[] {
  return sections.map((section) => {
    switch (section.kind) {
      case "software":
        return {
          ...section,
          rows: section.rows.map((r) => ({ ...r, _key: randomUUID() })),
        };
      case "dip":
        return {
          ...section,
          switches: section.switches.map((s) => ({
            ...s,
            _key: randomUUID(),
          })),
        };
      case "note":
        return section;
    }
  });
}

/**
 * Load every settings set for a machine as the client view-model. Preferred
 * set first, then oldest-created. `updatedBy` resolves to the editor's display
 * NAME (CORE-SEC-007: never an email).
 */
export async function getMachineSettingsSets(
  dbi: DbTransaction,
  machineId: string
): Promise<SettingsSetData[]> {
  const rows = await dbi.query.machineSettingsSets.findMany({
    where: eq(machineSettingsSets.machineId, machineId),
    columns: {
      id: true,
      name: true,
      isPreferred: true,
      description: true,
      sections: true,
      updatedAt: true,
    },
    with: { updatedByUser: { columns: { name: true } } },
    orderBy: (s, { asc, desc }) => [desc(s.isPreferred), asc(s.createdAt)],
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    isPreferred: row.isPreferred,
    description: row.description ?? null,
    sections: withRenderKeys(row.sections),
    updatedBy: row.updatedByUser?.name ?? "Unknown",
    updatedAt: row.updatedAt.toISOString().slice(0, 10),
  }));
}
