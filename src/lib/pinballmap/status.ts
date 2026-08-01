import type { LocationSnapshot } from "./types";

/**
 * Derived PinballMap status for a single machine (PP-o355.11).
 *
 * Three concepts stay SEPARATE (Tim, 2026-07): catalog association (linking,
 * `pinballmapMachineId`), PBM listing intent (`pinballmapListed`, our map
 * membership boolean), and availability (`presenceStatus`, unrelated). Desync
 * is a soft signal we SURFACE — never a rule that flips listing from presence.
 *
 * `reason` distinguishes the cases:
 *  - `ok` — linked, and the local flag agrees with the stored snapshot.
 *  - `listed_locally_absent_on_pbm` — we marked it listed, but PBM's lineup has
 *    no row for this title. Someone likely removed it on PBM.
 *  - `on_pbm_not_listed_locally` — PBM shows the title, but we haven't marked it
 *    listed here. Someone likely added it on PBM.
 *  - `lmx_drifted` — listed and present, but under a different lmx id than the
 *    one we stored (a delete+re-add outside PBM's resurrection window). The
 *    reconcile pass heals `pinballmapLmxId` to the current id.
 *  - `unlinked` — no catalog title, so PBM status is not applicable.
 */
export interface PbmMachineStatus {
  onPbm: boolean;
  lmxId: number | null;
  desynced: boolean;
  reason:
    | "ok"
    | "listed_locally_absent_on_pbm"
    | "on_pbm_not_listed_locally"
    | "lmx_drifted"
    | "unlinked";
}

/**
 * Compare a machine's local PBM fields against the stored location snapshot.
 *
 * Pure: no DB, no `server-only`, so the Info card, the reconcile pass, and unit
 * tests all call it directly. A `null` snapshot (never synced) is treated as
 * "no information", not desync — we trust the local flag and report `ok`.
 */
export function derivePbmMachineStatus(args: {
  pinballmapMachineId: number | null;
  pinballmapListed: boolean;
  pinballmapLmxId: number | null;
  snapshot: LocationSnapshot | null;
}): PbmMachineStatus {
  const { pinballmapMachineId, pinballmapListed, pinballmapLmxId, snapshot } =
    args;

  if (pinballmapMachineId === null) {
    return { onPbm: false, lmxId: null, desynced: false, reason: "unlinked" };
  }
  if (!snapshot) {
    return {
      onPbm: pinballmapListed,
      lmxId: pinballmapLmxId,
      desynced: false,
      reason: "ok",
    };
  }

  const row =
    snapshot.lmxes.find((l) => l.machineId === pinballmapMachineId) ?? null;
  const onPbm = row !== null;

  if (pinballmapListed && !onPbm) {
    return {
      onPbm: false,
      lmxId: pinballmapLmxId,
      desynced: true,
      reason: "listed_locally_absent_on_pbm",
    };
  }
  if (!pinballmapListed && row !== null) {
    return {
      onPbm: true,
      lmxId: row.id,
      desynced: true,
      reason: "on_pbm_not_listed_locally",
    };
  }
  if (pinballmapListed && row !== null && row.id !== pinballmapLmxId) {
    return {
      onPbm: true,
      lmxId: row.id,
      desynced: true,
      reason: "lmx_drifted",
    };
  }
  return {
    onPbm,
    lmxId: row?.id ?? pinballmapLmxId,
    desynced: false,
    reason: "ok",
  };
}

/**
 * Whether a machine should appear on PBM's lineup — our LOCAL listing intent
 * only. Deliberately independent of `presenceStatus`: the three-concept model
 * (linking / listing / availability) keeps availability from driving map
 * membership. This is the specific rework of the reverted b6eb7dca
 * `shouldBeListedOnPbm`, which used to hard-link presence to listing.
 */
export function shouldBeListedOnPbm(args: {
  pinballmapListed: boolean;
}): boolean {
  return args.pinballmapListed;
}
