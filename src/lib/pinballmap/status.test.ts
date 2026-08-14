import { describe, it, expect } from "vitest";
import {
  derivePbmListingState,
  derivePbmMachineStatus,
  isActionableDesync,
  shouldBeListedOnPbm,
  type PbmMachineStatus,
  type PbmListingState,
} from "./status";
import type { LocationSnapshot } from "./types";
import type { ListingHolderCandidate } from "./listing-holder";
import type { MachinePresenceStatus } from "~/lib/machines/presence";

const snap = (rows: { id: number; machineId: number }[]): LocationSnapshot => ({
  locationId: 26454,
  name: "APC",
  dateLastUpdated: null,
  lastUpdatedByUsername: null,
  machineCount: rows.length,
  lmxes: rows.map((r) => ({
    ...r,
    icEnabled: null,
    lastUpdatedByUsername: null,
    conditions: [],
  })),
  fetchedAtIso: "2026-07-16T00:00:00Z",
  raw: {},
});

describe("derivePbmMachineStatus", () => {
  it("ok: listed locally, lmx present and matching", () => {
    const s = derivePbmMachineStatus({
      pinballmapMachineId: 42,
      pinballmapListed: true,
      pinballmapLmxId: 900,
      snapshot: snap([{ id: 900, machineId: 42 }]),
    });
    expect(s).toEqual({
      onPbm: true,
      lmxId: 900,
      desynced: false,
      reason: "ok",
    });
  });

  it("desync: listed locally but title absent from lineup", () => {
    const s = derivePbmMachineStatus({
      pinballmapMachineId: 42,
      pinballmapListed: true,
      pinballmapLmxId: 900,
      snapshot: snap([]),
    });
    expect(s.desynced).toBe(true);
    expect(s.reason).toBe("listed_locally_absent_on_pbm");
  });

  it("desync: on PBM but not listed locally", () => {
    const s = derivePbmMachineStatus({
      pinballmapMachineId: 42,
      pinballmapListed: false,
      pinballmapLmxId: null,
      snapshot: snap([{ id: 900, machineId: 42 }]),
    });
    expect(s.reason).toBe("on_pbm_not_listed_locally");
    expect(s.desynced).toBe(true);
    expect(s.lmxId).toBe(900);
  });

  it("lmx_drifted: listed, title present but under a different lmx id than stored", () => {
    const s = derivePbmMachineStatus({
      pinballmapMachineId: 42,
      pinballmapListed: true,
      pinballmapLmxId: 900,
      snapshot: snap([{ id: 999, machineId: 42 }]),
    });
    expect(s.reason).toBe("lmx_drifted");
    expect(s.desynced).toBe(true);
    expect(s.lmxId).toBe(999);
  });

  it("unlinked: no catalog title", () => {
    const s = derivePbmMachineStatus({
      pinballmapMachineId: null,
      pinballmapListed: false,
      pinballmapLmxId: null,
      snapshot: snap([]),
    });
    expect(s.reason).toBe("unlinked");
    expect(s.desynced).toBe(false);
  });

  it("null snapshot: not desynced (no data), reason ok", () => {
    const s = derivePbmMachineStatus({
      pinballmapMachineId: 42,
      pinballmapListed: true,
      pinballmapLmxId: 900,
      snapshot: null,
    });
    expect(s.desynced).toBe(false);
    expect(s.reason).toBe("ok");
  });
});

describe("isActionableDesync", () => {
  const status = (reason: PbmMachineStatus["reason"]): PbmMachineStatus => ({
    onPbm: true,
    lmxId: 1,
    desynced: reason !== "ok" && reason !== "unlinked",
    reason,
  });

  it("raises the two a person has to resolve", () => {
    expect(isActionableDesync(status("listed_locally_absent_on_pbm"))).toBe(
      true
    );
    expect(isActionableDesync(status("on_pbm_not_listed_locally"))).toBe(true);
  });

  it("stays quiet about lmx drift, which the next cron heals", () => {
    // `desynced` is true here, so this is the case that separates "disagrees"
    // from "worth telling someone". `reconcileAfterSync` repairs it on the very
    // next hourly run; surfacing it would report a transient to someone who can
    // do nothing about it.
    const drifted = status("lmx_drifted");
    expect(drifted.desynced).toBe(true);
    expect(isActionableDesync(drifted)).toBe(false);
  });

  it("stays quiet when nothing disagrees", () => {
    expect(isActionableDesync(status("ok"))).toBe(false);
    expect(isActionableDesync(status("unlinked"))).toBe(false);
  });
});

