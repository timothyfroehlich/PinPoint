import "server-only";

import { cache } from "react";

import { db } from "~/server/db";
import {
  getOnTheFloorMachineIds,
  getPrintRunMachines,
  getSettingsTagOptions,
} from "~/lib/machines/settings-sheet-queries";
import type { PrintRunMachine } from "~/lib/machines/settings-sheet-run";
import type { SettingsTagRef } from "~/lib/machines/settings-types";

/**
 * Settings sheet reads for the routes that render them: Print settings sheets
 * (`/m/settings-sheets`), its printed page (`/m/settings-sheets/print`) and a
 * machine's Settings tab, which offers the same tags. The queries live in
 * `~/lib/machines/settings-sheet-queries` and take the database handle; these
 * bind it so pages never import `~/server/db`.
 */

/** Every settings tag, in display order. `cache()`-wrapped per request. */
export const getSettingsTags = cache((): Promise<SettingsTagRef[]> =>
  getSettingsTagOptions(db)
);

/** Ids of every machine On the Floor. `cache()`-wrapped per request. */
export const getOnTheFloorIds = cache((): Promise<Set<string>> =>
  getOnTheFloorMachineIds(db)
);

/** The print run named in the URL, by machine initials (settings-sheets §2.6). */
export function getPrintRunMachinesByInitials(
  initials: string[]
): Promise<PrintRunMachine[]> {
  return getPrintRunMachines(db, { kind: "initials", initials });
}
