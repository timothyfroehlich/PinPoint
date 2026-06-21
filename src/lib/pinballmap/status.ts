import type { LocationSnapshot } from "./types";
import type { MachinePresenceStatus } from "~/lib/machines/presence";

/**
 * Pure PinballMap status derivation (bead C / PP-o355.3).
 *
 * Kept out of `./sync` (which is `server-only` and pulls in the DB) so the Info
 * card and unit tests can derive per-machine PBM status from a stored snapshot
 * with no I/O. Everything here is a pure function of the snapshot.
 */

/** Per-machine PBM status derived from the stored location snapshot. */
export interface PbmMachineStatus {
  /** The linked PBM machine id appears in the location snapshot. */
  listed: boolean;
  /** Most recent PBM condition (comment) date for this machine (ISO), or null. */
  lastCommentIso: string | null;
  /** Snapshot listing disagrees with our presence rule (a desync to surface). */
  desynced: boolean;
}

/**
 * Our rule for whether a machine *should* be listed at our PBM location: only
 * machines currently on the floor. Everything else (off the floor, on loan,
 * pending arrival, removed) should not appear on the public map.
 */
export function shouldBeListedOnPbm(presence: MachinePresenceStatus): boolean {
  return presence === "on_the_floor";
}

/**
 * Derive a machine's PBM status from the stored snapshot. Pure (no I/O): pass
 * the snapshot read from `pinballmap_state.snapshotJson`.
 */
export function derivePbmMachineStatus(
  snapshot: LocationSnapshot | null,
  pinballmapMachineId: number,
  presence: MachinePresenceStatus
): PbmMachineStatus {
  const lmx =
    snapshot?.lmxes.find((l) => l.machineId === pinballmapMachineId) ?? null;
  const listed = lmx !== null;

  let lastCommentIso: string | null = null;
  if (lmx) {
    for (const condition of lmx.conditions) {
      if (lastCommentIso === null || condition.createdAtIso > lastCommentIso) {
        lastCommentIso = condition.createdAtIso;
      }
    }
  }

  return {
    listed,
    lastCommentIso,
    desynced: shouldBeListedOnPbm(presence) !== listed,
  };
}
