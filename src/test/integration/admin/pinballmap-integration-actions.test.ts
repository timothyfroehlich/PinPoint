import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  checkTrackedLocationMock,
  clearTrackedLocationMock,
  commitCheckedTrackedLocationMock,
  createClientMock,
  getRefreshAllowanceMock,
  getUserAccessLevelMock,
  reconcileAfterSyncMock,
  reportErrorMock,
  revalidatePathMock,
  syncLocationSnapshotMock,
} = vi.hoisted(() => ({
  checkTrackedLocationMock: vi.fn(),
  clearTrackedLocationMock: vi.fn(),
  commitCheckedTrackedLocationMock: vi.fn(),
  createClientMock: vi.fn(),
  getRefreshAllowanceMock: vi.fn(),
  getUserAccessLevelMock: vi.fn(),
  reconcileAfterSyncMock: vi.fn(),
  reportErrorMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  // A verbose name keeps this distinct from the action under test.
  syncLocationSnapshotMock: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("~/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("~/lib/permissions/access", () => ({
  getUserAccessLevel: getUserAccessLevelMock,
}));
vi.mock("~/lib/observability/report-error", () => ({
  reportError: reportErrorMock,
}));
vi.mock("~/lib/pinballmap/sync", () => ({
  reconcileAfterSync: reconcileAfterSyncMock,
}));
vi.mock("~/lib/pinballmap/state", () => ({
  checkTrackedLocation: checkTrackedLocationMock,
  clearTrackedLocation: clearTrackedLocationMock,
  commitCheckedTrackedLocation: commitCheckedTrackedLocationMock,
  getRefreshAllowance: getRefreshAllowanceMock,
  syncLocationSnapshot: syncLocationSnapshotMock,
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

beforeEach(() => {
  vi.clearAllMocks();
  createClientMock.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: ADMIN_ID } },
      }),
    },
  });
  getUserAccessLevelMock.mockResolvedValue("admin");
  getRefreshAllowanceMock.mockResolvedValue({
    remaining: 2,
    nextRefillAt: new Date("2026-09-12T12:03:00.000Z"),
  });
  reconcileAfterSyncMock.mockResolvedValue({ abandonmentsCleared: 0 });
});

describe("Pinball Map admin actions", () => {
  it("uses the real permission matrix to reject a signed-in member from every action", async () => {
    getUserAccessLevelMock.mockResolvedValue("member");

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
    expect(checkTrackedLocationMock).not.toHaveBeenCalled();
    expect(commitCheckedTrackedLocationMock).not.toHaveBeenCalled();
    expect(clearTrackedLocationMock).not.toHaveBeenCalled();
    expect(syncLocationSnapshotMock).not.toHaveBeenCalled();
  });

  it("validates numeric ids before calling the checked-location service", async () => {
    await expect(
      checkPinballMapLocationAction(undefined, formData({ locationId: "12x" }))
    ).resolves.toEqual({ ok: false, reason: "invalid" });
    expect(checkTrackedLocationMock).not.toHaveBeenCalled();
  });

  it("returns only the opaque id and scalar preview from a successful Check", async () => {
    checkTrackedLocationMock.mockResolvedValue({
      ok: true,
      candidate: {
        checkId: "7b5c58da-25cc-46e7-9428-0c90d39e09c0",
        locationId: 26454,
        name: "Austin Pinball Collective",
        city: "Austin",
        state: "TX",
        machineCount: 0,
        checkedAt: new Date("2026-09-12T12:00:00.000Z"),
        expiresAt: new Date("2026-09-12T12:10:00.000Z"),
      },
    });

    const result = await checkPinballMapLocationAction(
      undefined,
      formData({ locationId: "26454" })
    );

    expect(checkTrackedLocationMock).toHaveBeenCalledWith(26454, ADMIN_ID);
    expect(result).toMatchObject({
      ok: true,
      candidate: {
        checkId: "7b5c58da-25cc-46e7-9428-0c90d39e09c0",
        machineCount: 0,
        checkedAtIso: "2026-09-12T12:00:00.000Z",
        expiresAtIso: "2026-09-12T12:10:00.000Z",
      },
      allowance: { remaining: 2 },
    });
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
    checkTrackedLocationMock.mockResolvedValue(
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
      allowance: { remaining: 2 },
    });
  });

  it("commits with only the opaque check id and the authenticated user", async () => {
    commitCheckedTrackedLocationMock.mockResolvedValue({ ok: true });
    const checkId = "7b5c58da-25cc-46e7-9428-0c90d39e09c0";

    await expect(
      commitCheckedPinballMapLocationAction(undefined, formData({ checkId }))
    ).resolves.toEqual({ ok: true });

    expect(commitCheckedTrackedLocationMock).toHaveBeenCalledWith(
      checkId,
      ADMIN_ID,
      ADMIN_ID
    );
    expect(commitCheckedTrackedLocationMock).toHaveBeenCalledTimes(1);
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/integrations");
  });

  it.each(["not_found", "expired", "busy", "concurrent_change"] as const)(
    "preserves the typed commit outcome: %s",
    async (reason) => {
      commitCheckedTrackedLocationMock.mockResolvedValue({ ok: false, reason });
      const result = await commitCheckedPinballMapLocationAction(
        undefined,
        formData({
          checkId: "7b5c58da-25cc-46e7-9428-0c90d39e09c0",
        })
      );
      expect(result).toEqual({ ok: false, reason });
      expect(revalidatePathMock).toHaveBeenCalledWith("/admin/integrations");
    }
  );

  it("guards a clear with the expected location and generation", async () => {
    clearTrackedLocationMock.mockResolvedValue({ ok: true });

    await expect(
      clearPinballMapLocationAction(
        undefined,
        formData({ expectedLocationId: "26454", expectedGeneration: "7" })
      )
    ).resolves.toEqual({ ok: true });

    expect(clearTrackedLocationMock).toHaveBeenCalledWith(26454, 7, ADMIN_ID);
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/integrations");
  });

  it.each(["busy", "concurrent_change"] as const)(
    "preserves the typed clear outcome and revalidates: %s",
    async (reason) => {
      clearTrackedLocationMock.mockResolvedValue({ ok: false, reason });

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
    syncLocationSnapshotMock.mockResolvedValue({
      ok: true,
      machineCount: 47,
      syncedAt: new Date("2026-09-12T12:00:00.000Z"),
    });

    await expect(
      syncPinballMapNowAction(undefined, new FormData())
    ).resolves.toMatchObject({ ok: true, allowance: { remaining: 2 } });
    expect(syncLocationSnapshotMock).toHaveBeenCalledWith({
      updatedBy: ADMIN_ID,
      trigger: "manual",
    });
    expect(reconcileAfterSyncMock).toHaveBeenCalledTimes(1);
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/integrations");
  });

  it.each([
    ["error", "fetch_failed"],
    ["busy", "busy"],
    ["not_configured", "not_configured"],
    ["superseded", "concurrent_change"],
    ["throttled", "throttled"],
  ] as const)("maps sync %s to %s", async (serviceReason, actionReason) => {
    syncLocationSnapshotMock.mockResolvedValue(
      serviceReason === "error"
        ? { ok: false, reason: serviceReason, error: "HTTP 503" }
        : serviceReason === "throttled"
          ? { ok: false, reason: serviceReason, retryAfterMs: 60_000 }
          : { ok: false, reason: serviceReason }
    );

    await expect(
      syncPinballMapNowAction(undefined, new FormData())
    ).resolves.toMatchObject({ ok: false, reason: actionReason });
    expect(reconcileAfterSyncMock).not.toHaveBeenCalled();
  });
});
