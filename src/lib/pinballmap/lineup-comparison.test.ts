/**
 * Unit: the lineup page's comparison (PP-o355.65,
 * docs/feature-specs/pinballmap-lineup.md §4–§6).
 *
 * The per-cabinet rules (Alert, Flag, coverage, Insider Connected) are owned by
 * `listing-state.test.ts` and `insider-connected.test.ts`. These cases cover
 * what this module adds on top: folding cabinets into one title verdict, which
 * section each title, entry or machine lands in, and the tallies around them.
 */

import { describe, expect, it } from "vitest";

import type { MachinePresenceStatus } from "~/lib/machines/presence";

import {
  compareLineup,
  deriveTitleIntent,
  type LineupCatalogTitle,
  type LineupComparison,
  type LineupMachineInput,
  type LineupReady,
} from "./lineup-comparison";
import type { PbmIcIntent } from "./insider-connected";
import type { PbmListingIntent } from "./listing-state";
import type { LocationSnapshot, PbmLmx } from "./types";

function entry(
  machineId: number,
  id: number,
  opts: { comments?: number; ic?: boolean | null } = {}
): PbmLmx {
  return {
    id,
    machineId,
    icEnabled: opts.ic ?? null,
    lastUpdatedByUsername: null,
    conditions: Array.from({ length: opts.comments ?? 0 }, (_, i) => ({
      id: id * 100 + i,
      comment: "ok",
      username: null,
      createdAtIso: "2026-09-01T00:00:00.000Z",
    })),
  };
}

function snapshot(lmxes: PbmLmx[]): LocationSnapshot {
  return {
    locationId: 26454,
    name: "Austin Pinball Collective",
    dateLastUpdated: "2026-09-18",
    lastUpdatedByUsername: null,
    machineCount: lmxes.length,
    lmxes,
    fetchedAtIso: "2026-09-27T00:00:00.000Z",
    raw: null,
  };
}

function machine(
  initials: string,
  title: number | null,
  intent: PbmListingIntent,
  opts: {
    presence?: MachinePresenceStatus;
    ic?: PbmIcIntent | null;
    excluded?: boolean;
  } = {}
): LineupMachineInput {
  return {
    id: `id-${initials}`,
    initials,
    name: `Machine ${initials}`,
    presenceStatus: opts.presence ?? "on_the_floor",
    pinballmapMachineId: title,
    pinballmapExcluded: opts.excluded ?? false,
    intent,
    icIntent: opts.ic ?? null,
  };
}

function title(
  id: number,
  name: string,
  opts: { group?: number; ic?: boolean } = {}
): LineupCatalogTitle {
  return {
    pinballmapMachineId: id,
    name,
    manufacturer: "Stern",
    year: 2019,
    machineGroupId: opts.group ?? null,
    icEligible: opts.ic ?? false,
  };
}

function ready(result: LineupComparison): LineupReady {
  if (result.status !== "ready") throw new Error(`status ${result.status}`);
  return result;
}

function compare(
  machines: LineupMachineInput[],
  lmxes: PbmLmx[],
  catalog: LineupCatalogTitle[] = []
): LineupReady {
  return ready(
    compareLineup({
      configured: true,
      snapshot: snapshot(lmxes),
      machines,
      catalog,
    })
  );
}

/** Every section's rows as `key` strings, for membership assertions. */
function keys(result: LineupReady): Record<string, string[]> {
  return {
    out_of_sync: result.sections.out_of_sync.map((r) => r.key),
    pinpoint_only: result.sections.pinpoint_only.map((r) => r.key),
    pinball_map_only: result.sections.pinball_map_only.map((r) => r.key),
    availability_conflict: result.sections.availability_conflict.map(
      (r) => r.key
    ),
  };
}

describe("deriveTitleIntent (§1 Title intent)", () => {
  it.each<[PbmListingIntent[], PbmListingIntent]>([
    [["on", "off", "no_sync"], "on"],
    [["off", "no_sync"], "off"],
    [["off", "off"], "off"],
    [["no_sync", "no_sync"], "no_sync"],
  ])("%j → %s", (intents, expected) => {
    expect(deriveTitleIntent(intents)).toBe(expected);
  });
});

