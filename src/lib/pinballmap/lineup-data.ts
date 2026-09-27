import "server-only";

import { inArray } from "drizzle-orm";

import { db } from "~/server/db";
import {
  machines,
  pinballmapAbandonedListings,
  pinballmapCatalog,
} from "~/server/db/schema";

import {
  compareLineup,
  type LineupCatalogTitle,
  type LineupComparison,
  type LineupMachineInput,
} from "./lineup-comparison";
import { getPinballMapState } from "./state";
import type { PinballmapRuntimeState } from "~/lib/types";

/** A machine as the lineup page loads it, with the owner its gates need. */
export interface LineupMachineRow extends LineupMachineInput {
  ownerId: string | null;
}

export interface LineupData {
  state: PinballmapRuntimeState | null;
  comparison: LineupComparison;
  machines: readonly LineupMachineRow[];
}

/**
 * Everything the lineup comparison reads, from stored data only — the state
 * singleton, every machine, the catalog rows it names, and the abandoned-entry
 * records. Nothing here calls Pinball Map (CORE-PBM-001, lineup spec §2.3).
 *
 * Shared by the lineup page and the `/m` header's difference badge, so the
 * badge can never count differently from the page it links to.
 */
export async function loadLineupData(): Promise<LineupData> {
  const [state, machineRows, abandoned] = await Promise.all([
    getPinballMapState(),
    db
      .select({
        id: machines.id,
        initials: machines.initials,
        name: machines.name,
        presenceStatus: machines.presenceStatus,
        pinballmapMachineId: machines.pinballmapMachineId,
        pinballmapExcluded: machines.pinballmapExcluded,
        intent: machines.pinballmapIntent,
        icIntent: machines.pinballmapIcIntent,
        ownerId: machines.ownerId,
      })
      .from(machines),
    db
      .select({
        machineId: pinballmapAbandonedListings.machineId,
        lmxId: pinballmapAbandonedListings.lmxId,
        pinballmapMachineId: pinballmapAbandonedListings.pinballmapMachineId,
        locationId: pinballmapAbandonedListings.locationId,
      })
      .from(pinballmapAbandonedListings),
  ]);

  const trackedLocationId = state?.locationId ?? null;
  const configured = trackedLocationId !== null;
  const snapshot = configured ? (state?.snapshotJson ?? null) : null;

  // Catalog rows for every title the page can name: matched titles, lineup
  // entries (for their names and families), and abandoned records.
  const titleIds = new Set<number>();
  for (const m of machineRows)
    if (m.pinballmapMachineId !== null) titleIds.add(m.pinballmapMachineId);
  for (const lmx of snapshot?.lmxes ?? []) titleIds.add(lmx.machineId);
  for (const record of abandoned) titleIds.add(record.pinballmapMachineId);

  const catalog: LineupCatalogTitle[] =
    configured && titleIds.size > 0
      ? await db
          .select({
            pinballmapMachineId: pinballmapCatalog.pinballmapMachineId,
            name: pinballmapCatalog.name,
            manufacturer: pinballmapCatalog.manufacturer,
            year: pinballmapCatalog.year,
            machineGroupId: pinballmapCatalog.machineGroupId,
            icEligible: pinballmapCatalog.icEligible,
          })
          .from(pinballmapCatalog)
          .where(inArray(pinballmapCatalog.pinballmapMachineId, [...titleIds]))
      : [];

  return {
    state,
    comparison: compareLineup({
      configured,
      trackedLocationId,
      snapshot,
      machines: machineRows,
      catalog,
      abandoned,
    }),
    machines: machineRows,
  };
}
