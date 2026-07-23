import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { type DbTransaction } from "~/server/db";
import { machineSettingsSets } from "~/server/db/schema";
import { type AccessLevel } from "~/lib/permissions/matrix";
import {
  canEditSet,
  canSetOwnerDefault,
  canViewSet,
} from "~/lib/machines/settings-permissions";
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

/** Who is asking — determines set visibility and each set's `canEdit`. */
export interface SettingsSetsViewer {
  /** The authed user's id, or null for an anonymous visitor. */
  viewerId: string | null;
  /** The viewer's permission level (from their role). */
  access: AccessLevel;
  /** The machine owner's user id, or null if unowned. */
  machineOwnerId: string | null;
}

/**
 * Load the settings sets for a machine that the given viewer may SEE, as the
 * client view-model: public sets + the owner's default + the viewer's own
 * private drafts. Owner's default first, then oldest-created. Each row carries
 * a per-viewer `canEdit`. `updatedBy` resolves to the editor's display NAME
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
      isPreferred: true,
      isOwnerSet: true,
      isPublic: true,
      isTournament: true,
      createdBy: true,
      description: true,
      sections: true,
      updatedAt: true,
    },
    with: { updatedByUser: { columns: { name: true } } },
    orderBy: (s, { asc, desc }) => [desc(s.isPreferred), asc(s.createdAt)],
  });

  return rows
    .map((row) => ({
      auth: {
        isOwnerSet: row.isOwnerSet,
        isPublic: row.isPublic,
        isPreferred: row.isPreferred,
        createdById: row.createdBy,
      },
      row,
    }))
    .filter(({ auth }) => canViewSet(auth, viewer.viewerId, viewer.access))
    .map(({ auth, row }) => ({
      id: row.id,
      name: row.name,
      isPreferred: row.isPreferred,
      isOwnerSet: row.isOwnerSet,
      isPublic: row.isPublic,
      isTournament: row.isTournament,
      createdById: row.createdBy,
      canEdit: canEditSet(
        auth,
        viewer.machineOwnerId,
        viewer.viewerId,
        viewer.access
      ),
      canSetDefault: canSetOwnerDefault(
        auth,
        viewer.machineOwnerId,
        viewer.viewerId,
        viewer.access
      ),
      description: row.description ?? null,
      sections: withRenderKeys(row.sections),
      updatedBy: row.updatedByUser?.name ?? "Unknown",
      updatedAt: row.updatedAt.toISOString().slice(0, 10),
    }));
}