describe("compareLineup status (§2.4, §2.5)", () => {
  it("is not configured without a tracked location", () => {
    const result = compareLineup({
      configured: false,
      snapshot: snapshot([entry(1, 10)]),
      machines: [machine("AA", 1, "on")],
      catalog: [],
    });
    expect(result).toEqual({ status: "not_configured" });
  });

  it("is waiting without a stored lineup", () => {
    const result = compareLineup({
      configured: true,
      snapshot: null,
      machines: [machine("AA", 1, "on")],
      catalog: [],
    });
    expect(result).toEqual({ status: "waiting" });
  });
});

describe("Out of sync (§5.2)", () => {
  it("tags a title set On that is not on Pinball Map To add", () => {
    const result = compare([machine("DP", 1, "on")], []);
    expect(result.sections.out_of_sync).toMatchObject([
      { tag: "to_add", title: { id: 1 }, commentCount: null },
    ]);
  });

  it("tags a title set Off that is on Pinball Map To remove, with its comments", () => {
    const result = compare(
      [machine("EBD", 2, "off", { presence: "off_the_floor" })],
      [entry(2, 20, { comments: 3 })]
    );
    expect(result.sections.out_of_sync).toMatchObject([
      { tag: "to_remove", title: { id: 2 }, commentCount: 3 },
    ]);
  });

  it("tags a title whose only cabinets are Removed To remove", () => {
    const result = compare(
      [
        machine("R1", 3, "off", { presence: "removed" }),
        machine("R2", 3, "no_sync", { presence: "removed" }),
      ],
      [entry(3, 30)]
    );
    expect(keys(result).out_of_sync).toEqual(["to_remove-3"]);
    expect(result.notCompared.removed).toBe(0);
  });

  it("leaves a Removed-only title off Pinball Map uncompared, counted as removed", () => {
    const result = compare(
      [machine("R1", 3, "off", { presence: "removed" })],
      []
    );
    expect(result.toReview).toBe(0);
    expect(result.inSync).toEqual([]);
    expect(result.notCompared.removed).toBe(1);
  });

  it("decides a mixed title from its cabinets not marked Removed", () => {
    // The Removed cabinet is Off; the one still here is Don't sync, so the
    // title is Don't sync and nothing is compared.
    const result = compare(
      [
        machine("AA", 4, "no_sync"),
        machine("AB", 4, "off", { presence: "removed" }),
      ],
      [entry(4, 40)]
    );
    expect(result.toReview).toBe(0);
    expect(result.notCompared.dontSync).toBe(1);
    expect(result.notCompared.removed).toBe(1);
  });

  it("tags an On title on Pinball Map whose Insider Connected target differs To update", () => {
    const result = compare(
      [machine("FFP", 5, "on", { ic: "on" }), machine("FFL", 5, "off")],
      [entry(5, 50, { ic: false, comments: 5 })],
      [title(5, "Foo Fighters (Premium)", { ic: true })]
    );
    expect(result.sections.out_of_sync).toMatchObject([
      { tag: "to_update", icTarget: "on", commentCount: 5 },
    ]);
  });

  it("is in sync when Insider Connected matches, or no cabinet has an intent", () => {
    const result = compare(
      [machine("AA", 6, "on", { ic: "off" }), machine("BB", 7, "on")],
      [entry(6, 60, { ic: false }), entry(7, 70, { ic: true })],
      [title(6, "Six", { ic: true }), title(7, "Seven", { ic: true })]
    );
    expect(result.toReview).toBe(0);
    expect(result.inSync.map((t) => t.title.id)).toEqual([7, 6]);
  });

  it("ignores Insider Connected on an ineligible title", () => {
    const result = compare(
      [machine("AA", 6, "on", { ic: "on" })],
      [entry(6, 60, { ic: false })],
      [title(6, "Six", { ic: false })]
    );
    expect(result.toReview).toBe(0);
  });

  it("counts only cabinets not in Availability conflict toward the title intent", () => {
    // GZ is On and on the floor; GZ2 is On and Removed. The title is still To
    // add through GZ, and GZ2 is its own Alert row.
    const result = compare(
      [
        machine("GZ", 8, "on"),
        machine("GZ2", 8, "on", { presence: "removed" }),
      ],
      []
    );
    expect(keys(result)).toEqual({
      out_of_sync: ["to_add-8"],
      pinpoint_only: [],
      pinball_map_only: [],
      availability_conflict: ["conflict-id-GZ2"],
    });
    expect(result.sections.out_of_sync[0]?.cabinets.map((c) => c.id)).toEqual([
      "id-GZ",
    ]);
  });

  it("does not list a title whose only cabinets are in Availability conflict", () => {
    const result = compare(
      [machine("AFM", 9, "on", { presence: "removed" })],
      [entry(9, 90, { comments: 2 })]
    );
    expect(keys(result).out_of_sync).toEqual([]);
    expect(result.sections.availability_conflict).toMatchObject([
      { tag: "alert", commentCount: 2 },
    ]);
  });

  it("removes an entry an Off cabinet holds even while an On cabinet is in conflict", () => {
    const result = compare(
      [
        machine("TZ", 10, "off"),
        machine("TZ2", 10, "on", { presence: "pending_arrival" }),
      ],
      [entry(10, 100)]
    );
    expect(keys(result).out_of_sync).toEqual(["to_remove-10"]);
    expect(keys(result).availability_conflict).toEqual(["conflict-id-TZ2"]);
  });

  it("orders rows To add, To remove, To update, then by title", () => {
    const result = compare(
      [
        machine("A", 11, "off"),
        machine("B", 12, "on"),
        machine("C", 13, "on", { ic: "on" }),
        machine("D", 14, "on"),
      ],
      [entry(11, 110), entry(13, 130, { ic: false })],
      [
        title(11, "Alpha"),
        title(12, "Zulu"),
        title(13, "Bravo", { ic: true }),
        title(14, "Mike"),
      ]
    );
    expect(keys(result).out_of_sync).toEqual([
      "to_add-14",
      "to_add-12",
      "to_remove-11",
      "to_update-13",
    ]);
  });
});

