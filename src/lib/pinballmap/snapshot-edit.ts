import type { LocationSnapshot } from "./types";

/**
 * Keep the stored location snapshot consistent with an outbound write we just
 * performed (PP-o355.30).
 *
 * **Why this is not premature.** The stored snapshot is the input to
 * `resolveAutoLinkForMachine` (PP-o355.20), which runs on every machine save.
 * An unlist that clears `pinballmapListed` but leaves the title in the stored
 * lineup is re-listed by the next save on that machine — silently, any time
 * before the hourly cron refreshes the snapshot. We know exactly which lmx we
 * added or deleted, so correcting the snapshot costs no PBM call and closes
 * that window.
 *
 * Pure and non-mutating: no DB, no `server-only`, so the actions and their unit
 * tests both call these directly.
 */

/**
 * The snapshot with `lmxId` present for `pinballmapMachineId`.
 *
 * A no-op when that lmx is already listed — PinballMap's create is
 * find-or-create, so re-listing a title already on the lineup hands back the
 * EXISTING lmx rather than minting a second one.
 */
export function withLmxAdded(
  snapshot: LocationSnapshot,
  lmxId: number,
  pinballmapMachineId: number
): LocationSnapshot {
  if (snapshot.lmxes.some((l) => l.id === lmxId)) return snapshot;
  const lmxes = [
    ...snapshot.lmxes,
    {
      id: lmxId,
      machineId: pinballmapMachineId,
      icEnabled: null,
      lastUpdatedByUsername: null,
      conditions: [],
    },
  ];
  return { ...snapshot, lmxes, machineCount: lmxes.length };
}

/** The snapshot with `lmxId` absent. A no-op when it is already gone. */
export function withLmxRemoved(
  snapshot: LocationSnapshot,
  lmxId: number
): LocationSnapshot {
  const lmxes = snapshot.lmxes.filter((l) => l.id !== lmxId);
  return { ...snapshot, lmxes, machineCount: lmxes.length };
}
