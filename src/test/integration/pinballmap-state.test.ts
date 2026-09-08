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

import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq, sql } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import {
  machines,
  pinballmapAbandonedListings,
  pinballmapLocationChecks,
  pinballmapState,
} from "~/server/db/schema";
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

const CHECKED_BY = "00000000-0000-4000-8000-000000000001";

function snapshotAt(
  locationId: number,
  name: string,
  lmxes: { id: number; machineId: number }[] = []
): LocationSnapshot {
  return {
    locationId,
    name,
    dateLastUpdated: null,
    lastUpdatedByUsername: null,
    machineCount: lmxes.length,
    lmxes: lmxes.map((lmx) => ({
      ...lmx,
      icEnabled: null,
      lastUpdatedByUsername: null,
      conditions: [],
    })),
    fetchedAtIso: "2026-08-31T00:00:00.000Z",
    raw: {},
  };
}

describe("PinballMap shared read path (PGlite)", () => {
  setupTestDb();

  beforeEach(async () => {
    const db = await getTestDb();
    await db
      .insert(pinballmapState)
      .values({ id: "singleton", locationId: 26454 });
  });

  it("uses location presence even while the compatibility flag remains", async () => {
    const db = await getTestDb();
    const { getPinballMapState } = await import("~/lib/pinballmap/state");

    await db.update(pinballmapState).set({ enabled: false });

    const state = await getPinballMapState();
    expect(state).toMatchObject({ locationId: 26454 });
    expect(state).not.toHaveProperty("enabled");
  });

  it("keeps reading and syncing after the compatibility column is dropped", async () => {
    const db = await getTestDb();
    const { getPinballMapState, syncLocationSnapshot } =
      await import("~/lib/pinballmap/state");

    await db.execute(sql`ALTER TABLE pinballmap_state DROP COLUMN enabled`);
    try {
      expect(await getPinballMapState()).toMatchObject({ locationId: 26454 });
      await expect(
        syncLocationSnapshot({ trigger: "cron" })
      ).resolves.toMatchObject({ ok: true });
      await expect(
        syncLocationSnapshot({ trigger: "manual" })
      ).resolves.toMatchObject({ ok: true });
    } finally {
      await db.execute(sql`
        ALTER TABLE pinballmap_state
        ADD COLUMN enabled boolean NOT NULL DEFAULT false
      `);
    }
  });

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

  beforeEach(async () => {
    const db = await getTestDb();
    await db
      .insert(pinballmapState)
      .values({ id: "singleton", locationId: 26454 });
  });

  it("returns not_configured before allowance or client work", async () => {
    const db = await getTestDb();
    const { getMockClient } = await import("~/lib/pinballmap/client-mock");
    const { syncLocationSnapshot, getRefreshAllowance } =
      await import("~/lib/pinballmap/state");
    const { PBM_REFRESH_BURST } = await import("~/lib/pinballmap/config");
    const fetchSpy = vi.spyOn(getMockClient(), "fetchLocation");

    await db.update(pinballmapState).set({ locationId: null });
    await expect(syncLocationSnapshot({ trigger: "manual" })).resolves.toEqual({
      ok: false,
      reason: "not_configured",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect((await getRefreshAllowance()).remaining).toBe(PBM_REFRESH_BURST);
    fetchSpy.mockRestore();
  });

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
    const { syncLocationSnapshot } = await import("~/lib/pinballmap/state");
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

describe("tracked-location changes", () => {
  setupTestDb();

  it("checks before committing, accepts an empty location, and fetches only once", async () => {
    const db = await getTestDb();
    const { getMockClient } = await import("~/lib/pinballmap/client-mock");
    const { PBM_REFRESH_BURST } = await import("~/lib/pinballmap/config");
    const {
      checkTrackedLocation,
      commitCheckedTrackedLocation,
      getPinballMapState,
    } = await import("~/lib/pinballmap/state");
    await db.insert(pinballmapState).values({
      id: "singleton",
      locationId: 26454,
      snapshotJson: snapshotAt(26454, "APC", [{ id: 1, machineId: 100 }]),
      lastSyncStatus: "ok",
    });
    const [machine] = await db
      .insert(machines)
      .values({
        name: "Godzilla",
        initials: "KEEP",
        pinballmapMachineId: 6221,
        pinballmapIntent: "on",
      })
      .returning();
    if (!machine) throw new Error("failed to seed machine");
    await db.insert(pinballmapAbandonedListings).values({
      machineId: machine.id,
      lmxId: 4471,
      pinballmapMachineId: 6221,
      locationId: 26454,
    });
    const emptyLocation = snapshotAt(99999, "Empty venue");
    const fetchSpy = vi
      .spyOn(getMockClient(), "fetchLocation")
      .mockResolvedValueOnce(emptyLocation);

    const checked = await checkTrackedLocation(99999, CHECKED_BY);
    expect(checked).toMatchObject({
      ok: true,
      candidate: { locationId: 99999, machineCount: 0 },
    });
    const unchanged = await getPinballMapState();
    expect(unchanged?.locationId).toBe(26454);
    expect(unchanged?.lastSyncStatus).toBe("ok");
    if (!checked.ok) throw new Error("expected a checked candidate");
    expect(checked.candidate).not.toHaveProperty("snapshotJson");
    const [storedCandidate] = await db.select().from(pinballmapLocationChecks);
    expect(storedCandidate).toMatchObject({
      expectedLocationId: 26454,
      expectedGeneration: 0,
      checkedBy: CHECKED_BY,
      snapshotJson: emptyLocation,
    });
    expect(
      checked.candidate.expiresAt.getTime() -
        checked.candidate.checkedAt.getTime()
    ).toBe(10 * 60 * 1000);
    await expect(
      commitCheckedTrackedLocation(checked.candidate.checkId, CHECKED_BY)
    ).resolves.toEqual({ ok: true });

    const state = await getPinballMapState();
    expect(fetchSpy).toHaveBeenCalledWith(99999);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(state?.locationId).toBe(99999);
    expect(state?.snapshotJson).toEqual(emptyLocation);
    expect(state?.lastSyncStatus).toBe("ok");
    expect(state?.lastSyncError).toBeNull();
    expect(state?.lastSyncedAt?.getTime()).toBe(
      checked.candidate.checkedAt.getTime()
    );
    expect(state?.lastSyncAttemptAt?.getTime()).toBe(
      checked.candidate.checkedAt.getTime()
    );
    expect(state?.refreshTokens).toBe(PBM_REFRESH_BURST - 1);
    expect((await db.query.machines.findFirst())?.pinballmapIntent).toBe("on");
    expect(await db.select().from(pinballmapAbandonedListings)).toHaveLength(1);
    fetchSpy.mockRestore();
  });

  it("configures from an uninitialized state only after a checked commit", async () => {
    const { getMockClient } = await import("~/lib/pinballmap/client-mock");
    const {
      checkTrackedLocation,
      commitCheckedTrackedLocation,
      getPinballMapState,
    } = await import("~/lib/pinballmap/state");
    const fetched = snapshotAt(99999, "First venue");
    const fetchSpy = vi
      .spyOn(getMockClient(), "fetchLocation")
      .mockResolvedValueOnce(fetched);

    const checked = await checkTrackedLocation(99999, CHECKED_BY);
    if (!checked.ok) throw new Error("expected a checked candidate");
    await expect(
      commitCheckedTrackedLocation(checked.candidate.checkId, CHECKED_BY)
    ).resolves.toEqual({ ok: true });
    expect(await getPinballMapState()).toMatchObject({
      locationId: 99999,
      snapshotJson: fetched,
      lastSyncStatus: "ok",
    });
    fetchSpy.mockRestore();
  });

  it("resumes the retained location without reconciling its abandonments", async () => {
    const db = await getTestDb();
    const { getMockClient } = await import("~/lib/pinballmap/client-mock");
    const { checkTrackedLocation, commitCheckedTrackedLocation } =
      await import("~/lib/pinballmap/state");
    await db.insert(pinballmapState).values({
      id: "singleton",
      locationId: null,
      snapshotJson: snapshotAt(26454, "Retained APC", [
        { id: 4471, machineId: 6221 },
      ]),
      lastSyncStatus: "ok",
    });
    const [machine] = await db
      .insert(machines)
      .values({ name: "Godzilla", initials: "RSM" })
      .returning();
    if (!machine) throw new Error("failed to seed machine");
    await db.insert(pinballmapAbandonedListings).values({
      machineId: machine.id,
      lmxId: 4471,
      pinballmapMachineId: 6221,
      locationId: 26454,
    });
    const fetchSpy = vi
      .spyOn(getMockClient(), "fetchLocation")
      .mockResolvedValueOnce(snapshotAt(26454, "APC now"));

    const checked = await checkTrackedLocation(26454, CHECKED_BY);
    if (!checked.ok) throw new Error("expected a checked candidate");
    await expect(
      commitCheckedTrackedLocation(checked.candidate.checkId, CHECKED_BY)
    ).resolves.toEqual({ ok: true });
    expect(await db.select().from(pinballmapAbandonedListings)).toHaveLength(1);
    fetchSpy.mockRestore();
  });

  it("returns a fetch error without replacing the previous configuration", async () => {
    const db = await getTestDb();
    const { getMockClient } = await import("~/lib/pinballmap/client-mock");
    const { checkTrackedLocation, getPinballMapState } =
      await import("~/lib/pinballmap/state");
    const original = snapshotAt(26454, "APC", [{ id: 1, machineId: 100 }]);
    const previousAttempt = new Date("2026-08-30T12:00:00.000Z");
    const previousUpdated = new Date("2026-08-30T12:01:00.000Z");
    await db.insert(pinballmapState).values({
      id: "singleton",
      locationId: 26454,
      snapshotJson: original,
      lastSyncAttemptAt: previousAttempt,
      lastSyncStatus: "ok",
      updatedAt: previousUpdated,
    });
    const fetchSpy = vi
      .spyOn(getMockClient(), "fetchLocation")
      .mockRejectedValueOnce(new Error("unknown location"));

    await expect(checkTrackedLocation(99999, CHECKED_BY)).resolves.toEqual({
      ok: false,
      reason: "fetch_failed",
      error: "unknown location",
    });
    const state = await getPinballMapState();
    expect(state?.locationId).toBe(26454);
    expect(state?.snapshotJson).toEqual(original);
    expect(state?.lastSyncStatus).toBe("ok");
    expect(state?.lastSyncAttemptAt?.getTime()).toBe(previousAttempt.getTime());
    expect(state?.updatedAt.getTime()).toBe(previousUpdated.getTime());
    fetchSpy.mockRestore();
  });

  it("classifies a missing Pinball Map location without storing a candidate", async () => {
    const db = await getTestDb();
    const { getMockClient } = await import("~/lib/pinballmap/client-mock");
    const { PinballMapReadError } = await import("~/lib/pinballmap/types");
    const { checkTrackedLocation } = await import("~/lib/pinballmap/state");
    const fetchSpy = vi
      .spyOn(getMockClient(), "fetchLocation")
      .mockRejectedValueOnce(
        new PinballMapReadError("not_found", "Location not found")
      );

    await expect(checkTrackedLocation(99999, CHECKED_BY)).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(await db.select().from(pinballmapLocationChecks)).toHaveLength(0);
    fetchSpy.mockRestore();
  });

  it("binds candidates to the checking administrator", async () => {
    const db = await getTestDb();
    const { getMockClient } = await import("~/lib/pinballmap/client-mock");
    const { checkTrackedLocation, commitCheckedTrackedLocation } =
      await import("~/lib/pinballmap/state");
    const otherAdmin = "00000000-0000-4000-8000-000000000002";
    const fetchSpy = vi
      .spyOn(getMockClient(), "fetchLocation")
      .mockResolvedValueOnce(snapshotAt(99999, "Checked venue"));

    const checked = await checkTrackedLocation(99999, CHECKED_BY);
    if (!checked.ok) throw new Error("expected a checked candidate");
    await expect(
      commitCheckedTrackedLocation(checked.candidate.checkId, otherAdmin)
    ).resolves.toEqual({ ok: false, reason: "unauthorized" });
    expect(await db.select().from(pinballmapLocationChecks)).toHaveLength(1);
    await expect(
      commitCheckedTrackedLocation(checked.candidate.checkId, CHECKED_BY)
    ).resolves.toEqual({ ok: true });
    fetchSpy.mockRestore();
  });

  it("expires candidates using database time and deletes them on commit", async () => {
    const db = await getTestDb();
    const { getMockClient } = await import("~/lib/pinballmap/client-mock");
    const { checkTrackedLocation, commitCheckedTrackedLocation } =
      await import("~/lib/pinballmap/state");
    const fetchSpy = vi
      .spyOn(getMockClient(), "fetchLocation")
      .mockResolvedValueOnce(snapshotAt(99999, "Short-lived venue"));

    const checked = await checkTrackedLocation(99999, CHECKED_BY);
    if (!checked.ok) throw new Error("expected a checked candidate");
    await db
      .update(pinballmapLocationChecks)
      .set({
        checkedAt: sql`now() - interval '2 seconds'`,
        expiresAt: sql`now() - interval '1 second'`,
      })
      .where(eq(pinballmapLocationChecks.id, checked.candidate.checkId));

    await expect(
      commitCheckedTrackedLocation(checked.candidate.checkId, CHECKED_BY)
    ).resolves.toEqual({ ok: false, reason: "expired" });
    expect(await db.select().from(pinballmapLocationChecks)).toHaveLength(0);
    expect(
      (await db.query.pinballmapState.findFirst())?.configurationGeneration
    ).toBe(0);
    fetchSpy.mockRestore();
  });

  it("lets concurrent administrators check independently but commits only the current generation", async () => {
    const db = await getTestDb();
    const { getMockClient } = await import("~/lib/pinballmap/client-mock");
    const {
      checkTrackedLocation,
      commitCheckedTrackedLocation,
      getPinballMapState,
    } = await import("~/lib/pinballmap/state");
    const otherAdmin = "00000000-0000-4000-8000-000000000002";
    const fetchSpy = vi
      .spyOn(getMockClient(), "fetchLocation")
      .mockResolvedValueOnce(snapshotAt(11111, "First venue"))
      .mockResolvedValueOnce(snapshotAt(22222, "Second venue"));

    const first = await checkTrackedLocation(11111, CHECKED_BY);
    const second = await checkTrackedLocation(22222, otherAdmin);
    if (!first.ok || !second.ok) {
      throw new Error("expected independent checked candidates");
    }
    expect(await db.select().from(pinballmapLocationChecks)).toHaveLength(2);

    await expect(
      commitCheckedTrackedLocation(first.candidate.checkId, CHECKED_BY)
    ).resolves.toEqual({ ok: true });
    await expect(
      commitCheckedTrackedLocation(second.candidate.checkId, otherAdmin)
    ).resolves.toEqual({ ok: false, reason: "concurrent_change" });
    expect(await getPinballMapState()).toMatchObject({
      locationId: 11111,
      configurationGeneration: 1,
    });
    expect(await db.select().from(pinballmapLocationChecks)).toHaveLength(0);
    fetchSpy.mockRestore();
  });

  it("returns the shared-allowance retry countdown without fetching", async () => {
    const { getMockClient } = await import("~/lib/pinballmap/client-mock");
    const { PBM_REFRESH_BURST } = await import("~/lib/pinballmap/config");
    const { checkTrackedLocation, syncLocationSnapshot } =
      await import("~/lib/pinballmap/state");
    const db = await getTestDb();
    await db.insert(pinballmapState).values({
      id: "singleton",
      locationId: 26454,
    });
    const fetchSpy = vi.spyOn(getMockClient(), "fetchLocation");
    for (let i = 0; i < PBM_REFRESH_BURST; i++) {
      await syncLocationSnapshot({ trigger: "manual" });
    }
    const callsBeforeSave = fetchSpy.mock.calls.length;

    const result = await checkTrackedLocation(99999, CHECKED_BY);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("throttled");
      if (result.reason === "throttled") {
        expect(result.retryAfterMs).toBeGreaterThan(0);
      }
    }
    expect(fetchSpy).toHaveBeenCalledTimes(callsBeforeSave);
    const [state] = await db.select().from(pinballmapState);
    expect(state?.locationId).toBe(26454);
    fetchSpy.mockRestore();
  });

  it("clears only the location and makes no external call", async () => {
    const db = await getTestDb();
    const { getMockClient } = await import("~/lib/pinballmap/client-mock");
    const { clearTrackedLocation, getPinballMapState } =
      await import("~/lib/pinballmap/state");
    const original = snapshotAt(26454, "APC", [{ id: 1, machineId: 100 }]);
    const lastSyncedAt = new Date("2026-08-31T01:00:00.000Z");
    await db.insert(pinballmapState).values({
      id: "singleton",
      locationId: 26454,
      snapshotJson: original,
      lastSyncedAt,
      lastSyncStatus: "ok",
      mutationLeaseId: "00000000-0000-4000-8000-000000000098",
      mutationLeaseExpiresAt: sql`now() - interval '1 minute'`,
    });
    const [machine] = await db
      .insert(machines)
      .values({
        name: "Godzilla",
        initials: "CLR",
        pinballmapMachineId: 6221,
        pinballmapIntent: "on",
      })
      .returning();
    if (!machine) throw new Error("failed to seed machine");
    await db.insert(pinballmapAbandonedListings).values({
      machineId: machine.id,
      lmxId: 4471,
      pinballmapMachineId: 6221,
      locationId: 26454,
    });
    const fetchSpy = vi.spyOn(getMockClient(), "fetchLocation");

    await expect(clearTrackedLocation(26454, 0)).resolves.toEqual({ ok: true });

    const state = await getPinballMapState();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state?.locationId).toBeNull();
    expect(state?.configurationGeneration).toBe(1);
    expect(state?.snapshotJson).toEqual(original);
    expect(state?.lastSyncedAt?.getTime()).toBe(lastSyncedAt.getTime());
    expect(state?.lastSyncStatus).toBe("ok");
    expect(state?.mutationLeaseId).toBeNull();
    expect(state?.mutationLeaseExpiresAt).toBeNull();
    expect((await db.query.machines.findFirst())?.pinballmapIntent).toBe("on");
    expect(await db.select().from(pinballmapAbandonedListings)).toHaveLength(1);
    fetchSpy.mockRestore();
  });
});

describe("tracked-location concurrency guards", () => {
  setupTestDb();

  it("drops an in-flight sync result after the tracked location changes", async () => {
    const db = await getTestDb();
    const { getMockClient } = await import("~/lib/pinballmap/client-mock");
    const { getPinballMapState, syncLocationSnapshot } =
      await import("~/lib/pinballmap/state");
    await db.insert(pinballmapState).values({
      id: "singleton",
      locationId: 26454,
      snapshotJson: snapshotAt(26454, "APC"),
      lastSyncStatus: "ok",
    });
    const fetchSpy = vi
      .spyOn(getMockClient(), "fetchLocation")
      .mockImplementationOnce(async () => {
        await db
          .update(pinballmapState)
          .set({ locationId: 77777 })
          .where(eq(pinballmapState.id, "singleton"));
        return snapshotAt(26454, "Stale APC", [{ id: 2, machineId: 200 }]);
      });

    await expect(syncLocationSnapshot({ trigger: "cron" })).resolves.toEqual({
      ok: false,
      reason: "superseded",
    });
    const state = await getPinballMapState();
    expect(state?.locationId).toBe(77777);
    expect(state?.snapshotJson?.name).toBe("APC");
    fetchSpy.mockRestore();
  });

  it("drops an older sync after a same-location checked commit", async () => {
    const db = await getTestDb();
    const { getMockClient } = await import("~/lib/pinballmap/client-mock");
    const {
      checkTrackedLocation,
      commitCheckedTrackedLocation,
      getPinballMapState,
      syncLocationSnapshot,
    } = await import("~/lib/pinballmap/state");
    await db.insert(pinballmapState).values({
      id: "singleton",
      locationId: 26454,
      snapshotJson: snapshotAt(26454, "Original APC"),
      lastSyncStatus: "ok",
    });
    const freshlyValidated = snapshotAt(26454, "Authoritative APC", [
      { id: 3, machineId: 300 },
    ]);
    const fetchSpy = vi
      .spyOn(getMockClient(), "fetchLocation")
      .mockImplementationOnce(async () => {
        const checked = await checkTrackedLocation(26454, CHECKED_BY);
        if (!checked.ok) throw new Error("expected a checked candidate");
        await expect(
          commitCheckedTrackedLocation(checked.candidate.checkId, CHECKED_BY)
        ).resolves.toEqual({ ok: true });
        return snapshotAt(26454, "Stale APC", [{ id: 2, machineId: 200 }]);
      })
      .mockResolvedValueOnce(freshlyValidated);

    await expect(syncLocationSnapshot({ trigger: "cron" })).resolves.toEqual({
      ok: false,
      reason: "superseded",
    });
    const state = await getPinballMapState();
    expect(state?.locationId).toBe(26454);
    expect(state?.configurationGeneration).toBe(1);
    expect(state?.snapshotJson).toEqual(freshlyValidated);
    fetchSpy.mockRestore();
  });

  it("does not check through an active configuration lease", async () => {
    const db = await getTestDb();
    const { getMockClient } = await import("~/lib/pinballmap/client-mock");
    const { checkTrackedLocation } = await import("~/lib/pinballmap/state");
    await db.insert(pinballmapState).values({
      id: "singleton",
      locationId: 26454,
      snapshotJson: snapshotAt(26454, "Original APC"),
      lastSyncStatus: "ok",
    });

    await db
      .update(pinballmapState)
      .set({
        mutationLeaseId: "00000000-0000-4000-8000-000000000099",
        mutationLeaseExpiresAt: sql`now() + interval '1 minute'`,
      })
      .where(eq(pinballmapState.id, "singleton"));
    const fetchSpy = vi.spyOn(getMockClient(), "fetchLocation");

    await expect(checkTrackedLocation(26454, CHECKED_BY)).resolves.toEqual({
      ok: false,
      reason: "busy",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("does not store a check over a concurrent configuration save", async () => {
    const db = await getTestDb();
    const { getMockClient } = await import("~/lib/pinballmap/client-mock");
    const { checkTrackedLocation, getPinballMapState } =
      await import("~/lib/pinballmap/state");
    await db.insert(pinballmapState).values({
      id: "singleton",
      locationId: 26454,
      snapshotJson: snapshotAt(26454, "APC"),
      lastSyncStatus: "ok",
    });
    const fetchSpy = vi
      .spyOn(getMockClient(), "fetchLocation")
      .mockImplementationOnce(async () => {
        await db
          .update(pinballmapState)
          .set({
            locationId: 77777,
            snapshotJson: snapshotAt(77777, "Concurrent venue"),
          })
          .where(eq(pinballmapState.id, "singleton"));
        return snapshotAt(99999, "Requested venue");
      });

    await expect(checkTrackedLocation(99999, CHECKED_BY)).resolves.toEqual({
      ok: false,
      reason: "concurrent_change",
    });
    const state = await getPinballMapState();
    expect(state?.locationId).toBe(77777);
    expect(state?.snapshotJson?.name).toBe("Concurrent venue");
    expect(await db.select().from(pinballmapLocationChecks)).toHaveLength(0);
    fetchSpy.mockRestore();
  });

  it("returns busy when commit or clear meets an active mutation lease", async () => {
    const db = await getTestDb();
    const { getMockClient } = await import("~/lib/pinballmap/client-mock");
    const {
      checkTrackedLocation,
      clearTrackedLocation,
      commitCheckedTrackedLocation,
    } = await import("~/lib/pinballmap/state");
    await db.insert(pinballmapState).values({
      id: "singleton",
      locationId: 26454,
      snapshotJson: snapshotAt(26454, "APC"),
      lastSyncStatus: "ok",
    });
    const fetchSpy = vi
      .spyOn(getMockClient(), "fetchLocation")
      .mockResolvedValueOnce(snapshotAt(99999, "Checked venue"));
    const checked = await checkTrackedLocation(99999, CHECKED_BY);
    if (!checked.ok) throw new Error("expected a checked candidate");
    await db
      .update(pinballmapState)
      .set({
        mutationLeaseId: "00000000-0000-4000-8000-000000000099",
        mutationLeaseExpiresAt: sql`now() + interval '1 minute'`,
      })
      .where(eq(pinballmapState.id, "singleton"));

    await expect(
      commitCheckedTrackedLocation(checked.candidate.checkId, CHECKED_BY)
    ).resolves.toEqual({ ok: false, reason: "busy" });
    await expect(clearTrackedLocation(26454, 0)).resolves.toEqual({
      ok: false,
      reason: "busy",
    });
    expect(
      (await db.query.pinballmapState.findFirst())?.configurationGeneration
    ).toBe(0);
    fetchSpy.mockRestore();
  });

  it("reclaims an expired mutation lease when committing", async () => {
    const db = await getTestDb();
    const { getMockClient } = await import("~/lib/pinballmap/client-mock");
    const {
      checkTrackedLocation,
      commitCheckedTrackedLocation,
      getPinballMapState,
    } = await import("~/lib/pinballmap/state");
    await db.insert(pinballmapState).values({
      id: "singleton",
      locationId: 26454,
      mutationLeaseId: "00000000-0000-4000-8000-000000000098",
      mutationLeaseExpiresAt: sql`now() - interval '1 minute'`,
    });
    const fetchSpy = vi
      .spyOn(getMockClient(), "fetchLocation")
      .mockResolvedValueOnce(snapshotAt(99999, "Checked venue"));

    const checked = await checkTrackedLocation(99999, CHECKED_BY);
    if (!checked.ok) throw new Error("expected a checked candidate");
    await expect(
      commitCheckedTrackedLocation(checked.candidate.checkId, CHECKED_BY)
    ).resolves.toEqual({ ok: true });

    expect(await getPinballMapState()).toMatchObject({
      locationId: 99999,
      mutationLeaseId: null,
      mutationLeaseExpiresAt: null,
    });
    fetchSpy.mockRestore();
  });

  it("guards clear with the expected location and generation", async () => {
    const db = await getTestDb();
    const { clearTrackedLocation, getPinballMapState } =
      await import("~/lib/pinballmap/state");
    await db.insert(pinballmapState).values({
      id: "singleton",
      locationId: 26454,
      configurationGeneration: 2,
      snapshotJson: snapshotAt(26454, "APC"),
    });

    await expect(clearTrackedLocation(26454, 1)).resolves.toEqual({
      ok: false,
      reason: "concurrent_change",
    });
    expect((await getPinballMapState())?.locationId).toBe(26454);
  });
});
