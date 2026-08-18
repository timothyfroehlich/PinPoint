import {
  getMachinePresenceLabel,
  type MachinePresenceStatus,
} from "~/lib/machines/presence";

import { findLmxForMachine } from "./resolve-lmx";
import type { LocationSnapshot } from "./types";

/**
 * What the two-line listing control renders (PP-o355.21, spec §4).
 *
 * **Derive, don't discover.** Everything here comes from stored columns plus the
 * stored location snapshot, so the control paints itself at page load and no
 * render reaches pinballmap.com (CORE-PBM-001).
 *
 * The return is a composed view rather than a flat enum, because the frames
 * genuinely overlap: intent On, entry present, a sibling also On, and the
 * cabinet on loan is Shared *and* Flag at the same time. `name` picks the one
 * label that owns the copy; the other fields drive rendering independently, so
 * nothing has to be re-derived in the component.
 */

/** The operator's decision for this cabinet (spec §1). Never inferred (5.1). */
export type PbmListingIntent = "on" | "off" | "no_sync";

/**
 * Canonical state names (spec 4.2). These are the vocabulary reviews, tests and
 * test ids all cite, so a state that cannot be named cannot be discussed.
 */
export type PbmListingStateName =
  /** No catalog title chosen yet, so there is nothing to put on a lineup. */
  | "no_model"
  /** Declared absent from their catalog — a homebrew, a flipperless game. */
  | "uncataloged"
  /** No lineup has ever been read, so no observation exists to render (3.5). */
  | "waiting"
  /** Don't sync: observed status still shown, nothing flagged (§1). */
  | "sync_off"
  /** Intent On, entry present, this cabinet alone. */
  | "on"
  /** Intent Off, entry absent. Quiet. */
  | "off"
  /** Intent Off, entry absent, and availability disallows turning it On (6.2). */
  | "blocked"
  /** Intent On while availability is invalid — allowed, never auto-fixed (6.2). */
  | "alert"
  /** Intent On while on loan / off the floor: in-sync look, quiet note (6.5). */
  | "flag"
  /** Intent On, entry absent. Out of sync. */
  | "missing"
  /** Intent Off on every same-title cabinet, entry present. Out of sync. */
  | "lingering"
  /** Intent On, entry present, and other cabinets are On too (4.7). */
  | "shared"
  /** Intent Off, entry present, and a sibling covers it (4.7). Quiet. */
  | "covered";

/** Why the box is disabled — decides the wording, which differs per reason. */
export type PbmDisabledReason = "no_model" | "uncataloged" | "waiting";

/** The push that would make the lineup agree with the intent (4.3). */
export type PbmPushAction = "add" | "remove";

/** A same-title cabinet, named so the coverage sentences can link to it (4.7). */
export interface PbmSibling {
  id: string;
  initials: string;
  name: string;
}

/** One same-title cabinet as the derivation needs it — including this one. */
export interface PbmSiblingInput extends PbmSibling {
  intent: PbmListingIntent;
}

export interface PbmListingView {
  name: PbmListingStateName;
  /** Set on the three states that render the whole box inert (spec 3.5, 4.2). */
  disabled: PbmDisabledReason | null;
  intent: PbmListingIntent;
  /**
   * Present when the toggle's On position must be disabled, carrying the reason
   * to show beside it (6.2). Independent of `name`: Lingering and Covered can
   * both be blocked, and 6.3 requires exactly that.
   */
  onPositionBlockedReason: string | null;
  /** Whether the location's lineup currently carries this title. */
  observed: boolean;
  /** Intent and lineup disagree — the header's Out of sync alert (4.1). */
  outOfSync: boolean;
  /** Availability advisory tier, if any (6.2 invalid → alert, 6.5 advise → flag). */
  advisory: "alert" | "flag" | null;
  /**
   * The availability behind `advisory`, already worded for display — "Removed",
   * "on loan". Derived here rather than in the component because the component
   * would otherwise have to reconstruct it from `onPositionBlockedReason`, which
   * is phrased for the toggle and says something different.
   */
  advisoryDetail: string | null;
  /** The OTHER same-title cabinets with intent On, for the 4.7 sentences. */
  coveredBy: readonly PbmSibling[];
  pushAction: PbmPushAction | null;
}

/**
 * Availability that forbids intent On (spec 6.2 invalid tier). Entering from the
 * intent side is BLOCKED; entering from the availability side is allowed and
 * renders Alert, because changing where a machine is must never rewrite what the
 * operator decided about the lineup (6.1).
 */
const INVALID_WHEN_ON: readonly MachinePresenceStatus[] = [
  "pending_arrival",
  "removed",
];

/**
 * Availability that merely advises against intent On (6.5 advise tier). Never
 * blocks and never alarms — a machine off the floor for an afternoon belongs on
 * the lineup; one gone for a month probably does not, and only a person knows
 * which this is.
 */
const ADVISE_WHEN_ON: readonly MachinePresenceStatus[] = [
  "off_the_floor",
  "on_loan",
];

/**
 * Derive the control's whole view. Pure — no DB, no `server-only` — so the
 * Manage page, the Info tab and unit tests all call it directly.
 *
 * `siblings` is every cabinet sharing this `pinballmapMachineId`, INCLUDING this
 * one; the caller passes the query it already runs and this filters itself out.
 * An empty array is read as "this cabinet is the only one", which is what an
 * unmatched machine's caller should pass.
 *
 * Deliberately NOT gated on `pinballmap_state.enabled`. Spec 3.5 defines Waiting
 * by whether a valid refresh exists, and the flag has no surface that can turn
 * it on (PP-o355.37) — so gating here would render every machine's control inert
 * on a flag nobody can flip.
 */
