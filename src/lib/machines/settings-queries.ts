import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { type DbTransaction } from "~/server/db";
import { machineSettingsSets } from "~/server/db/schema";
import { type AccessLevel } from "~/lib/permissions/matrix";
import { siteDayOf } from "~/lib/time-zone";
import {
  canDeleteSet,
  canEditSet,
  canMakeCommunity,
  canManageMachineSettings,
} from "~/lib/permissions";
import {
  type SettingsSection,
  type SettingsSetData,
} from "~/lib/machines/settings-types";
import { compareSettingsTags } from "~/lib/machines/settings-tags";

/**
 * Re-derive the client-only `_key` render keys that were stripped before
 * persisting. Stable within one render pass (the mapper runs once server-side);
 * a fresh load gets fresh keys, which is fine since the client fully remounts.
 */
function withRenderKeys(sections: SettingsSection[]): SettingsSection[] {
  return sections.map((section) => {
    switch (section.kind) {
      case "software":
      case "table":
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

/** Who is asking — determines each set's per-viewer rights. */
export interface SettingsSetsViewer {
  /** The authed user's id, or null for an anonymous visitor. */
  viewerId: string | null;
  /** The viewer's permission level (from their role). */
  access: AccessLevel;
  /** The machine owner's user id, or null if unowned. */
  machineOwnerId: string | null;
}

/**
 * Load every settings set on a machine as the client view-model (spec §2.5:
 * every set is visible to everyone who can open the machine). Default House
 * first, then default Tournament, then oldest-created. Each row carries the
 * viewer's rights. `updatedBy` resolves to the editor's display NAME
 * (CORE-SEC-007: never an email).
 */
export async function getMachineSettingsSets(
  dbi: DbTransaction,
  machineId: string,
  viewer: SettingsSetsViewer
): Promise<SettingsSetData[]> {
  const rows = await dbi.query.machineSettingsSets.findMany({
    where: eq(machineSettingsSets.machineId, machineId),
    columns: {
      id: true,
      name: true,
      isPreferredHouse: true,
      isPreferredTournament: true,
      isCommunity: true,
      createdBy: true,
      description: true,
      sections: true,
      updatedBy: true,
      updatedAt: true,
    },
    with: {
      updatedByUser: { columns: { name: true } },
      tags: {
        columns: {},
        with: { tag: { columns: { id: true, slug: true, name: true } } },
      },
    },
    orderBy: (s, { asc, desc }) => [
      desc(s.isPreferredHouse),
      desc(s.isPreferredTournament),
      asc(s.createdAt),
    ],
  });

  const canCurate = canManageMachineSettings(
    viewer.machineOwnerId,
    viewer.viewerId,
    viewer.access
  );

  return rows.map((row) => {
    const auth = { isCommunity: row.isCommunity, createdById: row.createdBy };
    return {
      id: row.id,
      name: row.name,
      isPreferredHouse: row.isPreferredHouse,
      isPreferredTournament: row.isPreferredTournament,
      isCommunity: row.isCommunity,
      tags: row.tags.map((t) => t.tag).sort(compareSettingsTags),
      createdById: row.createdBy,
      canEdit: canEditSet(
        auth,
        viewer.machineOwnerId,
        viewer.viewerId,
        viewer.access
      ),
      canDelete: canDeleteSet(
        auth,
        viewer.machineOwnerId,
        viewer.viewerId,
        viewer.access
      ),
      canMakeCommunity: canMakeCommunity(auth, viewer.viewerId, viewer.access),
      canCurate,
      description: row.description ?? null,
      sections: withRenderKeys(row.sections),
      updatedBy: row.updatedByUser?.name ?? "Unknown",
      updatedById: row.updatedBy,
      updatedAt: siteDayOf(row.updatedAt),
    };
  });
}