describe("In PinPoint, not linked (§5.3)", () => {
  it("holds unmatched machines not Removed, not uncataloged, not Don't sync", () => {
    const result = compare(
      [
        machine("S76", null, "off", { presence: "off_the_floor" }),
        machine("GONE", null, "off", { presence: "removed" }),
        machine("BT", null, "off", { excluded: true }),
        machine("NS", null, "no_sync"),
      ],
      []
    );
    expect(keys(result).pinpoint_only).toEqual(["machine-id-S76"]);
    expect(result.notCompared.uncataloged.map((m) => m.initials)).toEqual([
      "BT",
    ]);
    expect(result.notCompared.dontSync).toBe(1);
    expect(result.notCompared.removed).toBe(1);
  });
});

describe("On Pinball Map, not linked (§5.4)", () => {
  it("holds each entry no machine is matched to, and never matches one", () => {
    const result = compare(
      [
        machine("JP", 21, "on"),
        machine("JP2", 22, "off"),
        machine("OLD", 23, "off", { presence: "removed" }),
      ],
      [entry(21, 210), entry(20, 200, { comments: 3 }), entry(30, 300)],
      [
        title(20, "Jurassic Park (Pro)", { group: 7 }),
        title(21, "Jurassic Park (Premium)", { group: 7 }),
        title(22, "Jurassic Park (LE)", { group: 7 }),
        title(23, "Jurassic Park (Home)", { group: 7 }),
        title(30, "Cactus Canyon"),
      ]
    );
    expect(result.sections.pinball_map_only).toMatchObject([
      {
        lmxId: 200,
        title: { id: 20, name: "Jurassic Park (Pro)" },
        commentCount: 3,
        // Removed machines are out of scope, so OLD is not named.
        possibleMatches: [
          { initials: "JP", edition: "Premium" },
          { initials: "JP2", edition: "LE" },
        ],
      },
      { lmxId: 300, title: { name: "Cactus Canyon" }, possibleMatches: [] },
    ]);
    // Naming possible matches changes nothing about JP's own title.
    expect(keys(result).out_of_sync).toEqual([]);
  });

  it("treats an entry whose title a Removed machine carries as that title's, not unlinked", () => {
    const result = compare(
      [machine("OLD", 20, "off", { presence: "removed" })],
      [entry(20, 200)]
    );
    expect(keys(result).pinball_map_only).toEqual([]);
    expect(keys(result).out_of_sync).toEqual(["to_remove-20"]);
  });
});

