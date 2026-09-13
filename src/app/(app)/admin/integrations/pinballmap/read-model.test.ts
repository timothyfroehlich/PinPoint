import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LocationSnapshot } from "~/lib/pinballmap/types";

const { getPinballMapStateMock, getRefreshAllowanceMock } = vi.hoisted(() => ({
  getPinballMapStateMock: vi.fn(),
  getRefreshAllowanceMock: vi.fn(),
}));

vi.mock("~/lib/pinballmap/state", () => ({
  getPinballMapState: getPinballMapStateMock,
  getRefreshAllowance: getRefreshAllowanceMock,
}));

import { getPinballMapAdminViewState } from "./read-model";

const SNAPSHOT: LocationSnapshot = {
  locationId: 26454,
  name: "Austin Pinball Collective",
  city: "Austin",
  state: "TX",
  dateLastUpdated: "2026-09-12",
  lastUpdatedByUsername: "mapper",
  machineCount: 47,
  lmxes: [],
  fetchedAtIso: "2026-09-12T10:00:00.000Z",
  raw: {},
};

beforeEach(() => {
  vi.clearAllMocks();
  getRefreshAllowanceMock.mockResolvedValue({
    remaining: 2,
    nextRefillAt: new Date("2026-09-12T12:03:00.000Z"),
  });
});

describe("getPinballMapAdminViewState", () => {
  it("renders an absent configuration without presenting retained health as current", async () => {
    getPinballMapStateMock.mockResolvedValue({
      locationId: null,
      configurationGeneration: 4,
      snapshotJson: SNAPSHOT,
      lastSyncedAt: new Date("2026-09-12T10:00:00.000Z"),
      lastSyncAttemptAt: new Date("2026-09-12T10:00:00.000Z"),
      lastSyncStatus: "ok",
      lastSyncError: null,
    });

    const result = await getPinballMapAdminViewState();

    expect(result.currentLocation).toBeNull();
    expect(result.retainedLocation).toEqual({
      locationId: 26454,
      name: "Austin Pinball Collective",
    });
    expect(result.health).toEqual({ kind: "not_configured" });
  });

  it("builds healthy current state and narrows locality from an older raw snapshot", async () => {
    getPinballMapStateMock.mockResolvedValue({
      locationId: 26454,
      configurationGeneration: 2,
      snapshotJson: {
        ...SNAPSHOT,
        city: undefined,
        state: undefined,
        raw: { city: "Austin", state: "TX" },
      },
      lastSyncedAt: new Date("2026-09-12T10:00:00.000Z"),
      lastSyncAttemptAt: new Date("2026-09-12T10:00:00.000Z"),
      lastSyncStatus: "ok",
      lastSyncError: null,
    });

    const result = await getPinballMapAdminViewState();

    expect(result.currentLocation).toMatchObject({
      name: "Austin Pinball Collective",
      city: "Austin",
      state: "TX",
      machineCount: 47,
    });
    expect(result.health).toEqual({
      kind: "healthy",
      syncedAtIso: "2026-09-12T10:00:00.000Z",
      lastAttemptAtIso: null,
      machineCount: 47,
    });
  });

  it("keeps a newer interrupted attempt distinct from healthy snapshot time", async () => {
    getPinballMapStateMock.mockResolvedValue({
      locationId: 26454,
      configurationGeneration: 2,
      snapshotJson: SNAPSHOT,
      lastSyncedAt: new Date("2026-09-12T10:00:00.000Z"),
      lastSyncAttemptAt: new Date("2026-09-12T11:54:00.000Z"),
      lastSyncStatus: "ok",
      lastSyncError: null,
    });

    await expect(getPinballMapAdminViewState()).resolves.toMatchObject({
      health: {
        kind: "healthy",
        syncedAtIso: "2026-09-12T10:00:00.000Z",
        lastAttemptAtIso: "2026-09-12T11:54:00.000Z",
        machineCount: 47,
      },
    });
  });

  it("shows failed-attempt and retained-snapshot ages independently", async () => {
    getPinballMapStateMock.mockResolvedValue({
      locationId: 26454,
      configurationGeneration: 2,
      snapshotJson: SNAPSHOT,
      lastSyncedAt: new Date("2026-09-12T09:00:00.000Z"),
      lastSyncAttemptAt: new Date("2026-09-12T11:54:00.000Z"),
      lastSyncStatus: "error",
      lastSyncError: "Pinball Map returned HTTP 503",
    });

    await expect(getPinballMapAdminViewState()).resolves.toMatchObject({
      health: {
        kind: "error",
        failedAtIso: "2026-09-12T11:54:00.000Z",
        error: "Pinball Map returned HTTP 503",
        retainedSnapshot: {
          locationId: 26454,
          name: "Austin Pinball Collective",
          syncedAtIso: "2026-09-12T09:00:00.000Z",
          machineCount: 47,
        },
      },
    });
  });

  it("uses Waiting when a configured id has no valid same-location snapshot", async () => {
    getPinballMapStateMock.mockResolvedValue({
      locationId: 33871,
      configurationGeneration: 5,
      snapshotJson: SNAPSHOT,
      lastSyncedAt: new Date("2026-09-12T09:00:00.000Z"),
      lastSyncAttemptAt: null,
      lastSyncStatus: null,
      lastSyncError: null,
    });

    const result = await getPinballMapAdminViewState();

    expect(result.currentLocation).toBeNull();
    expect(result.health).toEqual({
      kind: "waiting",
      lastAttemptAtIso: null,
      error: null,
    });
  });

  it("keeps an older retained snapshot in error health without presenting it as current", async () => {
    getPinballMapStateMock.mockResolvedValue({
      locationId: 33871,
      configurationGeneration: 5,
      snapshotJson: SNAPSHOT,
      lastSyncedAt: new Date("2026-09-12T09:00:00.000Z"),
      lastSyncAttemptAt: new Date("2026-09-12T11:54:00.000Z"),
      lastSyncStatus: "error",
      lastSyncError: "Pinball Map returned HTTP 503",
    });

    const result = await getPinballMapAdminViewState();

    expect(result.currentLocation).toBeNull();
    expect(result.health).toMatchObject({
      kind: "error",
      retainedSnapshot: {
        locationId: 26454,
        name: "Austin Pinball Collective",
        syncedAtIso: "2026-09-12T09:00:00.000Z",
        machineCount: 47,
      },
    });
  });
});
