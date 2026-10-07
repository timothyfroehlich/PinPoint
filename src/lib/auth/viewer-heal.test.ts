/**
 * MainLayout's missing-profile heal, now behind getHealedViewer (PP-az4d.9).
 *
 * A signed-in user whose user_profiles row is missing (e.g. after a database
 * reset) gets the row recreated on the next app navigation. getViewer alone
 * never writes.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { authUsers } from "~/server/db/schema";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";

const { getUserMock } = vi.hoisted(() => ({ getUserMock: vi.fn() }));

vi.mock("~/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: getUserMock } }),
}));

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  const db = await getTestDb();
  return { db };
});

vi.mock("~/lib/logger", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const { getHealedViewer, getViewer } = await import("~/lib/auth/viewer");

describe("getHealedViewer", () => {
  setupTestDb();

  beforeEach(() => {
    getUserMock.mockReset();
  });

  async function signInWithoutProfile(): Promise<string> {
    const userId = randomUUID();
    const email = `heal-${userId}@example.com`;
    const db = await getTestDb();
    await db.insert(authUsers).values({ id: userId, email });
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: userId,
          email,
          user_metadata: { first_name: "Heal", last_name: "Me" },
        },
      },
      error: null,
    });
    return userId;
  }

  it("recreates a missing profile row and returns it", async () => {
    const userId = await signInWithoutProfile();

    const viewer = await getHealedViewer();

    expect(viewer).toEqual({
      userId,
      role: "guest",
      profile: expect.objectContaining({ name: "Heal Me", role: "guest" }),
    });
  });

  it("getViewer leaves a missing profile row missing", async () => {
    const userId = await signInWithoutProfile();

    await expect(getViewer()).resolves.toEqual({
      userId,
      role: null,
      profile: null,
    });
  });

  it("renders a signed-out visitor as signed out", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    await expect(getHealedViewer()).resolves.toEqual({
      userId: undefined,
      role: null,
      profile: null,
    });
  });
});
