import { describe, expect, it } from "vitest";
import {
  getMachineViewBuiltInViews,
  getMachineViewPreset,
  MACHINE_VIEW_PAGE_PRESET_VIEW_ID,
  planMachineViewDependencies,
} from "./config";
import {
  VALID_MACHINE_PRESENCE_STATUSES,
  type MachinePresenceStatus,
} from "~/lib/machines/presence";
import { applyMachineViewState, type MachineViewCandidate } from "./model";
import {
  parseMachineViewState,
  serializeMachineViewState,
  toMachineViewSavedState,
} from "./state";

/** One machine per presence state; a higher index was added later. */
function candidate(
  index: number,
  presence: MachinePresenceStatus
): MachineViewCandidate {
  return {
    id: `machine-${index}`,
    initials: `M${index}`,
    title: `Machine ${index}`,
    manufacturer: "Williams",
    year: 1990,
    ownerId: null,
    ownerName: "Unassigned",
    presence,
    createdAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    canonicalModelName: `Machine ${index}`,
    legacyModelName: "",
  };
}

describe("planMachineViewDependencies", () => {
  it("loads only dependencies required by displayed fields", () => {
    const state = {
      ...getMachineViewPreset("machines").defaultState,
      columns: ["machine" as const, "presence" as const],
    };

    expect(planMachineViewDependencies(state)).toEqual({
      health: false,
      service: false,
      activity: false,
    });
  });

  it("includes dependencies required by sorting and filters", () => {
    const state = {
      ...getMachineViewPreset("machines").defaultState,
      columns: ["machine" as const],
      status: ["needs_service" as const],
      sort: "lastActivity" as const,
      dir: "desc" as const,
    };

    expect(planMachineViewDependencies(state)).toEqual({
      health: true,
      service: false,
      activity: true,
    });
  });

  it("loads health for the Open Issue Severity filter", () => {
    const state = {
      ...getMachineViewPreset("machines").defaultState,
      columns: ["machine" as const],
      severity: ["cosmetic" as const],
    };

    expect(planMachineViewDependencies(state).health).toBe(true);
  });
});

describe("Built-in Views", () => {
  it("list the approved views per preset, shared names in the same order", () => {
    expect(
      getMachineViewBuiltInViews("machines").map((view) => view.name)
    ).toEqual([
      "On the floor",
      "Needs attention",
      "Service due",
      "All machines",
      "Recently added",
    ]);
    expect(
      getMachineViewBuiltInViews("collection").map((view) => view.name)
    ).toEqual(["On the floor", "Needs attention", "All machines"]);
  });

  it("include the Page Preset's own configuration", () => {
    for (const preset of ["machines", "collection"] as const) {
      const { page: _page, ...defaults } =
        getMachineViewPreset(preset).defaultState;
      const pagePreset = getMachineViewBuiltInViews(preset).find(
        (view) => view.id === MACHINE_VIEW_PAGE_PRESET_VIEW_ID[preset]
      );
      expect(pagePreset?.state).toEqual(defaults);
    }
  });

  it("leave out Removed machines everywhere except All machines (§9.1, §9.2)", () => {
    const presences = VALID_MACHINE_PRESENCE_STATUSES.map((presence, index) =>
      candidate(index, presence)
    );
    for (const preset of ["machines", "collection"] as const) {
      for (const view of getMachineViewBuiltInViews(preset)) {
        const shown = applyMachineViewState(presences, {
          ...view.state,
          status: [],
          page: 1,
        }).rows.map((row) => row.presence);
        expect(shown.includes("removed"), `${preset} ${view.name}`).toBe(
          view.id === "all-machines"
        );
      }
    }
  });

  it("show every other presence state in Recently added, newest first", () => {
    const view = getMachineViewBuiltInViews("machines").find(
      (builtInView) => builtInView.id === "recently-added"
    );
    const rows = VALID_MACHINE_PRESENCE_STATUSES.map((presence, index) =>
      candidate(index, presence)
    );

    const shown = view
      ? applyMachineViewState(rows, { ...view.state, page: 1 }).rows
      : [];

    expect(shown.map((row) => row.presence)).toEqual([
      "pending_arrival",
      "on_loan",
      "off_the_floor",
      "on_the_floor",
    ]);
    expect(view?.state.columns).toEqual(
      expect.arrayContaining(["presence", "dateAdded"])
    );
  });

  it("use only states the URL parser round-trips unchanged", () => {
    for (const preset of ["machines", "collection"] as const) {
      for (const view of getMachineViewBuiltInViews(preset)) {
        const params = serializeMachineViewState(
          { ...view.state, page: 1 },
          preset
        );
        expect(
          toMachineViewSavedState(parseMachineViewState(params, preset))
        ).toEqual(view.state);
      }
    }
  });
});
