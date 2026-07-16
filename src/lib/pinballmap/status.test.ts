import { describe, it, expect } from "vitest";
import { derivePbmMachineStatus, shouldBeListedOnPbm } from "./status";
import type { LocationSnapshot } from "./types";

const snap = (rows: { id: number; machineId: number }[]): LocationSnapshot => ({
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
  fetchedAtIso: "2026-07-16T00:00:00Z",
  raw: {},
});

describe("derivePbmMachineStatus", () => {
  it("ok: listed locally, lmx present and matching", () => {
    const s = derivePbmMachineStatus({
      pinballmapMachineId: 42,
      pinballmapListed: true,
      pinballmapLmxId: 900,
      snapshot: snap([{ id: 900, machineId: 42 }]),
    });
    expect(s).toEqual({
      onPbm: true,
      lmxId: 900,
      desynced: false,
      reason: "ok",
    });
  });

  it("desync: listed locally but title absent from lineup", () => {
    const s = derivePbmMachineStatus({
      pinballmapMachineId: 42,
      pinballmapListed: true,
      pinballmapLmxId: 900,
      snapshot: snap([]),
    });
    expect(s.desynced).toBe(true);
    expect(s.reason).toBe("listed_locally_absent_on_pbm");
  });

  it("desync: on PBM but not listed locally", () => {
    const s = derivePbmMachineStatus({
      pinballmapMachineId: 42,
      pinballmapListed: false,
      pinballmapLmxId: null,
      snapshot: snap([{ id: 900, machineId: 42 }]),
    });
    expect(s.reason).toBe("on_pbm_not_listed_locally");
    expect(s.desynced).toBe(true);
    expect(s.lmxId).toBe(900);
  });

  it("lmx_drifted: listed, title present but under a different lmx id than stored", () => {
    const s = derivePbmMachineStatus({
      pinballmapMachineId: 42,
      pinballmapListed: true,
      pinballmapLmxId: 900,
      snapshot: snap([{ id: 999, machineId: 42 }]),
    });
    expect(s.reason).toBe("lmx_drifted");
    expect(s.desynced).toBe(true);
    expect(s.lmxId).toBe(999);
  });

  it("unlinked: no catalog title", () => {
    const s = derivePbmMachineStatus({
      pinballmapMachineId: null,
      pinballmapListed: false,
      pinballmapLmxId: null,
      snapshot: snap([]),
    });
    expect(s.reason).toBe("unlinked");
    expect(s.desynced).toBe(false);
  });

  it("null snapshot: not desynced (no data), reason ok", () => {
    const s = derivePbmMachineStatus({
      pinballmapMachineId: 42,
      pinballmapListed: true,
      pinballmapLmxId: 900,
      snapshot: null,
    });
    expect(s.desynced).toBe(false);
    expect(s.reason).toBe("ok");
  });
});

describe("shouldBeListedOnPbm", () => {
  it("reflects local listing intent, independent of presence", () => {
    expect(shouldBeListedOnPbm({ pinballmapListed: true })).toBe(true);
    expect(shouldBeListedOnPbm({ pinballmapListed: false })).toBe(false);
  });
});
