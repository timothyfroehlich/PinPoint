/**
 * Integration Test: PinballMap sync triggers (PP-o355.11)
 *
 * Covers the two ways a snapshot sync is kicked off:
 *  - the CRON_SECRET-gated GET /api/cron/pinballmap-sync route (auth + the
 *    `enabled` dormancy gate)
 *  - the technician+ `syncPinballMapNowAction` server action (permission gate)
 *
 * Real PGlite + real permission matrix + real sync/reconcile; the PBM client is
 * pinned to the in-memory mock at its seam (CORE-TEST-006) so nothing reaches
 * pinballmap.com. Auth identity, logger, and next/cache are mocked at their
 * boundaries.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { userProfiles, pinballmapState } from "~/server/db/schema";
import { createTestUser } from "~/test/helpers/factories";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";

vi.mock("~/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockGetUser = vi.fn();
vi.mock("~/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: mockGetUser } }),
}));

// Route the production db import to the PGlite worker instance.
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

// Pin the PBM client to the in-memory mock at the seam (CORE-TEST-006).
vi.mock("~/lib/pinballmap/client", async () => {
  const { getMockClient } = await import("~/lib/pinballmap/client-mock");
  return { getPinballMapClient: () => getMockClient() };
});

// Import AFTER the db mock so route + action pick up PGlite.
const { GET } = await import("~/app/api/cron/pinballmap-sync/route");
const { syncPinballMapNowAction } =
  await import("~/app/(app)/m/pinballmap-actions");

const CRON_SECRET = "test-cron-secret";
const CRON_URL = "http://localhost/api/cron/pinballmap-sync";

function cronRequest(bearer: string): Request {
  return new Request(CRON_URL, { headers: { authorization: bearer } });
}

async function enableIntegration(): Promise<void> {
  const db = await getTestDb();
  await db
    .insert(pinballmapState)
    .values({ id: "singleton", enabled: true, locationId: 26454 });
}

async function seedUser(
  role: "guest" | "member" | "technician" | "admin"
): Promise<string> {
  const id = randomUUID();
  const db = await getTestDb();
  await db
    .insert(userProfiles)
    .values(createTestUser({ id, role, email: `${role}-${id}@test.com` }));
  return id;
}

describe("GET /api/cron/pinballmap-sync", () => {
  setupTestDb();

  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", CRON_SECRET);
  });

  it("rejects a wrong bearer with 401", async () => {
    const res = await GET(cronRequest("Bearer wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("with the right bearer + enabled, syncs and reconciles", async () => {
    await enableIntegration();
    const res = await GET(cronRequest(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      machineCount?: number;
      healed?: number;
    };
    expect(body.ok).toBe(true);
    expect(body.machineCount ?? 0).toBeGreaterThan(0);
    expect(body.healed).toBe(0);

    const { getPinballMapState } = await import("~/lib/pinballmap/state");
    const state = await getPinballMapState();
    expect(state?.lastSyncStatus).toBe("ok");
  });

  it("is dormant (no PBM call) while the integration is disabled", async () => {
    const res = await GET(cronRequest(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; skipped?: string };
    expect(body).toEqual({ ok: true, skipped: "disabled" });

    // No snapshot was fetched or stored.
    const { getPinballMapState } = await import("~/lib/pinballmap/state");
    expect(await getPinballMapState()).toBeNull();
  });
});

describe("syncPinballMapNowAction", () => {
  setupTestDb();

  it("denies an unauthenticated caller", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await syncPinballMapNowAction(undefined, new FormData());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("UNAUTHORIZED");
  });

  it("denies a member (below technician+)", async () => {
    const id = await seedUser("member");
    mockGetUser.mockResolvedValueOnce({ data: { user: { id } } });
    const result = await syncPinballMapNowAction(undefined, new FormData());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("UNAUTHORIZED");
  });

  it("allows a technician and returns the synced machine count", async () => {
    const id = await seedUser("technician");
    mockGetUser.mockResolvedValueOnce({ data: { user: { id } } });
    const result = await syncPinballMapNowAction(undefined, new FormData());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.machineCount).toBeGreaterThan(0);
      expect(result.value.healed).toBe(0);
    }
  });
});
