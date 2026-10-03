import { describe, expect, it } from "vitest";
import { getMachineViewPreset } from "./config";
import {
  applyMachineViewState,
  healthFromSeverityCounts,
  summarizeMachineView,
  type MachineViewCandidate,
} from "./model";

function health(
  counts: Partial<Record<"cosmetic" | "minor" | "major" | "unplayable", number>>
): ReturnType<typeof healthFromSeverityCounts> {
  return healthFromSeverityCounts({
    cosmetic: 0,
    minor: 0,
    major: 0,
    unplayable: 0,
    oldestOpenIssueAt: null,
    ...counts,
  });
}

function candidate(
  overrides: Partial<MachineViewCandidate> = {}
): MachineViewCandidate {
  return {
    id: "machine-1",
    initials: "AFM",
    title: "Attack from Mars",
    manufacturer: "Bally",
    year: 1995,
    ownerId: "owner-1",
    ownerName: "Alex",
    presence: "on_the_floor",
    createdAt: "2026-01-01T00:00:00.000Z",
    canonicalModelName: "Attack from Mars",
    legacyModelName: "AFM Legacy",
    ...overrides,
  };
}

describe("healthFromSeverityCounts", () => {
  it("derives totals, worst severity, playability, and oldest issue", () => {
    expect(
      healthFromSeverityCounts({
        cosmetic: 2,
        minor: 1,
        major: 3,
        unplayable: 0,
        oldestOpenIssueAt: new Date("2026-01-02T03:04:05.000Z"),
      })
    ).toEqual({
      openIssues: 6,
      bySeverity: { cosmetic: 2, minor: 1, major: 3, unplayable: 0 },
      worstSeverity: "major",
      oldestOpenIssueAt: "2026-01-02T03:04:05.000Z",
      playability: "needs_service",
    });
  });
});

describe("applyMachineViewState", () => {
  it("searches title, initials, manufacturer, and canonical or legacy model", () => {
    const rows = [
      candidate(),
      candidate({
        id: "machine-2",
        initials: "MM",
        title: "Medieval Madness",
        manufacturer: "Williams",
        canonicalModelName: "Medieval Madness Remake",
        legacyModelName: "Castle Game",
      }),
    ];
    const defaults = getMachineViewPreset("machines").defaultState;

    for (const q of ["medieval", "mm", "williams", "remake", "castle"]) {
      expect(applyMachineViewState(rows, { ...defaults, q }).rows).toHaveLength(
        1
      );
    }
  });

  it("filters presence, status, and stable owner IDs including unassigned", () => {
    const needsService = healthFromSeverityCounts({
      cosmetic: 0,
      minor: 0,
      major: 1,
      unplayable: 0,
      oldestOpenIssueAt: new Date("2026-01-01"),
    });
    const rows = [
      candidate({ health: needsService }),
      candidate({
        id: "machine-2",
        initials: "MM",
        title: "Medieval Madness",
        ownerId: null,
        ownerName: "Unassigned",
        presence: "removed",
        health: needsService,
      }),
    ];
    const state = {
      ...getMachineViewPreset("collection").defaultState,
      presence: ["removed" as const],
      status: ["needs_service" as const],
      owner: ["unassigned"],
    };

    expect(
      applyMachineViewState(rows, state).rows.map((row) => row.id)
    ).toEqual(["machine-2"]);
  });

  it("matches machines with an open issue of any selected severity", () => {
    const rows = [
      candidate({ id: "cosmetic", health: health({ cosmetic: 2 }) }),
      candidate({ id: "major", health: health({ minor: 1, major: 1 }) }),
      candidate({ id: "clean", health: health({}) }),
    ];
    const state = {
      ...getMachineViewPreset("collection").defaultState,
      severity: ["minor" as const, "unplayable" as const],
    };

    expect(
      applyMachineViewState(rows, state).rows.map((row) => row.id)
    ).toEqual(["major"]);
  });

  it("sorts deterministically and clamps pagination", () => {
    const rows = [
      candidate({ id: "2", initials: "B", title: "Same" }),
      candidate({ id: "1", initials: "A", title: "Same" }),
      candidate({ id: "3", initials: "C", title: "Zed" }),
    ];
    const state = {
      ...getMachineViewPreset("machines").defaultState,
      presence: "all" as const,
      page: 9,
      pageSize: 25 as const,
    };

    const result = applyMachineViewState(rows, state);
    expect(result.page).toBe(1);
    expect(result.rows.map((row) => row.initials)).toEqual(["A", "B", "C"]);
  });

  it("uses machine identity to break ties for optional fields", () => {
    const rows = [
      candidate({ id: "2", initials: "Z", title: "Alpha", ownerName: "Sam" }),
      candidate({ id: "1", initials: "A", title: "Alpha", ownerName: "Sam" }),
      candidate({ id: "3", initials: "B", title: "Beta", ownerName: "Sam" }),
    ];

    const result = applyMachineViewState(rows, {
      ...getMachineViewPreset("collection").defaultState,
      sort: "owner",
      dir: "asc",
    });

    expect(result.rows.map((row) => row.initials)).toEqual(["A", "Z", "B"]);
  });

  it("sorts never-serviced machines as the oldest service", () => {
    const rows = [
      candidate({
        id: "never-z",
        initials: "NZ",
        title: "Zaccaria",
        lastServicedAt: null,
      }),
      candidate({
        id: "never",
        initials: "N",
        title: "Alpha",
        lastServicedAt: null,
      }),
      candidate({
        id: "recent",
        initials: "R",
        lastServicedAt: "2026-03-01T00:00:00.000Z",
      }),
      candidate({
        id: "old",
        initials: "O",
        lastServicedAt: "2025-03-01T00:00:00.000Z",
      }),
    ];
    const defaults = getMachineViewPreset("machines").defaultState;

    expect(
      applyMachineViewState(rows, {
        ...defaults,
        presence: "all",
        sort: "lastServiced",
        dir: "desc",
      }).rows.map((row) => row.id)
    ).toEqual(["recent", "old", "never", "never-z"]);
    expect(
      applyMachineViewState(rows, {
        ...defaults,
        presence: "all",
        sort: "lastServiced",
        dir: "asc",
      }).rows.map((row) => row.id)
    ).toEqual(["never", "never-z", "old", "recent"]);
  });
});

describe("summarizeMachineView", () => {
  const rows = [
    candidate({
      id: "a",
      initials: "A",
      health: health({ major: 1, cosmetic: 2 }),
    }),
    candidate({ id: "b", initials: "B", health: health({ unplayable: 1 }) }),
    candidate({ id: "c", initials: "C", health: health({}) }),
    candidate({
      id: "d",
      initials: "D",
      presence: "off_the_floor",
      health: health({ unplayable: 2 }),
    }),
    candidate({
      id: "e",
      initials: "E",
      presence: "removed",
      health: health({}),
    }),
  ];

  it("divides presence without counting Removed machines (machine-widgets §3.1, §3.2)", () => {
    expect(summarizeMachineView(rows).presence).toEqual({
      total: 4,
      byPresence: {
        on_the_floor: 3,
        off_the_floor: 1,
        on_loan: 0,
        pending_arrival: 0,
      },
    });
  });

  it("counts playability over On the Floor machines only (machine-widgets §4.2)", () => {
    expect(summarizeMachineView(rows).playability).toEqual({
      onTheFloor: 3,
      byStatus: { operational: 1, needs_service: 1, unplayable: 1 },
    });
  });
});
