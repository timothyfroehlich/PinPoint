import "server-only";

import { eq, inArray } from "drizzle-orm";

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

/** A machine that walked away from an entry at the tracked location. */
export interface LineupAbandonedRecord {
  lmxId: number;
  machineId: string;
}

export interface LineupData {
  state: PinballmapRuntimeState | null;
  comparison: LineupComparison;
  machines: readonly LineupMachineRow[];
  /** Catalog rows for every matched title and lineup entry. */
  catalog: readonly LineupCatalogTitle[];
  /**
   * Abandoned-entry records at the tracked location. An owner may remove an
   * entry their own machine walked away from, the same allowlist the machine
   * page's removal uses (pinballmap §2.5, §8.2).
   */
  abandoned: readonly LineupAbandonedRecord[];
}

/**
 * Everything the lineup comparison reads, from stored data only — the state
 * singleton, every machine, and the catalog rows it names. Nothing here calls
 * Pinball Map (CORE-PBM-001, lineup spec §2.3).
 */
export async function loadLineupData(): Promise<LineupData> {
  const [state, machineRows] = await Promise.all([
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
  ]);

  const trackedLocationId = state?.locationId ?? null;
  const configured = trackedLocationId !== null;
  const snapshot = configured ? (state?.snapshotJson ?? null) : null;

  // Catalog rows for every title the page can name: matched titles, for their
  // names, families and eligibility, and lineup entries.
  const titleIds = new Set<number>();
  for (const m of machineRows)
    if (m.pinballmapMachineId !== null) titleIds.add(m.pinballmapMachineId);
  for (const lmx of snapshot?.lmxes ?? []) titleIds.add(lmx.machineId);

  const [catalog, abandoned]: [LineupCatalogTitle[], LineupAbandonedRecord[]] =
    await Promise.all([
      configured && titleIds.size > 0
        ? db
            .select({
              pinballmapMachineId: pinballmapCatalog.pinballmapMachineId,
              name: pinballmapCatalog.name,
              manufacturer: pinballmapCatalog.manufacturer,
              year: pinballmapCatalog.year,
              machineGroupId: pinballmapCatalog.machineGroupId,
              icEligible: pinballmapCatalog.icEligible,
            })
            .from(pinballmapCatalog)
            .where(
              inArray(pinballmapCatalog.pinballmapMachineId, [...titleIds])
            )
        : Promise.resolve([]),
      trackedLocationId === null
        ? Promise.resolve([])
        : db
            .select({
              lmxId: pinballmapAbandonedListings.lmxId,
              machineId: pinballmapAbandonedListings.machineId,
            })
            .from(pinballmapAbandonedListings)
            .where(
              eq(pinballmapAbandonedListings.locationId, trackedLocationId)
            ),
    ]);

  return {
    state,
    comparison: compareLineup({
      configured,
      snapshot,
      machines: machineRows,
      catalog,
    }),
    machines: machineRows,
    catalog,
    abandoned,
  };
}
