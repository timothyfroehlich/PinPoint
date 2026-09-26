import { describe, expect, it } from "vitest";
import {
  getMachineViewBuiltInViews,
  getMachineViewPreset,
  MACHINE_VIEW_PAGE_PRESET_VIEW_ID,
  planMachineViewDependencies,
} from "./config";
import {
  parseMachineViewState,
  serializeMachineViewState,
  toMachineViewSavedState,
} from "./state";

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
