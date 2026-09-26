import type { PbmListingView } from "./listing-state";
import { findLmxForMachine } from "./resolve-lmx";
import type { LocationSnapshot } from "./types";

/** A cabinet's Insider Connected intent (spec 3.8). Null: none recorded. */
export type PbmIcIntent = "on" | "off";

/**
 * What Pinball Map records for an entry's Insider Connected setting (3.8).
 * `not_set` is PBM's `ic_enabled: null` on an eligible title: nobody has set it.
 */
export type PbmInsiderConnectedSetting = "on" | "off" | "not_set";

export interface PbmInsiderConnectedView {
  /** This cabinet's own intent; null when none is recorded. */
  intent: PbmIcIntent | null;
  /**
   * What the switch shows: the intent when one is recorded, otherwise Pinball
   * Map's value, otherwise Not set (3.8).
   */
  shown: PbmInsiderConnectedSetting;
  /** Pinball Map's value for the entry; null when the entry is not on the lineup. */
  pinballMap: PbmInsiderConnectedSetting | null;
  /**
   * What the entry should be, from every cabinet sharing it: On when any wants
   * On, otherwise Off when any wants Off, otherwise null (no one has an opinion).
   */
  target: PbmIcIntent | null;
  /**
   * The entry is present, its target is set, and Pinball Map's value differs —
   * the Insider Connected differs state (4.2). Only raised while the lineup
   * itself is in sync; a Missing or Lingering push outranks it.
   */
  differs: boolean;
}

/** On wins across same-title cabinets, because they share one entry (3.8). */
export function insiderConnectedTarget(
  intents: readonly (PbmIcIntent | null)[]
): PbmIcIntent | null {
  if (intents.includes("on")) return "on";
  if (intents.includes("off")) return "off";
  return null;
}

/**
 * The Insider Connected switch for a machine's Pinball Map section, or null
 * when the title is not eligible and the switch is absent (3.8).
 *
 * `siblingIntents` is every same-title cabinet's intent, INCLUDING this one's,
 * matching how the listing derivation takes its siblings.
 *
 * Pure: derived from stored intent, the stored lineup and the catalog row,
 * never discovered by calling Pinball Map (3.4).
 */
export function deriveInsiderConnectedView(args: {
  listing: PbmListingView;
  pinballmapMachineId: number | null;
  icEligible: boolean;
  intent: PbmIcIntent | null;
  siblingIntents: readonly (PbmIcIntent | null)[];
  snapshot: LocationSnapshot | null;
}): PbmInsiderConnectedView | null {
  const { listing, pinballmapMachineId, icEligible, intent, snapshot } = args;
  if (!icEligible || pinballmapMachineId === null) return null;

  const lmx =
    listing.disabled === null && snapshot !== null
      ? findLmxForMachine(snapshot, pinballmapMachineId)
      : null;
  const pinballMap: PbmInsiderConnectedSetting | null =
    lmx === null
      ? null
      : lmx.icEnabled === null
        ? "not_set"
        : lmx.icEnabled
          ? "on"
          : "off";

  const target = insiderConnectedTarget(args.siblingIntents);
  // Flagged only where the lineup itself is in sync with the entry present:
  // Don't sync opts out of every flag (4.2), and Missing/Lingering own the push.
  const differs =
    pinballMap !== null &&
    target !== null &&
    target !== pinballMap &&
    listing.intent !== "no_sync" &&
    !listing.outOfSync;

  return {
    intent,
    shown: intent ?? pinballMap ?? "not_set",
    pinballMap,
    target,
    differs,
  };
}

/**
 * Fold the Insider Connected state into the listing view: a difference makes
 * the control Out of sync and, when no lineup push is pending, offers the
 * Update push (4.3). The listing's own state name is kept, so its sentence
 * (Shared, Covered, Flag…) still renders and the difference is added to it.
 */
export function withInsiderConnected(
  listing: PbmListingView,
  ic: PbmInsiderConnectedView | null
): PbmListingView {
  if (ic === null || !ic.differs) return listing;
  return {
    ...listing,
    outOfSync: true,
    pushAction: listing.pushAction ?? "update",
  };
}
