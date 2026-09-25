import type { PbmListingView } from "./listing-state";
import { findLmxForMachine } from "./resolve-lmx";
import type { LocationSnapshot } from "./types";

/**
 * What Pinball Map records for an entry's Insider Connected setting (spec 3.8).
 * `not_set` is PBM's `ic_enabled: null` on an eligible title: nobody has set it.
 */
export type PbmInsiderConnectedSetting = "on" | "off" | "not_set";

export type PbmInsiderConnectedView =
  | {
      setting: PbmInsiderConnectedSetting;
      /** The entry the setting belongs to, resolved from the stored lineup by title. */
      lmxId: number;
    }
  /** Eligible title, but 3.8 shows no setting: intent not On, entry absent,
   *  or no usable lineup yet. The row stays so the control keeps its height (4.1). */
  | { setting: "unavailable" };

/**
 * The Insider Connected row for a machine's Pinball Map section, or null when
 * the title is not eligible and the row is absent.
 *
 * The row's presence depends only on the title, so it never changes between
 * states on one machine (spec 4.1). Its setting shows only on a cabinet with
 * intent On whose entry is present (3.8). Eligibility comes from Pinball Map's
 * catalog flag alone — an entry's `ic_enabled` cannot supply it, because null
 * there means "never set" on eligible and ineligible titles alike.
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
  if (!icEligible || pinballmapMachineId === null) return null;

  const unavailable = { setting: "unavailable" } as const;
  if (
    listing.disabled !== null ||
    listing.intent !== "on" ||
    !listing.observed ||
    snapshot === null
  )
    return unavailable;

  const lmx = findLmxForMachine(snapshot, pinballmapMachineId);
  if (!lmx) return unavailable;

  const setting: PbmInsiderConnectedSetting =
    lmx.icEnabled === null ? "not_set" : lmx.icEnabled ? "on" : "off";
  return { lmxId: lmx.id, setting };
}
