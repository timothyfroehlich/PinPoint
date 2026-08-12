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
 * Whether a desync is worth telling a person about (PP-o355.21).
 *
 * Not every `desynced: true` is actionable. `lmx_drifted` is repaired by
 * `reconcileAfterSync` on the very next hourly cron — its heal condition is
 * this same predicate — so it only exists in the window between PBM moving a
 * row id and the next run. Reporting a state that fixes itself, to someone who
 * can do nothing about it, is noise.
 *
 * Of the two that remain, `listed_locally_absent_on_pbm` is the durable one:
 * nothing ever auto-unlists, so it persists until a person acts.
 * `on_pbm_not_listed_locally` became mostly transient once auto-link
 * (PP-o355.20) started capturing the listing for a lone eligible cabinet, and
 * now survives only where auto-link stands down — same-title cabinets tied at
 * the top presence rank. It is kept because that tie is exactly the case a
 * person has to break by hand.
 */
export function isActionableDesync(status: PbmMachineStatus): boolean {
  return (
    status.reason === "listed_locally_absent_on_pbm" ||
    status.reason === "on_pbm_not_listed_locally"
  );
}

/**
 * The state the Manage tab's listing control renders (PP-o355.21).
 *
 * "Derive, don't discover": every one of these comes from stored columns plus
 * the stored snapshot, so the control paints itself at page load with no call
 * to pinballmap.com. The control it replaces made you press "Connect" to find
 * out which state you were in, and answered "Not listed" for a fleet that was
 * in fact listed — the vocabulary of Connect / Verify / Reconnect went with it.
 *
 *  - `unmatched` — no model chosen yet, so there is nothing to list.
 *  - `not_on_pbm` — deliberately marked as absent from their catalog (a
 *    homebrew, a flipperless game). Same "nothing to list", different reason,
 *    and the reason is what the reader needs.
 *  - `unsynced` — we have never held a lineup, so we cannot claim either way.
 *  - `not_listed` — matched, and the lineup does not carry the title.
 *  - `unclaimed_on_pbm` — the lineup DOES carry the title but no PinPoint
 *    machine holds the listing. Auto-link normally captures this within the
 *    hour; it survives only where auto-link deliberately stands down (two
 *    same-title cabinets tied at the top presence rank), which is exactly the
 *    tie a person has to break. Claiming it writes nothing to Pinball Map.
 *  - `listed` — matched, listed, and the lineup agrees.
 *  - `missing_on_pbm` — we hold a listing the lineup no longer shows. Nothing
 *    ever auto-unlists, so this persists until someone acts.
 *
 * `lmx_drifted` deliberately lands in `listed`: the machine IS listed, and the
 * next hourly reconcile repairs the handle (see `isActionableDesync`).
 */
export type PbmListingState =
  | "unmatched"
  | "not_on_pbm"
  | "unsynced"
  | "not_listed"
  | "unclaimed_on_pbm"
  | "listed"
  | "missing_on_pbm";

/** Pure, same as `derivePbmMachineStatus` — the Manage tab page calls it directly. */
export function derivePbmListingState(args: {
  pinballmapMachineId: number | null;
  pinballmapExcluded: boolean;
  pinballmapListed: boolean;
  pinballmapLmxId: number | null;
  snapshot: LocationSnapshot | null;
}): PbmListingState {
  const {
    pinballmapMachineId,
    pinballmapExcluded,
    pinballmapListed,
    snapshot,
  } = args;

  // Matched or excluded, never both (DB CHECK) — so the excluded branch is
  // only reachable with no title, and reading it first is not an ordering bug.
  if (pinballmapMachineId === null) {
    return pinballmapExcluded ? "not_on_pbm" : "unmatched";
  }
  // No lineup means no evidence. Saying "not listed" here would be the exact
  // lie the old control told APC's whole fleet (CORE-ARCH-012).
  if (snapshot === null) return "unsynced";

  const status = derivePbmMachineStatus({
    pinballmapMachineId,
    pinballmapListed,
    pinballmapLmxId: args.pinballmapLmxId,
    snapshot,
  });

  switch (status.reason) {
    case "listed_locally_absent_on_pbm":
      return "missing_on_pbm";
    case "on_pbm_not_listed_locally":
      return "unclaimed_on_pbm";
    default:
      return pinballmapListed ? "listed" : "not_listed";
  }
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
