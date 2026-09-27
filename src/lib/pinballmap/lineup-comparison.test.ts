/**
 * Unit: the lineup page's comparison (PP-o355.65,
 * docs/feature-specs/pinballmap-lineup.md §4–§6).
 *
 * The per-cabinet rules (Alert, Flag, coverage, Insider Connected) are owned by
 * `listing-state.test.ts` and `insider-connected.test.ts`. These cases cover
 * what this module adds on top: folding cabinets into one title verdict, the
 * group each verdict lands in, the matrix, and the entries no cabinet owns.
 */

import { describe, expect, it } from "vitest";

import type { MachinePresenceStatus } from "~/lib/machines/presence";

import {
  compareLineup,
  deriveTitleIntent,
  lineupCellTone,
  type LineupAbandonedRecord,
  type LineupCatalogTitle,
  type LineupComparison,
  type LineupMachineInput,
  type LineupReady,
  type LineupRow,
} from "./lineup-comparison";
import type { PbmIcIntent } from "./insider-connected";
import type { PbmListingIntent } from "./listing-state";
import type { LocationSnapshot, PbmLmx } from "./types";

const LOCATION = 26454;
const OLD_LOCATION = 11111;

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
    locationId: LOCATION,
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
    manufacturer: null,
    year: null,
    machineGroupId: opts.group ?? null,
    icEligible: opts.ic ?? false,
  };
}

function compare(args: {
  lmxes: PbmLmx[];
  machines: LineupMachineInput[];
  catalog?: LineupCatalogTitle[];
  abandoned?: LineupAbandonedRecord[];
}): LineupReady {
  const result = compareLineup({
    configured: true,
    trackedLocationId: LOCATION,
    snapshot: snapshot(args.lmxes),
    machines: args.machines,
    catalog: args.catalog ?? [],
    abandoned: args.abandoned ?? [],
  });
  if (result.status !== "ready") throw new Error(`got ${result.status}`);
  return result;
}

function reasons(result: LineupReady): string[] {
  return result.rows.map((row) => `${row.reason}:${row.title.name}`);
}

function only(result: LineupReady): LineupRow {
  expect(result.rows).toHaveLength(1);
  const [row] = result.rows;
  if (row === undefined) throw new Error("no row");
  return row;
}

describe("deriveTitleIntent (§1)", () => {
  it.each<[PbmListingIntent[], string]>([
    [["on", "off", "no_sync"], "on"],
    [["off", "no_sync"], "off"],
    [["off"], "off"],
    [["no_sync", "no_sync"], "no_sync"],
  ])("%j → %s", (intents, expected) => {
    expect(deriveTitleIntent(intents)).toBe(expected);
  });
});

describe("integration states (§2.4, §2.5)", () => {
  const base = {
    trackedLocationId: LOCATION,
    machines: [machine("AFM", 1, "on")],
    catalog: [],
    abandoned: [],
  };

  it("is Not configured without a tracked location, even with a retained snapshot", () => {
    const result: LineupComparison = compareLineup({
      ...base,
      configured: false,
      trackedLocationId: null,
      snapshot: snapshot([entry(1, 10)]),
    });
    expect(result).toEqual({ status: "not_configured" });
  });

  it("is Waiting while configured without a snapshot", () => {
    expect(
      compareLineup({ ...base, configured: true, snapshot: null })
    ).toEqual({ status: "waiting" });
  });
});

