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
 * EXISTING lmx rather than minting a second one. The early return (rather than
 * a replace) is deliberate: the stored row carries conditions and
 * `lastUpdatedByUsername` a synthesized one does not.
 *
 * A STALE row for the same title is dropped, though. PBM gives a title exactly
 * one lmx at our location, and every consumer resolves it by `machineId`
 * (`findLmxForMachine`, `derivePbmMachineStatus`), not by `id` — so leaving an
 * old id behind after PBM re-minted the row would make those lookups return the
 * dead lmx by array order, report the machine we just listed as `lmx_drifted`,
 * and let the reconcile pass "heal" it onto an lmx that no longer exists.
 */
export function withLmxAdded(
  snapshot: LocationSnapshot,
  lmxId: number,
  pinballmapMachineId: number
): LocationSnapshot {
  if (snapshot.lmxes.some((l) => l.id === lmxId)) return snapshot;
  const lmxes = [
    ...snapshot.lmxes.filter((l) => l.machineId !== pinballmapMachineId),
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

/**
 * The snapshot with `pinballmapMachineId`'s listing absent. A no-op when it is
 * already gone.
 *
 * Drops the title's row by `machineId`, not just the `id` we deleted — the same
 * asymmetry-closing rule `withLmxAdded` applies, and for the same reason: PBM
 * gives a title exactly one lmx at our location, and every consumer resolves it
 * by `machineId`. Filtering on `id` alone left a re-minted row behind, which
 * `resolveAutoLink` reads as "the title is still on the lineup" and re-lists
 * within the hour — silently undoing a human unlist (PP-rnup).
 *
 * `lmxId` is still matched first so this stays a no-op in the ordinary case
 * where the caller's handle and the stored row already agree.
 */
export function withLmxRemoved(
  snapshot: LocationSnapshot,
  lmxId: number,
  pinballmapMachineId: number | null
): LocationSnapshot {
  const lmxes = snapshot.lmxes.filter(
    (l) =>
      l.id !== lmxId &&
      (pinballmapMachineId === null || l.machineId !== pinballmapMachineId)
  );
  return { ...snapshot, lmxes, machineCount: lmxes.length };
}
