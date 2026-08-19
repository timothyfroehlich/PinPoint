/**
 * Integration tests for the Admin Integrations Pinball Map section actions
 * (spec §4–§6). These drive the REAL state.ts orchestration against PGlite,
 * mocking only the boundaries that reach out of process:
 *   1. `~/lib/supabase/server`      — the auth client (who is calling)
 *   2. `~/lib/permissions/access`   — the caller's access level
 *   3. `~/lib/pinballmap/client`    — the PBM HTTP seam (CORE-TEST-006)
 *   4. `next/cache`                 — revalidatePath
 *
 * The mock PBM client ignores the requested location id and is a singleton, so
 * save ORDERING is proven by fetch CALL COUNT: enabling while changing location
 * must fetch exactly once — `changeLocation` validates the new id and commits
 * it together with that venue's lineup, then the enable skips its own refresh
 * because the snapshot is already fresh. Disabling while changing location must
 * fetch zero times.
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import type { MockInstance } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { pinballmapState } from "~/server/db/schema";
import type { LocationSnapshot } from "~/lib/pinballmap/types";
import type { createClient } from "~/lib/supabase/server";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

vi.mock("~/lib/pinballmap/client", async () => {
  const { getMockClient } = await import("~/lib/pinballmap/client-mock");
  return { getPinballMapClient: () => Promise.resolve(getMockClient()) };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("~/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("~/lib/permissions/access", () => ({ getUserAccessLevel: vi.fn() }));

const ADMIN_ID = "00000000-0000-0000-0000-000000000001";

const ACTIONS = "~/app/(app)/admin/integrations/pinballmap-actions";

async function asRole(role: "admin" | "member"): Promise<void> {
  const { createClient: createClientMock } =
    await import("~/lib/supabase/server");
  vi.mocked(createClientMock).mockResolvedValue({
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: ADMIN_ID } } }),
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>);

  const { getUserAccessLevel } = await import("~/lib/permissions/access");
  vi.mocked(getUserAccessLevel).mockResolvedValue(role);
}

function snapshotAt(
  locationId: number,
  machineCount: number
): LocationSnapshot {
  return {
    locationId,
    name: "Seed venue",
    dateLastUpdated: "2026-01-01",
    lastUpdatedByUsername: "seed",
    machineCount,
    lmxes: [],
    fetchedAtIso: new Date().toISOString(),
    raw: { seed: true },
  };
}

async function seedState(
  fields: Partial<typeof pinballmapState.$inferInsert>
): Promise<void> {
  const db = await getTestDb();
  await db
    .insert(pinballmapState)
    .values({ id: "singleton", ...fields })
    .onConflictDoUpdate({ target: pinballmapState.id, set: fields });
}

async function readState(): Promise<typeof pinballmapState.$inferSelect> {
  const db = await getTestDb();
  const [row] = await db
    .select()
    .from(pinballmapState)
    .where(eq(pinballmapState.id, "singleton"));
  if (!row) throw new Error("state row missing");
  return row;
}

describe("Admin Integrations — Pinball Map actions (PGlite)", () => {
  setupTestDb();

  let fetchSpy: MockInstance<() => Promise<LocationSnapshot>>;

  beforeAll(async () => {
    const { getMockClient } = await import("~/lib/pinballmap/client-mock");
    fetchSpy = vi.spyOn(getMockClient(), "fetchLocation");
  });

  beforeEach(() => {
    fetchSpy.mockClear();
  });

  describe("savePinballMapConfigAction", () => {
    it("rejects a caller without the manage-integrations capability (§7)", async () => {
      await asRole("member");
      const { savePinballMapConfigAction } = await import(ACTIONS);
      const fd = new FormData();
      fd.set("enabled", "true");
      fd.set("locationId", "222");
      await expect(savePinballMapConfigAction(undefined, fd)).rejects.toThrow(
        /permission/i
      );
    });

    it("returns a validation error for a non-numeric location id", async () => {
      await asRole("admin");
      const { savePinballMapConfigAction } = await import(ACTIONS);
      const fd = new FormData();
      fd.set("enabled", "false");
      fd.set("locationId", "not-a-number");
      const result = await savePinballMapConfigAction(undefined, fd);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("VALIDATION");
    });

    it("enabling while changing location fetches exactly once, of the new location (§5.2, §6.7 ordering)", async () => {
      await asRole("admin");
      await seedState({ enabled: false, locationId: 111 });
      const { savePinballMapConfigAction } = await import(ACTIONS);

      const fd = new FormData();
      fd.set("enabled", "true");
      fd.set("locationId", "222");
      const result = await savePinballMapConfigAction(undefined, fd);

      expect(result.ok).toBe(true);
      // One fetch total, and it is the VALIDATING one: because the end state is
      // enabled, changeLocation fetches location 222 and commits id+snapshot
      // together (§6.2), then the enable skips its own refresh because that
      // snapshot is already fresh. Previously the single fetch happened the
      // other way round — the id was committed unvalidated and only then
      // refreshed — which is what let a typo'd id land as a warning (see the
      // next test).
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(222);
      const state = await readState();
      expect(state.enabled).toBe(true);
      expect(state.locationId).toBe(222);
      expect(state.lastSyncStatus).toBe("ok");
    });

    it("enabling with an unreachable location id changes nothing and errors (§6.2)", async () => {
      await asRole("admin");
      await seedState({ enabled: false, locationId: 111 });
      const { savePinballMapConfigAction } = await import(ACTIONS);

      // A typo'd id: Pinball Map has no such location.
      fetchSpy.mockRejectedValueOnce(new Error("404 Not Found"));

      const fd = new FormData();
      fd.set("enabled", "true");
      fd.set("locationId", "999999");
      const result = await savePinballMapConfigAction(undefined, fd);

      // A hard error, not ok({warning}) — nothing about the request succeeded.
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("FETCH");

      // And nothing was committed: still disabled, still pointed at 111, so no
      // machine page can read a bogus location against the old venue's lineup.
      const state = await readState();
      expect(state.enabled).toBe(false);
      expect(state.locationId).toBe(111);
    });

    it("disabling while changing location makes no Pinball Map call and clears the old snapshot (§6.7)", async () => {
      await asRole("admin");
      await seedState({
        enabled: true,
        locationId: 111,
        snapshotJson: snapshotAt(111, 0),
        lastSyncStatus: "ok",
      });
      const { savePinballMapConfigAction } = await import(ACTIONS);

      const fd = new FormData();
      fd.set("enabled", "false");
      fd.set("locationId", "222");
      const result = await savePinballMapConfigAction(undefined, fd);

      expect(result.ok).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
      const state = await readState();
      expect(state.enabled).toBe(false);
      expect(state.locationId).toBe(222);
      // Snapshot CLEARED. Keeping 111's lineup stored under location 222 is a
      // row that disagrees with itself, and every reader treats it as fact —
      // see the §6.7 case in pinballmap-state.test.ts for the full list. Nulled,
      // they all fall into the "not synced yet" path they already have, which is
      // the truth until the next enable's refresh.
      expect(state.snapshotJson).toBeNull();
      expect(state.lastSyncedAt).toBeNull();
      expect(state.lastSyncStatus).toBe("unknown");
    });

    it("re-pointing while disabled leaves nothing for a machine page to misread (§6.7)", async () => {
      await asRole("admin");
      await seedState({
        enabled: false,
        locationId: 111,
        snapshotJson: snapshotAt(111, 3),
        lastSyncedAt: new Date(),
        lastSyncStatus: "ok",
      });
      const { savePinballMapConfigAction } = await import(ACTIONS);

      // Location only — the integration is already off, so this is the plain
      // "re-point while disabled" save rather than a combined toggle.
      const fd = new FormData();
      fd.set("enabled", "false");
      fd.set("locationId", "222");
      const result = await savePinballMapConfigAction(undefined, fd);

      expect(result.ok).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
      const state = await readState();
      expect(state.locationId).toBe(222);
      expect(state.snapshotJson).toBeNull();
      expect(state.lastSyncStatus).toBe("unknown");
      expect(state.lastSyncedAt).toBeNull();
    });

    it("a no-op save (nothing changed) does not fetch", async () => {
      await asRole("admin");
      await seedState({ enabled: false, locationId: 111 });
      const { savePinballMapConfigAction } = await import(ACTIONS);

      const fd = new FormData();
      fd.set("enabled", "false");
      fd.set("locationId", "111");
      const result = await savePinballMapConfigAction(undefined, fd);

      expect(result.ok).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("syncPinballMapNowAction", () => {
    it("returns machineCount on a successful refresh (§4.3)", async () => {
      await asRole("admin");
      await seedState({ enabled: true, locationId: 111 });
      const { syncPinballMapNowAction } = await import(ACTIONS);

      const result = await syncPinballMapNowAction(undefined, new FormData());
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.machineCount).toBeGreaterThan(0);
    });

    it("maps a spent allowance to THROTTLED with a retry delay (§4.3)", async () => {
      await asRole("admin");
      await seedState({
        enabled: true,
        locationId: 111,
        refreshTokens: 0,
        refreshTokensAt: new Date(),
      });
      const { syncPinballMapNowAction } = await import(ACTIONS);

      const result = await syncPinballMapNowAction(undefined, new FormData());
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("THROTTLED");
        expect(result.meta?.retryAfterMs ?? 0).toBeGreaterThan(0);
      }
      // No token to spend → no fetch.
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
