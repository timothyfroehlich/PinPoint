/**
 * Unit: when the Insider Connected row exists (4.1) and what it shows (3.8).
 */

import { describe, it, expect } from "vitest";

import { deriveInsiderConnectedView } from "./insider-connected";
import { derivePbmListingView, type PbmListingIntent } from "./listing-state";
import type { LocationSnapshot } from "./types";

const TITLE = 3416;
const LMX = 186719;

function snapshot(icEnabled: boolean | null, present = true): LocationSnapshot {
  const lmxes = present
    ? [
        {
          id: LMX,
          machineId: TITLE,
          icEnabled,
          lastUpdatedByUsername: null,
          conditions: [],
        },
      ]
    : [];
  return {
    locationId: 26454,
    name: "Austin Pinball Collective",
    dateLastUpdated: null,
    lastUpdatedByUsername: null,
    machineCount: lmxes.length,
    lmxes,
    fetchedAtIso: "2026-09-25T00:00:00.000Z",
    raw: null,
  };
}

function derive(opts: {
  icEnabled?: boolean | null;
  present?: boolean;
  intent?: PbmListingIntent;
  icEligible?: boolean;
  configured?: boolean;
}): ReturnType<typeof deriveInsiderConnectedView> {
  const snap = snapshot(opts.icEnabled ?? null, opts.present ?? true);
  const configured = opts.configured ?? true;
  const listing = derivePbmListingView({
    machineId: "self",
    pinballmapMachineId: TITLE,
    pinballmapExcluded: false,
    intent: opts.intent ?? "on",
    configured,
    presenceStatus: "on_the_floor",
    snapshot: configured ? snap : null,
    siblings: [],
  });
  return deriveInsiderConnectedView({
    listing,
    pinballmapMachineId: TITLE,
    icEligible: opts.icEligible ?? true,
    snapshot: configured ? snap : null,
  });
}

describe("deriveInsiderConnectedView", () => {
  it.each([
    [true, "on"],
    [false, "off"],
    [null, "not_set"],
  ] as const)("reads PBM's %s as %s", (icEnabled, setting) => {
    expect(derive({ icEnabled })).toEqual({ lmxId: LMX, setting });
  });

  it("has no row for a title the catalog does not mark eligible", () => {
    // Even with a recorded value: eligibility comes only from the catalog flag.
    expect(derive({ icEnabled: true, icEligible: false })).toBeNull();
  });

  it.each(["off", "no_sync"] as const)(
    "keeps the row without a setting when intent is %s",
    (intent) => {
      expect(derive({ icEnabled: true, intent })).toEqual({
        setting: "unavailable",
      });
    }
  );

  it("keeps the row without a setting when the entry is not on the lineup", () => {
    expect(derive({ present: false })).toEqual({ setting: "unavailable" });
  });

  it("keeps the row without a setting while the integration is not configured", () => {
    expect(derive({ icEnabled: true, configured: false })).toEqual({
      setting: "unavailable",
    });
  });
});
