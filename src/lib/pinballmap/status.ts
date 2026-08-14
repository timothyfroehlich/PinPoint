import type { LocationSnapshot } from "./types";
import {
  resolveListingHolder,
  type ListingHolderCandidate,
} from "./listing-holder";

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
 *  - `unclaimed_on_pbm` — the lineup carries the title, no PinPoint machine
 *    holds the listing, and THIS machine is the one auto-link will pick.
 *    Transient: the next reconcile claims it. Claiming by hand writes nothing
 *    to Pinball Map, it just does it now.
 *  - `unclaimed_tie` — same, except two or more cabinets of this title are tied
 *    at the top presence rank, so auto-link declines to guess and the state
 *    persists until a person picks one.
 *  - `unclaimed_unavailable` — same, except no cabinet of this title is
 *    eligible to hold a listing at all: every one is `pending_arrival` or
 *    `removed`. Pinball Map is showing a game our own records say is not on the
 *    floor, so the answer is to take the entry down, not to claim it.
 *  - `unclaimed_elsewhere` — the lineup entry belongs to a DIFFERENT cabinet of
 *    the same title. Read-only here; claiming would put the listing on the
 *    wrong machine.
 *
 * An earlier version of this comment claimed the tie was the only way an
 * unclaimed entry survives a sync. That was wrong twice over — the
 * all-ineligible case persists too, and so does every unclaimed entry while
 * `pinballmap_state.enabled` is false, since `reconcileAfterSync` gates on it
 * and auto-link never runs at all (PP-o355.35 proposes removing that flag).
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
  | "unclaimed_tie"
  | "unclaimed_unavailable"
  | "unclaimed_elsewhere"
  | "listed"
  | "missing_on_pbm";

/**
 * Why a lineup entry is sitting unclaimed — which decides both the sentence and
 * the button, and they are not the same answer in all four cases.
 *
 * The plain `unclaimed_on_pbm` is TRANSIENT: auto-link captures a lone eligible
 * cabinet on the next reconcile, so a reader who waits an hour sees it resolve
 * itself. The other three are the ones that persist, because each is a case
 * where auto-link deliberately declines to choose. Collapsing them into one
 * state — which this control did until Tim asked what actually causes it —
 * meant offering "Claim this listing" as the answer to all four, and for two of
 * them claiming is the wrong move.
 */
function classifyUnclaimed(
  machineId: string,
  group: readonly ListingHolderCandidate[]
): PbmListingState {
  const holder = resolveListingHolder(group);
  switch (holder.kind) {
    // Two or more cabinets of this title, none listed, tied at the top presence
    // rank. Auto-link stands down because picking would be a guess; a person
    // breaks the tie by claiming on one of them.
    case "tie":
      return holder.machineIds.includes(machineId)
        ? "unclaimed_tie"
        : "unclaimed_elsewhere";
    // Nobody is ELIGIBLE — every cabinet of this title is `pending_arrival` or
    // `removed` (INVALID_WHEN_LISTED). Pinball Map is showing a game that, by
    // our own availability records, is not on the floor. Claiming would record
    // a listing we believe should not exist; the honest action is to take the
    // entry down.
    case "none":
      return "unclaimed_unavailable";
    // Some OTHER cabinet is the rightful holder and auto-link will take it.
    // Claiming here would put the listing on the wrong machine.
    case "candidate":
      return holder.machineId === machineId
        ? "unclaimed_on_pbm"
        : "unclaimed_elsewhere";
    // Unreachable in practice: an incumbent means somebody IS listed, and then
    // `derivePbmMachineStatus` would not have said `on_pbm_not_listed_locally`
    // for this machine. Falls through to the transient reading rather than
    // throwing — a wrong sentence beats a 500 on the Manage tab.
    case "incumbent":
      return "unclaimed_on_pbm";
  }
}

/**
 * Pure, same as `derivePbmMachineStatus` — the Manage tab page calls it directly.
 *
 * `sameTitleGroup` is every machine sharing this `pinballmapMachineId`,
 * INCLUDING this one (what `resolveListingHolder` expects). Optional because
 * only the unclaimed branch consults it: pass it and that branch tells you why
 * the entry is unclaimed; omit it and you get the undifferentiated
 * `unclaimed_on_pbm`, which is what every caller outside the Manage tab wants.
 */
export function derivePbmListingState(args: {
  machineId?: string;
  pinballmapMachineId: number | null;
  pinballmapExcluded: boolean;
  pinballmapListed: boolean;
  pinballmapLmxId: number | null;
  snapshot: LocationSnapshot | null;
  sameTitleGroup?: readonly ListingHolderCandidate[];
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
      return args.machineId !== undefined && args.sameTitleGroup !== undefined
        ? classifyUnclaimed(args.machineId, args.sameTitleGroup)
        : "unclaimed_on_pbm";
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
