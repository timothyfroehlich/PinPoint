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
 * Manual-refresh token bucket at the seam (PP-hbi0, reshaped for spec 3.2).
 *
 * The bucket is the single chokepoint every live-fetch caller inherits. These
 * cases nail the flaws the #1704 review surfaced, restated for the bucket:
 *  (a) once the allowance is spent the next call is refused AND never re-hits
 *      PBM,
 *  (b) a token is spent on the ATTEMPT, so a FAILED attempt still costs one (no
 *      fail-open on 429/500 — the critical CORE-PBM-001 property),
 *  (c) the cron/automated path is never blocked and never charged.
 */
describe("manual-refresh token bucket at the seam (PP-hbi0)", () => {
  setupTestDb();

  it("allows the burst, then refuses without re-hitting PBM", async () => {
    const { getMockClient } = await import("~/lib/pinballmap/client-mock");
    const { syncLocationSnapshot } = await import("~/lib/pinballmap/state");
    const { PBM_REFRESH_BURST } = await import("~/lib/pinballmap/config");
    const fetchSpy = vi.spyOn(getMockClient(), "fetchLocation");

    for (let i = 0; i < PBM_REFRESH_BURST; i++) {
      expect((await syncLocationSnapshot({ trigger: "manual" })).ok).toBe(true);
    }

    const spent = await syncLocationSnapshot({ trigger: "manual" });
    expect(spent.ok).toBe(false);
    if (!spent.ok) {
      expect(spent.reason).toBe("throttled");
      if (spent.reason === "throttled") {
        expect(spent.retryAfterMs).toBeGreaterThan(0);
      }
    }

    // The guard refuses BEFORE the client seam — PBM saw the burst and no more.
    expect(fetchSpy).toHaveBeenCalledTimes(PBM_REFRESH_BURST);
    fetchSpy.mockRestore();
  });

  it("charges a FAILED attempt too (token spent on attempt, not success)", async () => {
    const { getMockClient } = await import("~/lib/pinballmap/client-mock");
    const { syncLocationSnapshot } = await import("~/lib/pinballmap/state");
    const { getRefreshAllowance } = await import("~/lib/pinballmap/state");
    const { PBM_REFRESH_BURST } = await import("~/lib/pinballmap/config");
    const fetchSpy = vi
      .spyOn(getMockClient(), "fetchLocation")
      .mockRejectedValueOnce(new Error("PBM 429"));

    // The attempt fails at the fetch — but the token was already claimed.
    const first = await syncLocationSnapshot({ trigger: "manual" });
    expect(first.ok).toBe(false);
    if (!first.ok) expect(first.reason).toBe("error");

    // Fail-open here would be the CORE-PBM-001 inversion: a rate-limited or
    // erroring PinballMap would get MORE traffic, not less.
    expect((await getRefreshAllowance()).remaining).toBe(PBM_REFRESH_BURST - 1);
    fetchSpy.mockRestore();
  });

  it("never blocks the cron path, and never charges it", async () => {
    const { getMockClient } = await import("~/lib/pinballmap/client-mock");
    const { syncLocationSnapshot, getRefreshAllowance } =
      await import("~/lib/pinballmap/state");
    const { PBM_REFRESH_BURST } = await import("~/lib/pinballmap/config");
    const fetchSpy = vi.spyOn(getMockClient(), "fetchLocation");

    // Spend the whole human allowance...
    for (let i = 0; i < PBM_REFRESH_BURST; i++) {
      await syncLocationSnapshot({ trigger: "manual" });
    }

    // ...and the hourly cron is still allowed to refresh.
    expect((await syncLocationSnapshot({ trigger: "cron" })).ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(PBM_REFRESH_BURST + 1);
    fetchSpy.mockRestore();
  });

  it("does not spend a token on the cron path", async () => {
    // Charging the hourly refresh to the human allowance would let the cron
    // lock people out of their own button.
    const { syncLocationSnapshot, getRefreshAllowance } =
      await import("~/lib/pinballmap/state");
    const { PBM_REFRESH_BURST } = await import("~/lib/pinballmap/config");

    await syncLocationSnapshot({ trigger: "cron" });
    expect((await getRefreshAllowance()).remaining).toBe(PBM_REFRESH_BURST);
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
      locationId: 26454,
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

/**
 * Location-scoped reconcile (spec 6.4).
 *
 * `clearResolvedAbandonments` reads "this lmx is not on the lineup" as "a human
 * removed the entry". After a location change, a record kept for the OLD
 * location is absent from the NEW location's lineup by definition — so an
 * unscoped clear would delete every old record and report a cleanup nobody
 * performed (CORE-ARCH-012). The clear only ever touches records stamped with
 * the location that was actually synced.
 */
describe("reconcile is scoped to the tracked location (spec 6.4)", () => {
  setupTestDb();

  it("clears same-location orphans but keeps cross-location records", async () => {
    const db = await getTestDb();
    const { machines, pinballmapAbandonedListings } =
      await import("~/server/db/schema");
    const { clearResolvedAbandonments } =
      await import("~/lib/pinballmap/abandoned-listings");

    const [machine] = await db
      .insert(machines)
      .values({ name: "Godzilla", initials: "GZ" })
      .returning();
    if (!machine) throw new Error("failed to seed machine");

    // One record for the currently tracked location, one for a location we no
    // longer track. Neither lmx is on the synced lineup.
    await db.insert(pinballmapAbandonedListings).values([
      {
        machineId: machine.id,
        lmxId: 111,
        pinballmapMachineId: 6221,
        locationId: 26454,
      },
      {
        machineId: machine.id,
        lmxId: 222,
        pinballmapMachineId: 6222,
        locationId: 99999,
      },
    ]);

    // A valid, non-empty lineup for the tracked location that carries neither
    // abandoned lmx and no covering intent-On machine exists — so absence would
    // normally clear both records.
    const snapshot: LocationSnapshot = {
      locationId: 26454,
      name: "APC",
      dateLastUpdated: null,
      lastUpdatedByUsername: null,
      machineCount: 1,
      lmxes: [
        {
          id: 333,
          machineId: 6299,
          icEnabled: null,
          lastUpdatedByUsername: null,
          conditions: [],
        },
      ],
      fetchedAtIso: "2026-08-18T00:00:00Z",
      raw: {},
    };

    const cleared = await clearResolvedAbandonments(snapshot, 26454);
    expect(cleared).toBe(1);

    const rows = await db.select().from(pinballmapAbandonedListings);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.lmxId).toBe(222);
    expect(rows[0]?.locationId).toBe(99999);
  });
});
