import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import {
  authUsers,
  machines,
  pinballmapAbandonedListings,
  pinballmapState,
  userProfiles,
} from "~/server/db/schema";
import type { LocationSnapshot, PbmCondition } from "~/lib/pinballmap/types";

const auth = vi.hoisted(() => ({ userId: "" }));

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});
vi.mock("~/lib/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: auth.userId } } }),
      },
    }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("~/lib/pinballmap/client", async () => {
  const { getMockClient } = await import("~/lib/pinballmap/client-mock");
  return { getPinballMapClient: () => Promise.resolve(getMockClient()) };
});

const LOCATION_ID = 26454;
const LMX_ID = 4471;
const TITLE_ID = 6221;

function snapshot(commentCount: number): LocationSnapshot {
  const conditions: PbmCondition[] = Array.from(
    { length: commentCount },
    (_, index) => ({
      id: index + 1,
      comment: `Condition ${index + 1}`,
      username: "member",
      createdAtIso: "2026-09-01T00:00:00.000Z",
    })
  );
  return {
    locationId: LOCATION_ID,
    name: "Austin Pinball Collective",
    dateLastUpdated: null,
    lastUpdatedByUsername: null,
    machineCount: 1,
    lmxes: [
      {
        id: LMX_ID,
        machineId: TITLE_ID,
        icEnabled: null,
        lastUpdatedByUsername: null,
        conditions,
      },
    ],
    fetchedAtIso: "2026-09-01T00:00:00.000Z",
    raw: null,
  };
}

function form(machineId: string, lmxId?: number): FormData {
  const data = new FormData();
  data.set("machineId", machineId);
  if (lmxId !== undefined) data.set("lmxId", String(lmxId));
  return data;
}

