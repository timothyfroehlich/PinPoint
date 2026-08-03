/**
 * Unit tests: stored-snapshot edits after an outbound write (PP-o355.30).
 *
 * These keep the stored lineup consistent with a list/unlist we just performed,
 * so auto-link (PP-o355.20) does not act on a snapshot we know is stale. See the
 * module docstring for why that matters.
 */

import { describe, it, expect } from "vitest";
import { withLmxAdded, withLmxRemoved } from "./snapshot-edit";
import type { LocationSnapshot } from "./types";

const snapshot = (
  rows: { id: number; machineId: number }[]
): LocationSnapshot => ({
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
  fetchedAtIso: "2026-08-03T00:00:00Z",
  raw: {},
});

describe("withLmxAdded", () => {
  it("appends the new row and keeps machineCount consistent", () => {
    const result = withLmxAdded(snapshot([{ id: 1, machineId: 10 }]), 2, 20);

    expect(result.lmxes).toHaveLength(2);
    expect(result.lmxes[1]).toEqual({
      id: 2,
      machineId: 20,
      icEnabled: null,
      lastUpdatedByUsername: null,
      conditions: [],
    });
    expect(result.machineCount).toBe(2);
  });

  it("does not duplicate a row PBM's find-or-create returned", () => {
    // `addMachine` is find-or-create: re-listing a title already on the lineup
    // returns the EXISTING lmx. Appending blindly would put the same id in
    // twice, and `findLmxForMachine` would then depend on array order.
    const result = withLmxAdded(snapshot([{ id: 1, machineId: 10 }]), 1, 10);

    expect(result.lmxes).toHaveLength(1);
    expect(result.machineCount).toBe(1);
  });

  it("does not mutate the input", () => {
    const input = snapshot([{ id: 1, machineId: 10 }]);
    withLmxAdded(input, 2, 20);

    expect(input.lmxes).toHaveLength(1);
  });
});

describe("withLmxRemoved", () => {
  it("drops the row and keeps machineCount consistent", () => {
    const result = withLmxRemoved(
      snapshot([
        { id: 1, machineId: 10 },
        { id: 2, machineId: 20 },
      ]),
      1
    );

    expect(result.lmxes).toEqual([
      expect.objectContaining({ id: 2, machineId: 20 }),
    ]);
    expect(result.machineCount).toBe(1);
  });

  it("is a no-op when the lmx is already absent", () => {
    const result = withLmxRemoved(snapshot([{ id: 1, machineId: 10 }]), 99);

    expect(result.lmxes).toHaveLength(1);
    expect(result.machineCount).toBe(1);
  });

  it("does not mutate the input", () => {
    const input = snapshot([{ id: 1, machineId: 10 }]);
    withLmxRemoved(input, 1);

    expect(input.lmxes).toHaveLength(1);
  });
});
