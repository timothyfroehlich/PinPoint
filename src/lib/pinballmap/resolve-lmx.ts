import type { LocationSnapshot, PbmLmx } from "./types";

/**
 * Find the location_machine_xref for a linked catalog title in a snapshot.
 *
 * PBM's create is find-or-create on (location, machine_id), so at our single
 * location a catalog title maps to at most one non-deleted lmx (PbmApiAudit
 * finding #1 — duplicate cabinets of one title share a single lmx). We read the
 * lmx off the stored snapshot (PP-o355.16) rather than hitting PBM per call
 * (CORE-PBM-001).
 */
export function findLmxForMachine(
  snapshot: LocationSnapshot,
  pinballmapMachineId: number
): PbmLmx | null {
  return (
    snapshot.lmxes.find((l) => l.machineId === pinballmapMachineId) ?? null
  );
}