export function derivePbmListingView(args: {
  machineId: string;
  pinballmapMachineId: number | null;
  pinballmapExcluded: boolean;
  intent: PbmListingIntent;
  presenceStatus: MachinePresenceStatus;
  snapshot: LocationSnapshot | null;
  siblings: readonly PbmSiblingInput[];
}): PbmListingView {
  const {
    machineId,
    pinballmapMachineId,
    pinballmapExcluded,
    intent,
    presenceStatus,
    snapshot,
    siblings,
  } = args;

  // Names the field to change and its current value, in that order, because the
  // fix is the Availability control on this same page. Label-then-value rather
  // than a sentence: this sits beside a greyed-out toggle that already carries
  // the "can't", so restating it costs a line and adds nothing (design bible
  // §25 — a short label plus at most one supporting line).
  const blockedReason = INVALID_WHEN_ON.includes(presenceStatus)
    ? `Blocked by Availability: ${getMachinePresenceLabel(presenceStatus)}`
    : null;

  const inert = (disabled: PbmDisabledReason): PbmListingView => ({
    name: disabled,
    disabled,
    intent,
    // Nothing in an inert box is interactive, so a reason nobody can act on
    // would just be a second sentence contradicting the first.
    onPositionBlockedReason: null,
    observed: false,
    outOfSync: false,
    advisory: null,
    advisoryDetail: null,
    coveredBy: [],
    pushAction: null,
  });

  // Matched and excluded are mutually exclusive (2.1, DB CHECK), so the excluded
  // branch is only reachable with no title and reading it first is not an
  // ordering bug.
  if (pinballmapMachineId === null) {
    return inert(pinballmapExcluded ? "uncataloged" : "no_model");
  }
  // No lineup means no evidence. Rendering "not on the lineup" here would be the
  // exact lie the old control told APC's whole listed fleet (CORE-ARCH-012).
  if (snapshot === null) return inert("waiting");

  const observed = findLmxForMachine(snapshot, pinballmapMachineId) !== null;

  // Coverage is decided purely by the toggles (spec §1): every OTHER cabinet of
  // this title whose intent is On. `no_sync` does not cover — a cabinet opted
  // out of sync is not making a claim about the lineup.
  const coveredBy: PbmSibling[] = siblings
    .filter((s) => s.id !== machineId && s.intent === "on")
    .map(({ id, initials, name }) => ({ id, initials, name }));

  const base = {
    intent,
    onPositionBlockedReason: blockedReason,
    observed,
    coveredBy,
    disabled: null,
  } as const;

  // Sync off short-circuits everything below it: the observed fact still shows
  // (the location-level refresh keeps recording it), but nothing about this
  // cabinet is flagged, pushed or reconciled (§1, 5.3).
  if (intent === "no_sync") {
    return {
      ...base,
      name: "sync_off",
      outOfSync: false,
      advisory: null,
      advisoryDetail: null,
      pushAction: null,
    };
  }

  // Out of sync outranks the advisories below. Both can hold at once — an
  // intent-On cabinet marked Removed whose entry is also absent is Alert AND
  // Missing — and the resolvable one is the one worth leading with.
  if (intent === "on" && !observed) {
    return {
      ...base,
      name: "missing",
      outOfSync: true,
      advisory: null,
      advisoryDetail: null,
      pushAction: "add",
    };
  }
  if (intent === "off" && observed && coveredBy.length === 0) {
    return {
      ...base,
      name: "lingering",
      outOfSync: true,
      advisory: null,
      advisoryDetail: null,
      // Removing does not require the entry to be covered (4.3) — this state is
      // defined by nobody covering it, and it is still the right thing to take
      // down.
      pushAction: "remove",
    };
  }

  // In sync from here down. Availability advisories come next, ahead of
  // coverage: an entry for a machine our own records say is not on the floor is
  // more urgent than who else shares it.
  if (intent === "on") {
    if (blockedReason !== null) {
      return {
        ...base,
        name: "alert",
        outOfSync: false,
        advisory: "alert",
        advisoryDetail: getMachinePresenceLabel(presenceStatus),
        pushAction: null,
      };
    }
    if (ADVISE_WHEN_ON.includes(presenceStatus)) {
      return {
        ...base,
        name: "flag",
        outOfSync: false,
        advisory: "flag",
        // Lower-cased because it lands mid-sentence ("Note: on loan — …"),
        // where the badge's title case would read as a proper noun.
        advisoryDetail: getMachinePresenceLabel(presenceStatus).toLowerCase(),
        pushAction: null,
      };
    }
    return {
      ...base,
      name: coveredBy.length > 0 ? "shared" : "on",
      outOfSync: false,
      advisory: null,
      advisoryDetail: null,
      pushAction: null,
    };
  }

  // Intent Off, in sync. Either a sibling covers the entry, or there is no entry
  // — and in the latter case the only thing left to say is whether availability
  // would let this cabinet be turned On at all.
  return {
    ...base,
    name: observed ? "covered" : blockedReason !== null ? "blocked" : "off",
    outOfSync: false,
    advisory: null,
    advisoryDetail: null,
    pushAction: null,
  };
}
