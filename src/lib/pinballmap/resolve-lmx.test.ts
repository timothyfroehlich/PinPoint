import { describe, it, expect } from "vitest";
import { findLmxForMachine } from "./resolve-lmx";
import type { LocationSnapshot } from "./types";

const snap = (
  lmxes: { id: number; machineId: number }[]
): LocationSnapshot => ({
  locationId: 26454,
  name: "APC",
  dateLastUpdated: null,
  lastUpdatedByUsername: null,
  machineCount: lmxes.length,
  lmxes: lmxes.map((l) => ({
    ...l,
    icEnabled: null,
    lastUpdatedByUsername: null,
    conditions: [],
  })),
  fetchedAtIso: "2026-07-16T00:00:00Z",
  raw: {},
});

describe("findLmxForMachine", () => {
  it("returns the lmx whose machineId matches the linked title", () => {
    const lmx = findLmxForMachine(snap([{ id: 900, machineId: 42 }]), 42);
    expect(lmx?.id).toBe(900);
  });

  it("returns null when the title is not in the lineup", () => {
    expect(
      findLmxForMachine(snap([{ id: 900, machineId: 42 }]), 99)
    ).toBeNull();
  });

  it("returns the single match among several lineup rows", () => {
    const lmx = findLmxForMachine(
      snap([
        { id: 900, machineId: 42 },
        { id: 901, machineId: 7 },
        { id: 902, machineId: 13 },
      ]),
      7
    );
    expect(lmx?.id).toBe(901);
  });
});