describe("fix groups (§5)", () => {
  it("puts an On title missing from the lineup in To add, carrying its IC target", () => {
    const row = only(
      compare({
        lmxes: [],
        machines: [machine("NSTAR", 5, "on", { ic: "on" })],
        catalog: [title(5, "North Star")],
      })
    );
    expect(row).toMatchObject({
      reason: "missing",
      icTarget: "on",
      cells: ["on:not_on_pbm"],
      commentCount: null,
    });
  });

  it("puts an Off title still on the lineup in To remove, with its comment count", () => {
    const row = only(
      compare({
        lmxes: [entry(7, 70, { comments: 3 })],
        machines: [machine("EBD", 7, "off")],
        catalog: [title(7, "Eight Ball Deluxe")],
      })
    );
    expect(row).toMatchObject({
      reason: "lingering",
      lmxId: 70,
      commentCount: 3,
      cells: ["off:on_pbm"],
    });
  });

  it("puts an unmatched entry a re-matched machine left behind in To remove", () => {
    const result = compare({
      lmxes: [entry(8, 80, { comments: 6 })],
      machines: [machine("CC", 9, "off")],
      catalog: [title(8, "Cactus Canyon")],
      abandoned: [
        {
          machineId: "id-CC",
          lmxId: 80,
          pinballmapMachineId: 8,
          locationId: LOCATION,
        },
      ],
    });
    expect(only(result)).toMatchObject({
      reason: "left_behind",
      lmxId: 80,
      commentCount: 6,
      cells: ["none:on_pbm"],
    });
    expect(result.groupCounts.to_remove).toBe(1);
  });

  it("finds a left-behind entry by title when Pinball Map reissued its id", () => {
    const result = compare({
      lmxes: [entry(8, 81, { comments: 2 })],
      machines: [machine("CC", 9, "off")],
      catalog: [title(8, "Cactus Canyon"), title(9, "Cactus Canyon (Remake)")],
      abandoned: [
        {
          machineId: "id-CC",
          lmxId: 80,
          pinballmapMachineId: 8,
          locationId: LOCATION,
        },
      ],
    });
    expect(result.rows).toEqual([
      expect.objectContaining({
        reason: "left_behind",
        // The recorded id, which is what the removal action authorizes.
        lmxId: 80,
        commentCount: 2,
        cells: ["none:on_pbm"],
        abandonedBy: { id: "id-CC", initials: "CC", name: "Machine CC" },
      }),
    ]);
    expect(result.matrix["none:on_pbm"]).toBe(1);
  });

  it("puts an entry recorded at a previous location in To remove, counted in no cell", () => {
    const result = compare({
      lmxes: [],
      machines: [machine("SS", null, "off")],
      catalog: [title(12, "Scared Stiff")],
      abandoned: [
        {
          machineId: "id-SS",
          lmxId: 120,
          pinballmapMachineId: 12,
          locationId: OLD_LOCATION,
        },
      ],
    });
    expect(result.rows).toEqual([
      expect.objectContaining({
        reason: "previous_location",
        lmxId: 120,
        locationId: OLD_LOCATION,
        cells: [],
        commentCount: null,
      }),
    ]);
    expect(result.matrix["none:on_pbm"]).toBe(0);
  });

  it("puts an On title whose Insider Connected target differs in To update", () => {
    const row = only(
      compare({
        lmxes: [entry(20, 200, { ic: false, comments: 5 })],
        machines: [machine("FFP", 20, "on", { ic: "on" })],
        catalog: [title(20, "Foo Fighters (Premium)", { ic: true })],
      })
    );
    expect(row).toMatchObject({
      reason: "ic_differs",
      icTarget: "on",
      icOnPinballMap: "off",
      cells: ["on:on_pbm"],
    });
  });

  it("puts an On title with a Removed On cabinet in Needs a decision, on or off the lineup", () => {
    const result = compare({
      lmxes: [entry(30, 300)],
      machines: [
        machine("AFM", 30, "on", { presence: "removed" }),
        machine("MM", 31, "on", { presence: "pending_arrival" }),
      ],
      catalog: [title(30, "Attack from Mars"), title(31, "Medieval Madness")],
    });
    expect(result.rows).toEqual([
      expect.objectContaining({ reason: "alert", lmxId: 300 }),
      expect.objectContaining({ reason: "alert", lmxId: null }),
    ]);
    expect(result.groupCounts.needs_decision).toBe(2);
  });

  it("pairs a Missing title with a same-family unmatched entry as one near-miss row", () => {
    const result = compare({
      lmxes: [entry(41, 410, { comments: 3 })],
      machines: [machine("JP", 40, "on")],
      catalog: [
        title(40, "Jurassic Park (Premium)", { group: 4 }),
        title(41, "Jurassic Park (Pro)", { group: 4 }),
      ],
    });
    const row = only(result);
    expect(row).toMatchObject({
      reason: "edition_near_miss",
      cells: ["on:not_on_pbm", "none:on_pbm"],
      entry: { lmxId: 410, commentCount: 3 },
    });
    // Two titles, each counted once (§4.2).
    expect(result.matrix["on:not_on_pbm"]).toBe(1);
    expect(result.matrix["none:on_pbm"]).toBe(1);
    expect(result.differenceCount).toBe(1);
  });

  it("does not pair a left-behind entry as a near-miss", () => {
    const result = compare({
      lmxes: [entry(41, 410)],
      machines: [machine("JP", 40, "on")],
      catalog: [
        title(40, "Jurassic Park (Premium)", { group: 4 }),
        title(41, "Jurassic Park (Pro)", { group: 4 }),
      ],
      abandoned: [
        {
          machineId: "id-JP",
          lmxId: 410,
          pinballmapMachineId: 41,
          locationId: LOCATION,
        },
      ],
    });
    expect(reasons(result)).toEqual([
      "missing:Jurassic Park (Premium)",
      "left_behind:Jurassic Park (Pro)",
    ]);
  });

  it("puts any other unmatched entry in Needs a decision", () => {
    const row = only(
      compare({
        lmxes: [entry(50, 500, { comments: 1 })],
        machines: [],
        catalog: [title(50, "Star Shooter")],
      })
    );
    expect(row).toMatchObject({
      reason: "unmatched_entry",
      lmxId: 500,
      cabinets: [],
      commentCount: 1,
      cells: ["none:on_pbm"],
    });
  });

  it("names an entry the catalog no longer carries by its id", () => {
    const row = only(compare({ lmxes: [entry(99, 990)], machines: [] }));
    expect(row.title.name).toBe("Pinball Map title #99");
  });

  it("puts an On title with an on-loan On cabinet in Worth a look, which is not a difference", () => {
    const result = compare({
      lmxes: [entry(60, 600)],
      machines: [machine("TZ", 60, "on", { presence: "on_loan" })],
      catalog: [title(60, "Twilight Zone")],
    });
    expect(only(result)).toMatchObject({
      reason: "flag",
      cells: ["on:on_pbm"],
    });
    expect(result.groupCounts.worth_a_look).toBe(1);
    expect(result.differenceCount).toBe(0);
    // Still counted where it is (§4.5).
    expect(result.matrix["on:on_pbm"]).toBe(1);
  });

  it("orders rows by group, then title", () => {
    const result = compare({
      lmxes: [entry(7, 70), entry(60, 600), entry(50, 500)],
      machines: [
        machine("TZ", 60, "on", { presence: "on_loan" }),
        machine("EBD", 7, "off"),
        machine("NS", 5, "on"),
        machine("AB", 6, "on"),
      ],
      catalog: [
        title(5, "North Star"),
        title(6, "Abra Ca Dabra"),
        title(7, "Eight Ball Deluxe"),
        title(50, "Star Shooter"),
        title(60, "Twilight Zone"),
      ],
    });
    expect(reasons(result)).toEqual([
      "missing:Abra Ca Dabra",
      "missing:North Star",
      "lingering:Eight Ball Deluxe",
      "unmatched_entry:Star Shooter",
      "flag:Twilight Zone",
    ]);
    expect(result.groupCounts).toEqual({
      to_add: 2,
      to_remove: 1,
      to_update: 0,
      needs_decision: 1,
      worth_a_look: 1,
    });
    expect(result.differenceCount).toBe(4);
  });
});

