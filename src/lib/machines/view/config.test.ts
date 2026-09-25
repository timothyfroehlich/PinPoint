import { describe, expect, it } from "vitest";
import { getMachineViewPreset, planMachineViewDependencies } from "./config";

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
