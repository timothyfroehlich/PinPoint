import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { createTestMachine, createTestUser } from "~/test/helpers/factories";
import {
  authUsers,
  machines,
  pinballmapAbandonedListings,
  pinballmapLocationChecks,
  pinballmapState,
  userProfiles,
} from "~/server/db/schema";
import * as state from "~/lib/pinballmap/state";
import * as sync from "~/lib/pinballmap/sync";
import type { LocationSnapshot } from "~/lib/pinballmap/types";

const { createClientMock, reportErrorMock, revalidatePathMock } = vi.hoisted(
  () => ({
    createClientMock: vi.fn(),
    reportErrorMock: vi.fn(),
    revalidatePathMock: vi.fn(),
  })
);

vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("~/lib/supabase/server", () => ({ createClient: createClientMock }));

vi.mock("~/lib/observability/report-error", () => ({
  reportError: reportErrorMock,
}));
vi.mock("server-only", () => ({}));
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});
const { fetchLocationMock } = vi.hoisted(() => ({
  fetchLocationMock: vi.fn(),
}));
vi.mock("~/lib/pinballmap/client", () => ({
  getPinballMapClient: () =>
    Promise.resolve({ fetchLocation: fetchLocationMock }),
}));

import {
  checkPinballMapLocationAction,
  clearPinballMapLocationAction,
  commitCheckedPinballMapLocationAction,
  syncPinballMapNowAction,
} from "~/app/(app)/admin/integrations/pinballmap/actions";

const ADMIN_ID = "5d9e7234-b866-4ce4-8419-d2e27d014acf";

function formData(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

setupTestDb();

const snapshot: LocationSnapshot = {
  locationId: 26454,
  name: "Austin Pinball Collective",
  city: "Austin",
  state: "TX",
  dateLastUpdated: null,
  lastUpdatedByUsername: null,
  machineCount: 0,
  lmxes: [],
  fetchedAtIso: "2026-09-12T12:00:00.000Z",
  raw: { location: "local fixture" },
};

beforeEach(async () => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  for (const method of [
    "checkTrackedLocation",
    "clearTrackedLocation",
    "commitCheckedTrackedLocation",
    "syncLocationSnapshot",
  ] as const)
    vi.spyOn(state, method);
  vi.spyOn(sync, "reconcileAfterSync");
  const db = await getTestDb();
  const admin = createTestUser({ id: ADMIN_ID, role: "admin" });
  await db.insert(authUsers).values({ id: ADMIN_ID, email: admin.email });
  await db.insert(userProfiles).values(admin);
  await db.insert(pinballmapState).values({
    id: "singleton",
    locationId: 26454,
    configurationGeneration: 7,
    snapshotJson: snapshot,
    refreshTokens: 3,
    refreshTokensAt: new Date(),
  });
  fetchLocationMock.mockResolvedValue(snapshot);
  createClientMock.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: ADMIN_ID } } }),
    },
  });
});