describe("removal comment freshness (spec 4.6)", () => {
  setupTestDb();

  async function seed(
    lastSyncedAt: Date,
    opts: { abandoned?: boolean; tokens?: number } = {}
  ): Promise<string> {
    const db = await getTestDb();
    auth.userId = randomUUID();
    await db.insert(authUsers).values({
      id: auth.userId,
      email: `${auth.userId}@example.com`,
    });
    await db.insert(userProfiles).values({
      id: auth.userId,
      email: `${auth.userId}@example.com`,
      firstName: "Test",
      lastName: "Admin",
      role: "admin",
    });
    const [machine] = await db
      .insert(machines)
      .values({
        name: "Godzilla",
        initials: "GZ",
        pinballmapMachineId: opts.abandoned ? 6222 : TITLE_ID,
        pinballmapIntent: "off",
      })
      .returning({ id: machines.id });
    if (!machine) throw new Error("machine seed failed");
    await db.insert(pinballmapState).values({
      id: "singleton",
      locationId: LOCATION_ID,
      snapshotJson: snapshot(2),
      lastSyncedAt,
      refreshTokens: opts.tokens ?? 3,
      refreshTokensAt: new Date(),
    });
    if (opts.abandoned)
      await db.insert(pinballmapAbandonedListings).values({
        machineId: machine.id,
        lmxId: LMX_ID,
        pinballmapMachineId: TITLE_ID,
        locationId: LOCATION_ID,
      });
    return machine.id;
  }

  it("uses a fresh stored count without spending the allowance", async () => {
    const machineId = await seed(new Date());
    const { getMockClient } = await import("~/lib/pinballmap/client-mock");
    const fetch = vi.spyOn(getMockClient(), "fetchLocation");
    const { checkRemovalCommentsAction } =
      await import("~/app/(app)/m/pinballmap-actions");

    const result = await checkRemovalCommentsAction(form(machineId));
    expect(result).toMatchObject({
      ok: true,
      value: { count: 2, freshness: "current" },
    });
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockRestore();
  });

  it("refreshes a stale ordinary entry and shows the new count", async () => {
    const machineId = await seed(new Date(Date.now() - 10 * 60_000));
    const { getMockClient } = await import("~/lib/pinballmap/client-mock");
    const fetch = vi
      .spyOn(getMockClient(), "fetchLocation")
      .mockResolvedValueOnce(snapshot(4));
    const { checkRemovalCommentsAction } =
      await import("~/app/(app)/m/pinballmap-actions");

    const result = await checkRemovalCommentsAction(form(machineId));
    expect(result).toMatchObject({
      ok: true,
      value: { count: 4, freshness: "current" },
    });
    const [state] = await (
      await getTestDb()
    )
      .select({ tokens: pinballmapState.refreshTokens })
      .from(pinballmapState);
    expect(state?.tokens).toBe(2);
    expect(fetch).toHaveBeenCalledOnce();
    fetch.mockRestore();
  });

  it("counts the refreshed title when Pinball Map re-mints its entry id", async () => {
    const machineId = await seed(new Date(Date.now() - 10 * 60_000));
    const { getMockClient } = await import("~/lib/pinballmap/client-mock");
    const refreshed = snapshot(4);
    const entry = refreshed.lmxes[0];
    if (!entry) throw new Error("snapshot seed failed");
    refreshed.lmxes[0] = { ...entry, id: 9900 };
    const fetch = vi
      .spyOn(getMockClient(), "fetchLocation")
      .mockResolvedValueOnce(refreshed);
    const { checkRemovalCommentsAction } =
      await import("~/app/(app)/m/pinballmap-actions");

    expect(await checkRemovalCommentsAction(form(machineId))).toMatchObject({
      ok: true,
      value: { count: 4, freshness: "current" },
    });
    fetch.mockRestore();
  });

  it("refreshes a stale abandoned entry by its original lmx", async () => {
    const machineId = await seed(new Date(Date.now() - 10 * 60_000), {
      abandoned: true,
    });
    const { getMockClient } = await import("~/lib/pinballmap/client-mock");
    const fetch = vi
      .spyOn(getMockClient(), "fetchLocation")
      .mockResolvedValueOnce(snapshot(3));
    const { checkRemovalCommentsAction } =
      await import("~/app/(app)/m/pinballmap-actions");

    expect(
      await checkRemovalCommentsAction(form(machineId, LMX_ID))
    ).toMatchObject({
      ok: true,
      value: { count: 3, freshness: "current" },
    });
    fetch.mockRestore();
  });

  it("reports the last-known count and age after a failed refresh", async () => {
    const old = new Date(Date.now() - 10 * 60_000);
    const machineId = await seed(old);
    const { getMockClient } = await import("~/lib/pinballmap/client-mock");
    const fetch = vi
      .spyOn(getMockClient(), "fetchLocation")
      .mockRejectedValueOnce(new Error("offline"));
    const { checkRemovalCommentsAction } =
      await import("~/app/(app)/m/pinballmap-actions");

    expect(await checkRemovalCommentsAction(form(machineId))).toEqual({
      ok: true,
      value: {
        count: 2,
        checkedAt: old,
        freshness: "last_known",
        failure: "failed",
      },
    });
    fetch.mockRestore();
  });

  it("does not fetch when the shared allowance is exhausted", async () => {
    const old = new Date(Date.now() - 10 * 60_000);
    const machineId = await seed(old, { tokens: 0 });
    const { getMockClient } = await import("~/lib/pinballmap/client-mock");
    const fetch = vi.spyOn(getMockClient(), "fetchLocation");
    const { checkRemovalCommentsAction } =
      await import("~/app/(app)/m/pinballmap-actions");

    expect(await checkRemovalCommentsAction(form(machineId))).toMatchObject({
      ok: true,
      value: {
        count: 2,
        checkedAt: old,
        freshness: "last_known",
        failure: "throttled",
      },
    });
    const [state] = await (
      await getTestDb()
    )
      .select({ tokens: pinballmapState.refreshTokens })
      .from(pinballmapState)
      .where(eq(pinballmapState.id, "singleton"));
    expect(state?.tokens).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockRestore();
  });
});
