/**
 * Integration Test: PinballMap snapshot sync + "Sync now" (PP-o355.3)
 *
 * Covers the bead-C server surface against PGlite:
 *  - syncLocationSnapshot(): stores the whole snapshot on the singleton, sets
 *    sync health (ok/error), upserts (one row), records the error path
 *  - getPinballMapState(): reads the singleton
 *  - syncPinballMapNowAction(): permission gating (pinballmap.sync = tech+)
 */

import { describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { userProfiles, authUsers, pinballmapState } from "~/server/db/schema";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("~/lib/logger", () => ({
  log: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Pin the PinballMap client to the in-memory mock at the seam (CORE-TEST-006),
// so the sync can never reach pinballmap.com regardless of PINBALLMAP_MODE.
vi.mock("~/lib/pinballmap/client", async () => {
  const { getMockClient } = await import("~/lib/pinballmap/client-mock");
  return { getPinballMapClient: () => getMockClient() };
});

async function createUser(
  role: "guest" | "member" | "technician" | "admin"
): Promise<{ id: string }> {
  const db = await getTestDb();
  const id = randomUUID();
  await db.insert(authUsers).values({ id, email: `${id}@example.com` });
  const [user] = await db
    .insert(userProfiles)
    .values({
      id,
      email: `${id}@example.com`,
      firstName: "Test",
      lastName: "User",
      role,
    })
    .returning();
  return user;
}

async function mockAuthAs(userId: string | null): Promise<void> {
  const { createClient } = await import("~/lib/supabase/server");
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: userId ? { id: userId } : null } }),
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
}

describe("PinballMap snapshot sync (PGlite)", () => {
  setupTestDb();

  it("syncLocationSnapshot stores the snapshot and marks health ok", async () => {
    const { syncLocationSnapshot, getPinballMapState } =
      await import("~/lib/pinballmap/sync");

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
    const { syncLocationSnapshot } = await import("~/lib/pinballmap/sync");

    await syncLocationSnapshot();
    await syncLocationSnapshot();

    const rows = await db.select().from(pinballmapState);
    expect(rows.length).toBe(1);
    expect(rows[0]?.id).toBe("singleton");
  });

  it("records the error path without throwing when the fetch fails", async () => {
    const { getMockClient } = await import("~/lib/pinballmap/client-mock");
    const { syncLocationSnapshot, getPinballMapState } =
      await import("~/lib/pinballmap/sync");
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
});

describe("syncPinballMapNowAction — permission gating (PGlite)", () => {
  setupTestDb();

  it("technician can sync", async () => {
    const tech = await createUser("technician");
    await mockAuthAs(tech.id);
    const { syncPinballMapNowAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const result = await syncPinballMapNowAction();
    expect(result.ok).toBe(true);
  });

  it("member is denied", async () => {
    const member = await createUser("member");
    await mockAuthAs(member.id);
    const { syncPinballMapNowAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const result = await syncPinballMapNowAction();
    expect(result.ok).toBe(false);
  });

  it("unauthenticated is denied", async () => {
    await mockAuthAs(null);
    const { syncPinballMapNowAction } =
      await import("~/app/(app)/m/pinballmap-actions");
    const result = await syncPinballMapNowAction();
    expect(result.ok).toBe(false);
  });
});