describe("multi-cabinet titles", () => {
  it("keeps a Shared title (two On cabinets) in sync as one title", () => {
    const result = compare({
      lmxes: [entry(70, 700, { comments: 12 })],
      machines: [machine("GZ", 70, "on"), machine("GZ2", 70, "on")],
      catalog: [title(70, "Godzilla (Premium)")],
    });
    expect(result.rows).toEqual([]);
    expect(result.inSync).toEqual([
      expect.objectContaining({
        cell: "on:on_pbm",
        commentCount: 12,
        cabinets: [
          expect.objectContaining({ initials: "GZ", state: "shared" }),
          expect.objectContaining({ initials: "GZ2", state: "shared" }),
        ],
      }),
    ]);
    expect(result.matrix["on:on_pbm"]).toBe(1);
  });

  it("reads a Covered title (one On, one Off) as title intent On and in sync", () => {
    const result = compare({
      lmxes: [entry(71, 710)],
      machines: [machine("TAF", 71, "on"), machine("TAF2", 71, "off")],
      catalog: [title(71, "Addams Family")],
    });
    expect(result.rows).toEqual([]);
    expect(result.inSync[0]?.cabinets.map((c) => c.state)).toEqual([
      "on",
      "covered",
    ]);
  });

  it("reads mixed Off and Don't sync as title intent Off — Lingering when on the lineup", () => {
    const result = compare({
      lmxes: [entry(72, 720)],
      machines: [machine("BK", 72, "off"), machine("BK2", 72, "no_sync")],
      catalog: [title(72, "Black Knight")],
    });
    expect(only(result)).toMatchObject({
      reason: "lingering",
      cells: ["off:on_pbm"],
    });
    expect(result.notCompared.dontSync).toEqual([]);
  });

  it("does not compare a title whose every cabinet is Don't sync", () => {
    const result = compare({
      lmxes: [entry(73, 730)],
      machines: [
        machine("X1", 73, "no_sync"),
        machine("X2", 74, "no_sync", { presence: "removed" }),
      ],
      catalog: [title(73, "Xenon"), title(74, "X-Files")],
    });
    expect(result.rows).toEqual([]);
    expect(result.inSync).toEqual([]);
    expect(result.notCompared.dontSync.map((s) => s.cell)).toEqual([
      "no_sync:not_on_pbm",
      "no_sync:on_pbm",
    ]);
  });

  it("needs a decision when any On cabinet is Removed, even beside an addable sibling", () => {
    // One On cabinet Removed is enough to need a decision (§5.5), even when a
    // second On cabinet on the floor could be added.
    const result = compare({
      lmxes: [],
      machines: [
        machine("DP", 75, "on"),
        machine("DP2", 75, "on", { presence: "removed" }),
      ],
      catalog: [title(75, "Deadpool (Pro)")],
    });
    expect(only(result).reason).toBe("alert");
  });
});

