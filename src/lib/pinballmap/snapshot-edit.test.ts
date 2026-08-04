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

  it("replaces a stale lmx for the same title rather than duplicating it", () => {
    // PBM gives a title one lmx at our location, and every consumer resolves it
    // by machineId. If the stored snapshot still holds the id PBM re-minted
    // away from, appending the new one leaves two rows under machineId 10 —
    // `derivePbmMachineStatus` would then pick the dead id by array order,
    // flag the machine we just listed as `lmx_drifted`, and let the reconcile
    // pass heal it onto an lmx that no longer exists.
    const result = withLmxAdded(snapshot([{ id: 1, machineId: 10 }]), 2, 10);

    expect(result.lmxes).toEqual([
      expect.objectContaining({ id: 2, machineId: 10 }),
    ]);
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
      1,
      10
    );

    expect(result.lmxes).toEqual([
      expect.objectContaining({ id: 2, machineId: 20 }),
    ]);
    expect(result.machineCount).toBe(1);
  });

  it("is a no-op when the lmx is already absent", () => {
    const result = withLmxRemoved(snapshot([{ id: 1, machineId: 10 }]), 99, 99);

    expect(result.lmxes).toHaveLength(1);
    expect(result.machineCount).toBe(1);
  });

  it("drops a re-minted row for the same title, not just the id passed", () => {
    // PP-rnup. The stored snapshot can hold a DIFFERENT id for the title we
    // just unlisted — PBM re-mints an lmx after a delete + re-add outside its
    // resurrection window. Filtering on id alone left that row behind, and
    // `resolveAutoLink` reads any row under the title as "still on the lineup"
    // and re-lists the machine, silently undoing the human's unlist.
    const result = withLmxRemoved(
      snapshot([
        { id: 2, machineId: 10 },
        { id: 3, machineId: 20 },
      ]),
      1,
      10
    );

    expect(result.lmxes).toEqual([
      expect.objectContaining({ id: 3, machineId: 20 }),
    ]);
    expect(result.machineCount).toBe(1);
  });

  it("falls back to the id alone when the machine carries no title link", () => {
    const result = withLmxRemoved(
      snapshot([
        { id: 1, machineId: 10 },
        { id: 2, machineId: 20 },
      ]),
      1,
      null
    );

    expect(result.lmxes).toEqual([
      expect.objectContaining({ id: 2, machineId: 20 }),
    ]);
    expect(result.machineCount).toBe(1);
  });

  it("does not mutate the input", () => {
    const input = snapshot([{ id: 1, machineId: 10 }]);
    withLmxRemoved(input, 1, 10);

    expect(input.lmxes).toHaveLength(1);
  });
});
