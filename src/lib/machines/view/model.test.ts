import { describe, expect, it } from "vitest";
import { getMachineViewPreset } from "./config";
import {
  applyMachineViewState,
  formatCompactAgeAgo,
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

  it("keeps missing dates last in both sort directions", () => {
    const rows = [
      candidate({ id: "never", initials: "N", lastServicedAt: null }),
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
    ).toEqual(["recent", "old", "never"]);
    expect(
      applyMachineViewState(rows, {
        ...defaults,
        presence: "all",
        sort: "lastServiced",
        dir: "asc",
      }).rows.map((row) => row.id)
    ).toEqual(["old", "recent", "never"]);
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

  it("counts the Filtered population across every page, not the current page", () => {
    const many = Array.from({ length: 30 }, (_, index) =>
      candidate({
        id: `m-${index}`,
        initials: `M${index}`,
        health: health({ cosmetic: 1 }),
      })
    );
    const state = {
      ...getMachineViewPreset("collection").defaultState,
      presenceWidget: "filtered" as const,
      issuesWidget: "filtered" as const,
    };
    const applied = applyMachineViewState(many, state);

    const summary = summarizeMachineView(many, applied.filteredRows, state);

    expect(applied.rows).toHaveLength(25);
    expect(summary.presence.total).toBe(30);
    expect(summary.issues.openIssues).toBe(30);
  });

  it("divides the All population by presence and open issue severity", () => {
    const summary = summarizeMachineView(
      rows,
      [],
      getMachineViewPreset("collection").defaultState
    );

    expect(summary.presence).toEqual({
      total: 5,
      byPresence: {
        on_the_floor: 3,
        off_the_floor: 1,
        on_loan: 0,
        pending_arrival: 0,
        removed: 1,
      },
    });
    expect(summary.issues).toEqual({
      openIssues: 6,
      machinesWithOpenIssues: 3,
      bySeverity: { cosmetic: 2, minor: 0, major: 1, unplayable: 3 },
    });
  });

  it("counts playability over On the Floor machines only", () => {
    const summary = summarizeMachineView(
      rows,
      rows,
      getMachineViewPreset("collection").defaultState
    );

    expect(summary.playability).toEqual({
      onTheFloor: 3,
      byStatus: { operational: 1, needs_service: 1, unplayable: 1 },
    });
  });

  it("counts each widget over its own All or Filtered population", () => {
    const state = {
      ...getMachineViewPreset("collection").defaultState,
      severity: ["unplayable" as const],
      issuesWidget: "filtered" as const,
    };
    const { filteredRows } = applyMachineViewState(rows, state);

    const summary = summarizeMachineView(rows, filteredRows, state);

    expect(summary.presence.total).toBe(5);
    expect(summary.playability.onTheFloor).toBe(3);
    expect(summary.issues).toEqual({
      openIssues: 3,
      machinesWithOpenIssues: 2,
      bySeverity: { cosmetic: 0, minor: 0, major: 0, unplayable: 3 },
    });
  });
});

describe("formatCompactAgeAgo", () => {
  const now = new Date("2026-09-21T12:00:00.000Z");

  it("formats compact service ages", () => {
    expect(formatCompactAgeAgo("2026-09-19T12:00:00.000Z", now)).toBe("2d ago");
    expect(formatCompactAgeAgo("2026-08-19T12:00:00.000Z", now)).toBe(
      "1mo 2d ago"
    );
    expect(formatCompactAgeAgo("2024-08-19T12:00:00.000Z", now)).toBe(
      "2y 1mo ago"
    );
    expect(formatCompactAgeAgo(now, now)).toBe("today");
  });
});