describe("comparison matrix (§4)", () => {
  it("counts every known title exactly once and reports the impossible cell as empty", () => {
    const result = compare({
      lmxes: [
        entry(1, 10),
        entry(2, 20),
        entry(4, 40),
        entry(50, 500),
        entry(51, 510),
      ],
      machines: [
        machine("A", 1, "on"),
        machine("A2", 1, "on"),
        machine("B", 2, "off"),
        machine("C", 3, "off"),
        machine("D", 4, "no_sync"),
        machine("E", 5, "on"),
        machine("F", null, "off"),
      ],
    });
    expect(result.matrix).toEqual({
      "on:on_pbm": 1,
      "on:not_on_pbm": 1,
      "off:on_pbm": 1,
      "off:not_on_pbm": 1,
      "none:on_pbm": 2,
      "none:not_on_pbm": null,
      "no_sync:on_pbm": 1,
      "no_sync:not_on_pbm": 0,
    });
  });

  it.each([
    ["on:on_pbm", "in_sync"],
    ["off:not_on_pbm", "in_sync"],
    ["on:not_on_pbm", "difference"],
    ["off:on_pbm", "difference"],
    ["none:on_pbm", "difference"],
    ["no_sync:on_pbm", "neutral"],
    ["none:not_on_pbm", "empty"],
  ] as const)("styles %s as %s (§4.3)", (cell, tone) => {
    expect(lineupCellTone(cell)).toBe(tone);
  });
});

describe("in sync and not compared (§6)", () => {
  it("splits in-sync titles by lineup presence", () => {
    const result = compare({
      lmxes: [entry(1, 10)],
      machines: [machine("A", 1, "on"), machine("B", 2, "off")],
    });
    expect(result.inSync.map((s) => s.cell)).toEqual([
      "on:on_pbm",
      "off:not_on_pbm",
    ]);
  });

  it("lists uncataloged machines and splits unmatched ones on removal", () => {
    const result = compare({
      lmxes: [],
      machines: [
        machine("BT", null, "off", { excluded: true }),
        machine("S76", null, "off"),
        machine("OLD", null, "off", { presence: "removed" }),
      ],
    });
    expect(result.notCompared.uncataloged.map((m) => m.initials)).toEqual([
      "BT",
    ]);
    expect(result.notCompared.unmatched.map((m) => m.initials)).toEqual([
      "S76",
    ]);
    expect(result.notCompared.unmatchedRemoved.map((m) => m.initials)).toEqual([
      "OLD",
    ]);
  });

  it("states Pinball Map's Insider Connected values for eligible titles nobody has an intent for", () => {
    const result = compare({
      lmxes: [
        entry(1, 10, { ic: true }),
        entry(2, 20, { ic: false }),
        entry(3, 30, { ic: null }),
        // Has an intent, so it is compared instead.
        entry(4, 40, { ic: true }),
        // Not eligible.
        entry(5, 50, { ic: null }),
      ],
      machines: [
        machine("A", 1, "on"),
        machine("B", 2, "on"),
        machine("D", 4, "on", { ic: "on" }),
        machine("E", 5, "on"),
      ],
      catalog: [
        title(1, "One", { ic: true }),
        title(2, "Two", { ic: true }),
        title(3, "Three", { ic: true }),
        title(4, "Four", { ic: true }),
        title(5, "Five"),
      ],
    });
    expect(result.insiderConnected).toEqual({
      titles: 3,
      onPinballMap: { on: 1, off: 1, not_set: 1 },
    });
  });
});
