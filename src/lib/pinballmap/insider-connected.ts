import type { PbmListingView } from "./listing-state";
import { findLmxForMachine } from "./resolve-lmx";
import type { LocationSnapshot } from "./types";

/**
 * What Pinball Map records for an entry's Insider Connected setting (spec 3.8).
 * `not_set` is PBM's `ic_enabled: null` on an eligible title: nobody has set it.
 */
export type PbmInsiderConnectedSetting = "on" | "off" | "not_set";

export interface PbmInsiderConnectedView {
  /** The entry the setting belongs to, resolved from the stored lineup by title. */
  lmxId: number;
  setting: PbmInsiderConnectedSetting;
}

/**
 * The Insider Connected line for a machine's Pinball Map section, or null when
 * spec 3.8 shows nothing.
 *
 * Shown only on a cabinet with intent On whose entry is present, and only when
 * Pinball Map's catalog marks the title eligible. Eligibility comes from that
 * flag alone — an entry's `ic_enabled` cannot supply it, because null there
 * means "never set" on eligible and ineligible titles alike.
 *
 * Pure: derived from the stored lineup and catalog row, never discovered by
 * calling Pinball Map (spec 3.4).
 */
export function deriveInsiderConnectedView(args: {
  listing: PbmListingView;
  pinballmapMachineId: number | null;
  icEligible: boolean;
  snapshot: LocationSnapshot | null;
}): PbmInsiderConnectedView | null {
  const { listing, pinballmapMachineId, icEligible, snapshot } = args;
  if (
    !icEligible ||
    listing.disabled !== null ||
    listing.intent !== "on" ||
    !listing.observed ||
    pinballmapMachineId === null ||
    snapshot === null
  )
    return null;

  const lmx = findLmxForMachine(snapshot, pinballmapMachineId);
  if (!lmx) return null;

  const setting: PbmInsiderConnectedSetting =
    lmx.icEnabled === null ? "not_set" : lmx.icEnabled ? "on" : "off";
  return { lmxId: lmx.id, setting };
}
