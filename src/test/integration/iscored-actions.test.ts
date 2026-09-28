/**
 * Integration Test: iScored games action permissions (PP-1v6u)
 *
 * Worker-scoped PGlite (CORE-TEST-001, CORE-TEST-004).
 * Tests machine-ownership permission enforcement for `getIscoredGamesAction`
 * against real Postgres database rows with real Drizzle queries.
 */

import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authUsers, machines, userProfiles } from "~/server/db/schema";
import { getIscoredGamesAction } from "~/app/(app)/m/iscored-actions";
import { getGameroomGames } from "~/lib/iscored/client";
import { isIscoredConfigured } from "~/lib/iscored/config";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import type { IscoredGame } from "~/lib/iscored/types";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

vi.mock("~/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("~/lib/iscored/client", () => ({ getGameroomGames: vi.fn() }));
vi.mock("~/lib/iscored/config", () => ({ isIscoredConfigured: vi.fn() }));

const mockGames: IscoredGame[] = [
  { gameId: "77956", gameName: "Medieval Madness" },
  { gameId: "104656", gameName: "Demolition Man" },
];

describe("getIscoredGamesAction — machine ownership integration (PP-1v6u)", () => {
  setupTestDb();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isIscoredConfigured).mockReturnValue(true);
    vi.mocked(getGameroomGames).mockResolvedValue(mockGames);
  });

  async function makeUser(
    role: "guest" | "member" | "technician" | "admin"
  ): Promise<string> {
    const db = await getTestDb();
    const id = randomUUID();
    await db.insert(authUsers).values({ id, email: `${id}@example.com` });
    await db.insert(userProfiles).values({
      id,
      email: `${id}@example.com`,
      firstName: "Test",
      lastName: "User",
      role,
    });
    return id;
  }

  let machineCounter = 0;
  async function makeMachine(ownerId: string | null): Promise<string> {
    const db = await getTestDb();
    machineCounter += 1;
    const [machine] = await db
      .insert(machines)
      .values({
        name: `Test Machine ${machineCounter}`,
        initials: `IS${String(machineCounter).padStart(3, "0")}`,
        ownerId,
      })
      .returning({ id: machines.id });
    if (!machine) throw new Error("machine insert failed");
    return machine.id;
  }

  async function mockAuth(userId: string | null): Promise<void> {
    const { createClient } = await import("~/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: userId ? { id: userId } : null },
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);
  }

  it("lets a member owner fetch iScored games for their owned machine when multiple machines exist", async () => {
    const callerId = await makeUser("member");
    const otherMemberId = await makeUser("member");
    // Seed unowned machine first so a missing where clause returns the wrong machine
    await makeMachine(otherMemberId);
    const ownedMachineId = await makeMachine(callerId);
    await mockAuth(callerId);

    const result = await getIscoredGamesAction({ machineId: ownedMachineId });
    expect(result).toEqual({ games: mockGames });
    expect(getGameroomGames).toHaveBeenCalledTimes(1);
  });

  it("refuses a member when calling with a machine they do not own, even when they own another machine", async () => {
    const callerId = await makeUser("member");
    const otherMemberId = await makeUser("member");
    // Seed owned machine first so a where: eq(ownerId, user.id) or missing where returns the owned machine
    await makeMachine(callerId);
    const unownedMachineId = await makeMachine(otherMemberId);
    await mockAuth(callerId);

    const result = await getIscoredGamesAction({ machineId: unownedMachineId });
    expect(result).toEqual({ error: "Permission denied" });
    expect(getGameroomGames).not.toHaveBeenCalled();
  });

  it("refuses a member when machine does not exist", async () => {
    const memberId = await makeUser("member");
    await mockAuth(memberId);

    const result = await getIscoredGamesAction({ machineId: randomUUID() });
    expect(result).toEqual({ error: "Permission denied" });
    expect(getGameroomGames).not.toHaveBeenCalled();
  });

  it("refuses a guest even when providing an owned machineId", async () => {
    const ownerId = await makeUser("member");
    const guestId = await makeUser("guest");
    const machineId = await makeMachine(ownerId);
    await mockAuth(guestId);

    const result = await getIscoredGamesAction({ machineId });
    expect(result).toEqual({ error: "Permission denied" });
    expect(getGameroomGames).not.toHaveBeenCalled();
  });

  it.each(["technician", "admin"] as const)(
    "lets a %s fetch games without machine ownership context",
    async (role) => {
      const staffId = await makeUser(role);
      await mockAuth(staffId);

      const result = await getIscoredGamesAction();
      expect(result).toEqual({ games: mockGames });
      expect(getGameroomGames).toHaveBeenCalledTimes(1);
    }
  );
});