describe("derivePbmListingState", () => {
  const listingState = (
    over: Partial<Parameters<typeof derivePbmListingState>[0]> = {}
  ): ReturnType<typeof derivePbmListingState> =>
    derivePbmListingState({
      pinballmapMachineId: 42,
      pinballmapExcluded: false,
      pinballmapListed: true,
      pinballmapLmxId: 900,
      snapshot: snap([{ id: 900, machineId: 42 }]),
      ...over,
    });

  it("listed and agreeing", () => {
    expect(listingState()).toBe("listed");
  });

  it("matched with the title off the lineup", () => {
    expect(
      listingState({
        pinballmapListed: false,
        pinballmapLmxId: null,
        snapshot: snap([]),
      })
    ).toBe("not_listed");
  });

  it("we hold a listing the lineup no longer shows", () => {
    expect(listingState({ snapshot: snap([]) })).toBe("missing_on_pbm");
  });

  it("the lineup shows the title but no machine holds it", () => {
    expect(
      listingState({ pinballmapListed: false, pinballmapLmxId: null })
    ).toBe("unclaimed_on_pbm");
  });

  it("separates 'no model yet' from 'deliberately not on their catalog'", () => {
    // Same "nothing to list", different reason — and the reason is the half a
    // reader can act on.
    expect(
      listingState({
        pinballmapMachineId: null,
        pinballmapListed: false,
        pinballmapLmxId: null,
      })
    ).toBe("unmatched");
    expect(
      listingState({
        pinballmapMachineId: null,
        pinballmapExcluded: true,
        pinballmapListed: false,
        pinballmapLmxId: null,
      })
    ).toBe("not_on_pbm");
  });

  it("reports unsynced rather than guessing with no stored lineup", () => {
    // The old control answered "Not listed" here, for a fleet that was listed.
    expect(listingState({ snapshot: null })).toBe("unsynced");
    expect(
      listingState({
        pinballmapListed: false,
        pinballmapLmxId: null,
        snapshot: null,
      })
    ).toBe("unsynced");
  });

  it("reads lmx drift as plain 'listed'", () => {
    // The machine IS on the lineup; only the row id moved, and the next hourly
    // reconcile repairs the handle. Surfacing it would put a warning in front
    // of someone with nothing to do about it (see `isActionableDesync`).
    expect(listingState({ snapshot: snap([{ id: 999, machineId: 42 }]) })).toBe(
      "listed"
    );
  });
});

describe("shouldBeListedOnPbm", () => {
  it("reflects local listing intent, independent of presence", () => {
    expect(shouldBeListedOnPbm({ pinballmapListed: true })).toBe(true);
    expect(shouldBeListedOnPbm({ pinballmapListed: false })).toBe(false);
  });
});

/**
 * Why a lineup entry sits unclaimed (PP-o355.21).
 *
 * These four used to be one state answering "Claim this listing" to all of
 * them, which is the wrong action for two. The split exists because Tim asked
 * what actually causes the state — the honest answer was three causes, not the
 * one the code comment claimed.
 */
describe("derivePbmListingState — why an entry is unclaimed", () => {
  const TITLE = 4242;
  const snapshot = snap([{ id: 900, machineId: TITLE }]);

  const cabinet = (
    id: string,
    presenceStatus: MachinePresenceStatus,
    pinballmapListed = false
  ): ListingHolderCandidate => ({
    id,
    pinballmapMachineId: TITLE,
    pinballmapListed,
    presenceStatus,
  });

  const derive = (
    machineId: string,
    group: ListingHolderCandidate[]
  ): PbmListingState =>
    derivePbmListingState({
      machineId,
      pinballmapMachineId: TITLE,
      pinballmapExcluded: false,
      pinballmapListed: false,
      pinballmapLmxId: null,
      snapshot,
      sameTitleGroup: group,
    });

  it("is the plain transient state when this machine is the lone candidate", () => {
    // Auto-link takes this on the next reconcile, so the control says so and
    // offers Claim as "do it now" rather than as a repair.
    expect(derive("a", [cabinet("a", "on_the_floor")])).toBe(
      "unclaimed_on_pbm"
    );
  });

  it("is a tie when two cabinets share the top presence rank", () => {
    const group = [cabinet("a", "on_the_floor"), cabinet("b", "on_the_floor")];
    // Both sides see the tie — either one can break it.
    expect(derive("a", group)).toBe("unclaimed_tie");
    expect(derive("b", group)).toBe("unclaimed_tie");
  });

  it("is not a tie when one cabinet outranks the other", () => {
    const group = [cabinet("a", "on_the_floor"), cabinet("b", "off_the_floor")];
    // The floor cabinet is the pick; the off-floor one must not offer Claim,
    // which would put the listing on the wrong machine.
    expect(derive("a", group)).toBe("unclaimed_on_pbm");
    expect(derive("b", group)).toBe("unclaimed_elsewhere");
  });

  it("is unavailable when no cabinet of the title may hold a listing", () => {
    // The case Tim named: Pinball Map shows a game our own records say is not
    // on the floor. Claiming would record a listing we believe should not
    // exist, so the state exists to say the entry should come down instead.
    expect(
      derive("a", [cabinet("a", "removed"), cabinet("b", "pending_arrival")])
    ).toBe("unclaimed_unavailable");
  });

  it("falls back to the undifferentiated state when no group is supplied", () => {
    // Every caller outside the Manage tab passes no group and must keep
    // getting the old single state rather than a crash or a wrong reason.
    expect(
      derivePbmListingState({
        pinballmapMachineId: TITLE,
        pinballmapExcluded: false,
        pinballmapListed: false,
        pinballmapLmxId: null,
        snapshot,
      })
    ).toBe("unclaimed_on_pbm");
  });
});