describe("Pinball Map admin actions", () => {
  it("uses the real permission matrix to reject a signed-in member from every action", async () => {
    await (
      await getTestDb()
    )
      .update(userProfiles)
      .set({ role: "member" })
      .where(eq(userProfiles.id, ADMIN_ID));

    const results = await Promise.all([
      checkPinballMapLocationAction(
        undefined,
        formData({ locationId: "26454" })
      ),
      commitCheckedPinballMapLocationAction(
        undefined,
        formData({
          checkId: "7b5c58da-25cc-46e7-9428-0c90d39e09c0",
        })
      ),
      clearPinballMapLocationAction(
        undefined,
        formData({ expectedLocationId: "26454", expectedGeneration: "3" })
      ),
      syncPinballMapNowAction(undefined, new FormData()),
    ]);

    expect(results).toEqual([
      { ok: false, reason: "unauthorized" },
      { ok: false, reason: "unauthorized" },
      { ok: false, reason: "unauthorized" },
      { ok: false, reason: "unauthorized" },
    ]);
    expect(vi.mocked(state.checkTrackedLocation)).not.toHaveBeenCalled();
    expect(
      vi.mocked(state.commitCheckedTrackedLocation)
    ).not.toHaveBeenCalled();
    expect(vi.mocked(state.clearTrackedLocation)).not.toHaveBeenCalled();
    expect(vi.mocked(state.syncLocationSnapshot)).not.toHaveBeenCalled();
  });

  it("validates numeric ids before calling the checked-location service", async () => {
    await expect(
      checkPinballMapLocationAction(undefined, formData({ locationId: "12x" }))
    ).resolves.toEqual({ ok: false, reason: "invalid" });
    expect(vi.mocked(state.checkTrackedLocation)).not.toHaveBeenCalled();
  });

  it("returns only the opaque id and scalar preview from a successful Check", async () => {
    const result = await checkPinballMapLocationAction(
      undefined,
      formData({ locationId: "26454" })
    );

    expect(vi.mocked(state.checkTrackedLocation)).toHaveBeenCalledWith(
      26454,
      ADMIN_ID
    );
    expect(result).toMatchObject({
      ok: true,
      candidate: {
        checkId: expect.any(String),
        machineCount: 0,
        checkedAtIso: expect.any(String),
        expiresAtIso: expect.any(String),
      },
      allowance: { remaining: 2 },
    });
    if (!result.ok) throw new Error("Check failed");
    const candidate = await (
      await getTestDb()
    ).query.pinballmapLocationChecks.findFirst({
      where: eq(pinballmapLocationChecks.id, result.candidate.checkId),
    });
    expect(candidate).toMatchObject({
      checkedBy: ADMIN_ID,
      locationId: 26454,
      snapshotJson: snapshot,
    });
    expect(result.candidate.checkedAtIso).toBe(
      candidate?.checkedAt.toISOString()
    );
    expect(result.candidate.expiresAtIso).toBe(
      candidate?.expiresAt.toISOString()
    );
    expect(JSON.stringify(result)).not.toContain("snapshotJson");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/integrations");
  });

  it.each([
    "not_found",
    "throttled",
    "busy",
    "concurrent_change",
    "fetch_failed",
  ] as const)("preserves the typed Check outcome: %s", async (reason) => {
    vi.mocked(state.checkTrackedLocation).mockResolvedValue(
      reason === "throttled"
        ? { ok: false, reason, retryAfterMs: 60_000 }
        : reason === "fetch_failed"
          ? { ok: false, reason, error: "upstream failed" }
          : { ok: false, reason }
    );

    await expect(
      checkPinballMapLocationAction(
        undefined,
        formData({ locationId: "26454" })
      )
    ).resolves.toMatchObject({
      ok: false,
      reason,
      allowance: { remaining: 3 },
    });
  });

  it("commits with only the opaque check id and the authenticated user", async () => {
    const db = await getTestDb();
    const checked = await checkPinballMapLocationAction(
      undefined,
      formData({ locationId: "26454" })
    );
    if (!checked.ok) throw new Error("Check failed");
    const checkId = checked.candidate.checkId;

    await expect(
      commitCheckedPinballMapLocationAction(undefined, formData({ checkId }))
    ).resolves.toEqual({ ok: true });

    expect(vi.mocked(state.commitCheckedTrackedLocation)).toHaveBeenCalledWith(
      checkId,
      ADMIN_ID,
      ADMIN_ID
    );
    expect(vi.mocked(state.commitCheckedTrackedLocation)).toHaveBeenCalledTimes(
      1
    );
    expect(await db.query.pinballmapState.findFirst()).toMatchObject({
      locationId: 26454,
      configurationGeneration: 8,
      snapshotJson: snapshot,
      updatedBy: ADMIN_ID,
    });
    expect(
      await db.query.pinballmapLocationChecks.findFirst({
        where: eq(pinballmapLocationChecks.id, checkId),
      })
    ).toBeUndefined();
    expect(fetchLocationMock).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sync.reconcileAfterSync)).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/integrations");
  });

  it.each(["not_found", "expired", "busy", "concurrent_change"] as const)(
    "preserves the typed commit outcome: %s",
    async (reason) => {
      vi.mocked(state.commitCheckedTrackedLocation).mockResolvedValue({
        ok: false,
        reason,
      });
      const result = await commitCheckedPinballMapLocationAction(
        undefined,
        formData({
          checkId: "7b5c58da-25cc-46e7-9428-0c90d39e09c0",
        })
      );
      expect(result).toEqual({ ok: false, reason });
      expect(vi.mocked(sync.reconcileAfterSync)).not.toHaveBeenCalled();
      expect(revalidatePathMock).toHaveBeenCalledWith("/admin/integrations");
    }
  );

  it("guards a clear with the expected location and generation", async () => {
    await expect(
      clearPinballMapLocationAction(
        undefined,
        formData({ expectedLocationId: "26454", expectedGeneration: "7" })
      )
    ).resolves.toEqual({ ok: true });

    expect(vi.mocked(state.clearTrackedLocation)).toHaveBeenCalledWith(
      26454,
      7,
      ADMIN_ID
    );
    expect(
      await (await getTestDb()).query.pinballmapState.findFirst()
    ).toMatchObject({
      locationId: null,
      configurationGeneration: 8,
      updatedBy: ADMIN_ID,
    });
    expect(fetchLocationMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/integrations");
  });

  it.each(["busy", "concurrent_change"] as const)(
    "preserves the typed clear outcome and revalidates: %s",
    async (reason) => {
      vi.mocked(state.clearTrackedLocation).mockResolvedValue({
        ok: false,
        reason,
      });

      await expect(
        clearPinballMapLocationAction(
          undefined,
          formData({ expectedLocationId: "26454", expectedGeneration: "7" })
        )
      ).resolves.toEqual({ ok: false, reason });
      expect(revalidatePathMock).toHaveBeenCalledWith("/admin/integrations");
    }
  );

  it("syncs manually, reconciles, returns allowance, and refreshes the page", async () => {
    const db = await getTestDb();
    const machine = createTestMachine();
    await db.insert(machines).values(machine);
    await db.insert(pinballmapAbandonedListings).values([
      {
        machineId: machine.id,
        lmxId: 501,
        pinballmapMachineId: 7,
        locationId: 26454,
      },
      {
        machineId: machine.id,
        lmxId: 502,
        pinballmapMachineId: 7,
        locationId: 99999,
      },
    ]);

    await expect(
      syncPinballMapNowAction(undefined, new FormData())
    ).resolves.toMatchObject({ ok: true, allowance: { remaining: 2 } });
    expect(vi.mocked(state.syncLocationSnapshot)).toHaveBeenCalledWith({
      updatedBy: ADMIN_ID,
      trigger: "manual",
    });
    expect(vi.mocked(sync.reconcileAfterSync)).toHaveBeenCalledTimes(1);
    expect(await db.query.pinballmapState.findFirst()).toMatchObject({
      snapshotJson: snapshot,
      lastSyncStatus: "ok",
      refreshTokens: 2,
      updatedBy: ADMIN_ID,
    });
    expect(await db.select().from(pinballmapAbandonedListings)).toMatchObject([
      { lmxId: 502, locationId: 99999 },
    ]);
    expect(fetchLocationMock).toHaveBeenCalledTimes(1);
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/integrations");
  });

  it.each([
    ["error", "fetch_failed"],
    ["busy", "busy"],
    ["not_configured", "not_configured"],
    ["superseded", "concurrent_change"],
    ["throttled", "throttled"],
  ] as const)("maps sync %s to %s", async (serviceReason, actionReason) => {
    vi.mocked(state.syncLocationSnapshot).mockResolvedValue(
      serviceReason === "error"
        ? { ok: false, reason: serviceReason, error: "HTTP 503" }
        : serviceReason === "throttled"
          ? { ok: false, reason: serviceReason, retryAfterMs: 60_000 }
          : { ok: false, reason: serviceReason }
    );

    await expect(
      syncPinballMapNowAction(undefined, new FormData())
    ).resolves.toMatchObject({ ok: false, reason: actionReason });
    expect(vi.mocked(sync.reconcileAfterSync)).not.toHaveBeenCalled();
  });
});
