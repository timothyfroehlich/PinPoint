/**
 * Unit: the Insider Connected intent's view and how it folds into the listing
 * control (spec 3.8, 4.2, 4.3).
 */

import { describe, it, expect } from "vitest";

import {
  deriveInsiderConnectedView,
  insiderConnectedTarget,
  withInsiderConnected,
  type PbmIcIntent,
} from "./insider-connected";
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
  icIntent?: PbmIcIntent | null;
  siblingIntents?: readonly (PbmIcIntent | null)[];
  icEligible?: boolean;
  configured?: boolean;
}): {
  ic: ReturnType<typeof deriveInsiderConnectedView>;
  listing: ReturnType<typeof withInsiderConnected>;
} {
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
  const icIntent = opts.icIntent ?? null;
  const ic = deriveInsiderConnectedView({
    listing,
    pinballmapMachineId: TITLE,
    icEligible: opts.icEligible ?? true,
    intent: icIntent,
    siblingIntents: opts.siblingIntents ?? [icIntent],
    snapshot: configured ? snap : null,
  });
  return { ic, listing: withInsiderConnected(listing, ic) };
}

describe("insiderConnectedTarget", () => {
  it.each([
    [[], null],
    [[null, null], null],
    [["off", null], "off"],
    [["off", "on"], "on"],
    [["on", "off", null], "on"],
  ] as const)("targets %j as %s (On wins)", (intents, target) => {
    expect(insiderConnectedTarget(intents)).toBe(target);
  });
});

describe("deriveInsiderConnectedView", () => {
  it("is absent for a title the catalog does not mark eligible", () => {
    // Even with a recorded value: eligibility comes only from the catalog flag.
    expect(derive({ icEnabled: true, icEligible: false }).ic).toBeNull();
  });

  it.each([
    [true, "on"],
    [false, "off"],
    [null, "not_set"],
  ] as const)(
    "with no intent, shows Pinball Map's %s as %s and never flags it",
    (icEnabled, shown) => {
      const { ic, listing } = derive({ icEnabled });
      expect(ic).toMatchObject({ intent: null, shown, differs: false });
      expect(listing.outOfSync).toBe(false);
      expect(listing.pushAction).toBeNull();
    }
  );

  it("shows the recorded intent over Pinball Map's value", () => {
    expect(derive({ icEnabled: false, icIntent: "on" }).ic).toMatchObject({
      intent: "on",
      shown: "on",
      pinballMap: "off",
    });
  });

  it("is Insider Connected differs, with the Update push, when the entry's target differs", () => {
    const { ic, listing } = derive({ icEnabled: null, icIntent: "on" });
    expect(ic).toMatchObject({
      target: "on",
      pinballMap: "not_set",
      differs: true,
    });
    expect(listing.name).toBe("on");
    expect(listing.outOfSync).toBe(true);
    expect(listing.pushAction).toBe("update");
  });

  it("treats an Off intent against a never-set entry as differing", () => {
    expect(derive({ icEnabled: null, icIntent: "off" }).ic?.differs).toBe(true);
  });

  it("is in sync when the target matches", () => {
    const { ic, listing } = derive({ icEnabled: true, icIntent: "on" });
    expect(ic?.differs).toBe(false);
    expect(listing.outOfSync).toBe(false);
  });

  it("takes the target from a sibling when this cabinet has no intent", () => {
    const { ic } = derive({
      icEnabled: false,
      icIntent: null,
      siblingIntents: [null, "on"],
    });
    expect(ic).toMatchObject({
      intent: null,
      shown: "off",
      target: "on",
      differs: true,
    });
  });

  it("stays shown, without a Pinball Map value, when the entry is Missing", () => {
    // Missing owns the push (Add, which also applies the target).
    const { ic, listing } = derive({ present: false, icIntent: "on" });
    expect(ic).toMatchObject({ shown: "on", pinballMap: null, differs: false });
    expect(listing.pushAction).toBe("add");
  });

  it("stays shown when the cabinet is Off the lineup", () => {
    const { ic } = derive({ intent: "off", present: false, icIntent: "on" });
    expect(ic).toMatchObject({ shown: "on", differs: false });
  });

  it("does not flag under Don't sync", () => {
    const { ic, listing } = derive({
      intent: "no_sync",
      icEnabled: null,
      icIntent: "on",
    });
    expect(ic?.differs).toBe(false);
    expect(listing.outOfSync).toBe(false);
  });

  it("leaves Lingering's Remove push alone", () => {
    const { ic, listing } = derive({
      intent: "off",
      icEnabled: null,
      icIntent: "on",
    });
    expect(ic?.differs).toBe(false);
    expect(listing.pushAction).toBe("remove");
  });

  it("reads no Pinball Map value while the integration is not configured", () => {
    expect(
      derive({ icEnabled: true, icIntent: "on", configured: false }).ic
    ).toMatchObject({ shown: "on", pinballMap: null, differs: false });
  });
});