describe("Availability conflict (§5.5)", () => {
  it.each<[MachinePresenceStatus, "alert" | "note"]>([
    ["removed", "alert"],
    ["pending_arrival", "alert"],
    ["on_loan", "note"],
    ["off_the_floor", "note"],
  ])("tags an On machine that is %s as %s", (presence, tag) => {
    const result = compare(
      [machine("TZ", 40, "on", { presence })],
      [entry(40, 400, { comments: 9 })]
    );
    expect(result.sections.availability_conflict).toMatchObject([
      { tag, machine: { initials: "TZ" }, commentCount: 9 },
    ]);
  });

  it("holds one row per machine, Alerts first", () => {
    const result = compare(
      [
        machine("A1", 41, "on", { presence: "on_loan" }),
        machine("A2", 41, "on", { presence: "removed" }),
        machine("A3", 42, "off", { presence: "removed" }),
        machine("A4", 43, "no_sync", { presence: "on_loan" }),
      ],
      [entry(41, 410)]
    );
    expect(keys(result).availability_conflict).toEqual([
      "conflict-id-A2",
      "conflict-id-A1",
    ]);
  });

  it("omits the comment count when the title is not on Pinball Map", () => {
    const result = compare(
      [machine("GZ2", 44, "on", { presence: "removed" })],
      []
    );
    expect(result.sections.availability_conflict[0]?.commentCount).toBeNull();
  });
});

describe("In sync and not compared (§6)", () => {
  it("splits in-sync titles into on and not on Pinball Map", () => {
    const result = compare(
      [machine("ON", 50, "on"), machine("OFF", 51, "off")],
      [entry(50, 500, { comments: 1 })],
      [title(50, "Alpha"), title(51, "Beta")]
    );
    expect(result.inSync).toMatchObject([
      { title: { id: 50 }, onPinballMap: true, commentCount: 1 },
      { title: { id: 51 }, onPinballMap: false, commentCount: null },
    ]);
  });

  it("excludes titles set to Don't sync whatever Pinball Map shows", () => {
    const result = compare(
      [machine("NS1", 52, "no_sync"), machine("NS2", 53, "no_sync")],
      [entry(52, 520)]
    );
    expect(result.toReview).toBe(0);
    expect(result.inSync).toEqual([]);
    expect(result.notCompared.dontSync).toBe(2);
  });

  it("counts a Don't sync title still on Pinball Map when only Removed machines hold it", () => {
    const result = compare(
      [
        machine("GONE", 54, "no_sync", { presence: "removed" }),
        machine("GONE2", 55, "no_sync", { presence: "removed" }),
      ],
      [entry(54, 540)]
    );
    expect(result.sections.pinball_map_only).toEqual([]);
    expect(result.notCompared.dontSync).toBe(1);
  });

  it("leaves titles slated for removal out of the Insider Connected summary", () => {
    const result = compare(
      [machine("OFF", 65, "off")],
      [entry(65, 650, { ic: true })],
      [title(65, "Off title", { ic: true })]
    );
    expect(result.sections.out_of_sync).toMatchObject([{ tag: "to_remove" }]);
    expect(result.insiderConnected.titles).toBe(0);
  });

  it("states Pinball Map's Insider Connected values for eligible titles with no intent (§6.3)", () => {
    const result = compare(
      [machine("A", 60, "on"), machine("B", 61, "on", { ic: "on" })],
      [
        entry(60, 600, { ic: true }),
        entry(61, 610, { ic: true }),
        entry(62, 620, { ic: false }),
        entry(63, 630, { ic: null }),
        entry(64, 640, { ic: true }),
      ],
      [
        title(60, "A", { ic: true }),
        title(61, "B", { ic: true }),
        title(62, "C", { ic: true }),
        title(63, "D", { ic: true }),
        title(64, "E", { ic: false }),
      ]
    );
    expect(result.insiderConnected).toEqual({
      titles: 3,
      onPinballMap: { on: 1, off: 1, not_set: 1 },
    });
  });
});

describe("to review count (§4.1)", () => {
  it("is every row across the four sections", () => {
    const result = compare(
      [
        machine("ADD", 70, "on"),
        machine("S76", null, "off"),
        machine("TZ", 71, "on", { presence: "on_loan" }),
        machine("OK", 72, "on"),
      ],
      [entry(72, 720), entry(73, 730), entry(74, 740)]
    );
    expect(result.sections.out_of_sync).toHaveLength(1);
    expect(result.sections.pinpoint_only).toHaveLength(1);
    expect(result.sections.pinball_map_only).toHaveLength(2);
    expect(result.sections.availability_conflict).toHaveLength(1);
    expect(result.toReview).toBe(5);
  });
});
