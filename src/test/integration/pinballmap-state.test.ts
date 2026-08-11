/**
 * Integration Test: PinballMap shared read path (PP-o355.16)
 *
 * Covers the foundation read path against PGlite:
 *  - syncLocationSnapshot(): stores the whole snapshot on the singleton, sets
 *    sync health (ok/error), upserts (one row), records the error path
 *  - getPinballMapState(): reads the singleton
 *  - the manual-refresh throttle at the seam (PP-hbi0)
 *
 * These mechanism cases drive the `cron` trigger, which is exempt from the
 * manual-refresh throttle, so back-to-back syncs exercise persistence directly.
 * The `manual`-trigger throttle has its own describe block below.
 */

import { describe, it, expect, vi } from "vitest";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { pinballmapState } from "~/server/db/schema";
import type { LocationSnapshot } from "~/lib/pinballmap/types";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

// Pin the PinballMap client to the in-memory mock at the seam (CORE-TEST-006),
// so the sync can never reach pinballmap.com regardless of PINBALLMAP_MODE.
vi.mock("~/lib/pinballmap/client", async () => {
  const { getMockClient } = await import("~/lib/pinballmap/client-mock");
  return { getPinballMapClient: () => Promise.resolve(getMockClient()) };
});

describe("PinballMap shared read path (PGlite)", () => {
  setupTestDb();

  it("syncLocationSnapshot stores the snapshot and marks health ok", async () => {
    const { syncLocationSnapshot, getPinballMapState } =
      await import("~/lib/pinballmap/state");

    const result = await syncLocationSnapshot({ trigger: "cron" });
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

    await syncLocationSnapshot({ trigger: "cron" });
    await syncLocationSnapshot({ trigger: "cron" });

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

    const result = await syncLocationSnapshot({ trigger: "cron" });
    expect(result).toEqual({
      ok: false,
      reason: "error",
      error: "PBM unreachable",
    });

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
    await syncLocationSnapshot({ trigger: "cron" });
    const afterOk = await getPinballMapState();
    expect(afterOk?.lastSyncStatus).toBe("ok");

    const spy = vi
      .spyOn(getMockClient(), "fetchLocation")
      .mockRejectedValueOnce(new Error("PBM down"));
    await syncLocationSnapshot({ trigger: "cron" });

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

/**
 * Manual-refresh throttle at the seam (PP-hbi0).
 *
 * The throttle is the single chokepoint every live-fetch caller inherits. These
 * cases nail the three flaws the #1704 review surfaced:
 *  (a) a 2nd manual sync inside the interval is refused AND never re-hits PBM,
 *  (b) the guard is against the last ATTEMPT, so it still refuses after a FAILED
 *      attempt (no fail-open on 429/500 — the critical CORE-PBM-001 fix),
 *  (c) the cron/automated path is never blocked, even right after a manual sync.
 */
describe("manual-refresh throttle at the seam (PP-hbi0)", () => {
  setupTestDb();

  it("refuses a 2nd manual sync inside the interval without re-hitting PBM", async () => {
    const { getMockClient } = await import("~/lib/pinballmap/client-mock");
    const { syncLocationSnapshot } = await import("~/lib/pinballmap/state");
    const fetchSpy = vi.spyOn(getMockClient(), "fetchLocation");

    const first = await syncLocationSnapshot({ trigger: "manual" });
    expect(first.ok).toBe(true);

    const second = await syncLocationSnapshot({ trigger: "manual" });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.reason).toBe("throttled");
      if (second.reason === "throttled") {
        expect(second.retryAfterMs).toBeGreaterThan(0);
      }
    }

    // The guard refuses BEFORE the client seam — PBM was hit exactly once.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();
  });

  it("still refuses after a FAILED manual attempt (throttle on attempt, not success)", async () => {
    const { getMockClient } = await import("~/lib/pinballmap/client-mock");
    const { syncLocationSnapshot } = await import("~/lib/pinballmap/state");
    const fetchSpy = vi
      .spyOn(getMockClient(), "fetchLocation")
      .mockRejectedValueOnce(new Error("PBM 429"));

    // First manual attempt fails at the fetch — but the attempt was recorded.
    const first = await syncLocationSnapshot({ trigger: "manual" });
    expect(first.ok).toBe(false);
    if (!first.ok) expect(first.reason).toBe("error");

    // Second manual click immediately after must be throttled, NOT fail-open.
    const second = await syncLocationSnapshot({ trigger: "manual" });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe("throttled");

    // Only the first (failed) attempt reached PBM; the throttled retry did not.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();
  });

  it("never blocks the cron path, even right after a manual sync", async () => {
    const { getMockClient } = await import("~/lib/pinballmap/client-mock");
    const { syncLocationSnapshot } = await import("~/lib/pinballmap/state");
    const fetchSpy = vi.spyOn(getMockClient(), "fetchLocation");

    // A manual sync stamps a fresh attempt...
    const manual = await syncLocationSnapshot({ trigger: "manual" });
    expect(manual.ok).toBe(true);

    // ...and the hourly cron immediately after is still allowed to refresh.
    const cron = await syncLocationSnapshot({ trigger: "cron" });
    expect(cron.ok).toBe(true);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    fetchSpy.mockRestore();
  });
});

/**
 * The guarantee `clearResolvedAbandonments` is built on (PP-l81u).
 *
 * That function reads "this lmx is not on the lineup" as "a human removed the
 * entry on pinballmap.com" and deletes the record. It is only ever allowed to
 * do that because its caller does not run it on a stale lineup. The whole
 * abandoned-listing feature sits downstream of that early return, so it gets a
 * test rather than a comment.
 */
describe("a failed sync clears nothing (PP-l81u)", () => {
  setupTestDb();

  it("502s without reconciling, leaving the record and snapshot intact", async () => {
    const db = await getTestDb();
    const { getMockClient } = await import("~/lib/pinballmap/client-mock");
    const { machines, pinballmapAbandonedListings } =
      await import("~/server/db/schema");
    const { createTestMachine } = await import("~/test/helpers/factories");

    vi.stubEnv("CRON_SECRET", "test-cron-secret");

    const machine = createTestMachine({
      initials: "PBF",
      name: "Godzilla",
      pinballmapMachineId: 6222,
    });
    await db.insert(machines).values(machine);
    await db.insert(pinballmapAbandonedListings).values({
      machineId: machine.id,
      lmxId: 4471,
      pinballmapMachineId: 6221,
    });

    // A stale lineup that does NOT carry lmx 4471 — exactly the shape that
    // would read as "someone removed it" if a failed sync reached the reconcile.
    const staleSnapshot: LocationSnapshot = {
      locationId: 26454,
      name: "APC",
      dateLastUpdated: null,
      lastUpdatedByUsername: null,
      machineCount: 1,
      lmxes: [
        {
          id: 9999,
          machineId: 6222,
          icEnabled: null,
          lastUpdatedByUsername: null,
          conditions: [],
        },
      ],
      fetchedAtIso: "2026-07-16T00:00:00Z",
      raw: {},
    };
    await db.insert(pinballmapState).values({
      id: "singleton",
      locationId: 26454,
      enabled: true,
      snapshotJson: staleSnapshot,
      lastSyncStatus: "ok",
    });

    const spy = vi
      .spyOn(getMockClient(), "fetchLocation")
      .mockRejectedValueOnce(new Error("PBM unreachable"));

    const { GET } = await import("~/app/api/cron/pinballmap-sync/route");
    const response = await GET(
      new Request("http://localhost/api/cron/pinballmap-sync", {
        headers: { authorization: "Bearer test-cron-secret" },
      })
    );

    expect(response.status).toBe(502);

    // The record is the point: it survived a sync that could not see the map.
    const rows = await db.select().from(pinballmapAbandonedListings);
    expect(rows).toHaveLength(1);

    // The stale snapshot is still there too — a failed fetch preserves the last
    // good lineup rather than emptying it, which is the other half of why
    // absence can never be misread as removal.
    const [state] = await db.select().from(pinballmapState);
    expect(state?.snapshotJson?.lmxes).toHaveLength(1);

    spy.mockRestore();
    vi.unstubAllEnvs();
  });
});
