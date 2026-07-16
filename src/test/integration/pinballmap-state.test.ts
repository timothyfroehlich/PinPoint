/**
 * Integration Test: PinballMap shared read path (PP-o355.16)
 *
 * Covers the foundation read path against PGlite:
 *  - syncLocationSnapshot(): stores the whole snapshot on the singleton, sets
 *    sync health (ok/error), upserts (one row), records the error path
 *  - getPinballMapState(): reads the singleton
 */

import { describe, it, expect, vi } from "vitest";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { pinballmapState } from "~/server/db/schema";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

// Pin the PinballMap client to the in-memory mock at the seam (CORE-TEST-006),
// so the sync can never reach pinballmap.com regardless of PINBALLMAP_MODE.
vi.mock("~/lib/pinballmap/client", async () => {
  const { getMockClient } = await import("~/lib/pinballmap/client-mock");
  return { getPinballMapClient: () => getMockClient() };
});

describe("PinballMap shared read path (PGlite)", () => {
  setupTestDb();

  it("syncLocationSnapshot stores the snapshot and marks health ok", async () => {
    const { syncLocationSnapshot, getPinballMapState } =
      await import("~/lib/pinballmap/state");

    const result = await syncLocationSnapshot();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.machineCount).toBeGreaterThan(0);

    const state = await getPinballMapState();
    expect(state).not.toBeNull();
    expect(state?.lastSyncStatus).toBe("ok");
    expect(state?.lastSyncError).toBeNull();
    expect(state?.lastSyncedAt).toBeInstanceOf(Date);
    // The whole LocationSnapshot is stored as JSON.
    expect(state?.snapshotJson?.locationId).toBe(state?.locationId);
    expect(state?.snapshotJson?.lmxes.length ?? 0).toBeGreaterThan(0);
  });

  it("is a singleton — a second sync updates the same row", async () => {
    const db = await getTestDb();
    const { syncLocationSnapshot } = await import("~/lib/pinballmap/state");

    await syncLocationSnapshot();
    await syncLocationSnapshot();

    const rows = await db.select().from(pinballmapState);
    expect(rows.length).toBe(1);
    expect(rows[0]?.id).toBe("singleton");
  });

  it("records the error path without throwing when the fetch fails", async () => {
    const { getMockClient } = await import("~/lib/pinballmap/client-mock");
    const { syncLocationSnapshot, getPinballMapState } =
      await import("~/lib/pinballmap/state");
    const spy = vi
      .spyOn(getMockClient(), "fetchLocation")
      .mockRejectedValueOnce(new Error("PBM unreachable"));

    const result = await syncLocationSnapshot();
    expect(result).toEqual({ ok: false, error: "PBM unreachable" });

    const state = await getPinballMapState();
    expect(state?.lastSyncStatus).toBe("error");
    expect(state?.lastSyncError).toBe("PBM unreachable");
    spy.mockRestore();
  });

  it("a failed sync after a success preserves lastSyncedAt and the snapshot", async () => {
    const { getMockClient } = await import("~/lib/pinballmap/client-mock");
    const { syncLocationSnapshot, getPinballMapState } =
      await import("~/lib/pinballmap/state");

    // Establish a good sync, then fail the next fetch.
    await syncLocationSnapshot();
    const afterOk = await getPinballMapState();
    expect(afterOk?.lastSyncStatus).toBe("ok");

    const spy = vi
      .spyOn(getMockClient(), "fetchLocation")
      .mockRejectedValueOnce(new Error("PBM down"));
    await syncLocationSnapshot();

    const afterErr = await getPinballMapState();
    // lastSyncedAt = "last SUCCESSFUL sync" — unchanged by the failed attempt.
    expect(afterErr?.lastSyncedAt?.getTime()).toBe(
      afterOk?.lastSyncedAt?.getTime()
    );
    // The stale-but-good snapshot is kept, not clobbered.
    expect(afterErr?.snapshotJson?.locationId).toBe(
      afterOk?.snapshotJson?.locationId
    );
    // Health reflects the failure.
    expect(afterErr?.lastSyncStatus).toBe("error");
    expect(afterErr?.lastSyncError).toBe("PBM down");
    spy.mockRestore();
  });
});
