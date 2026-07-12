import { describe, it, expect } from "vitest";
import {
  shouldBeListedOnPbm,
  derivePbmMachineStatus,
  isListedOnPbm,
} from "./status";
import type { LocationSnapshot } from "./types";

function snapshot(lmxes: LocationSnapshot["lmxes"]): LocationSnapshot {
  return {
    locationId: 26454,
    name: "Austin Pinball Collective",
    dateLastUpdated: "2026-06-20",
    lastUpdatedByUsername: "apc",
    machineCount: lmxes.length,
    lmxes,
    fetchedAtIso: "2026-06-21T00:00:00.000Z",
    raw: null,
  };
}

describe("shouldBeListedOnPbm", () => {
  it("only on_the_floor should be listed", () => {
    expect(shouldBeListedOnPbm("on_the_floor")).toBe(true);
    for (const s of [
      "off_the_floor",
      "on_loan",
      "pending_arrival",
      "removed",
    ] as const) {
      expect(shouldBeListedOnPbm(s)).toBe(false);
    }
  });
});

describe("isListedOnPbm", () => {
  const snap = snapshot([
    {
      id: 9001,
      machineId: 642,
      icEnabled: null,
      lastUpdatedByUsername: null,
      conditions: [],
    },
  ]);

  it("is true when the machine id is present in the snapshot", () => {
    expect(isListedOnPbm(snap, 642)).toBe(true);
  });

  it("is false when the machine id is absent", () => {
    expect(isListedOnPbm(snap, 999)).toBe(false);
  });

  it("is false when there is no snapshot yet", () => {
    expect(isListedOnPbm(null, 642)).toBe(false);
  });
});

describe("derivePbmMachineStatus", () => {
  const snap = snapshot([
    {
      id: 9001,
      machineId: 642,
      icEnabled: null,
      lastUpdatedByUsername: null,
      conditions: [
        {
          id: 1,
          comment: "left flipper weak",
          username: "alice",
          createdAtIso: "2026-06-01T10:00:00.000Z",
        },
        {
          id: 2,
          comment: "fixed",
          username: "bob",
          createdAtIso: "2026-06-10T12:00:00.000Z",
        },
      ],
    },
  ]);

  it("listed + latest comment when the machine is in the snapshot", () => {
    const status = derivePbmMachineStatus(snap, 642, "on_the_floor");
    expect(status.listed).toBe(true);
    expect(status.lastCommentIso).toBe("2026-06-10T12:00:00.000Z");
    expect(status.desynced).toBe(false);
  });

  it("not listed when the machine id is absent", () => {
    const status = derivePbmMachineStatus(snap, 999, "off_the_floor");
    expect(status.listed).toBe(false);
    expect(status.lastCommentIso).toBeNull();
    // off-the-floor and not listed agree → no desync.
    expect(status.desynced).toBe(false);
  });

  it("flags desync when on_the_floor but not listed", () => {
    const status = derivePbmMachineStatus(snap, 999, "on_the_floor");
    expect(status.listed).toBe(false);
    expect(status.desynced).toBe(true);
  });

  it("flags desync when listed but removed from our floor", () => {
    const status = derivePbmMachineStatus(snap, 642, "removed");
    expect(status.listed).toBe(true);
    expect(status.desynced).toBe(true);
  });

  it("null snapshot → not listed, no comment", () => {
    const status = derivePbmMachineStatus(null, 642, "on_the_floor");
    expect(status.listed).toBe(false);
    expect(status.lastCommentIso).toBeNull();
    expect(status.desynced).toBe(true);
  });
});
