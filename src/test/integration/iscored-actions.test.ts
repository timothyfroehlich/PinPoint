/**
 * Integration Test: iScored games action and ownership permissions
 *
 * Worker-scoped PGlite (CORE-TEST-001, CORE-TEST-004).
 * Tests machine-ownership permission enforcement for `getIscoredGamesAction`
 * against real Postgres database rows with real Drizzle queries.
 */

import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getIscoredGamesAction } from "~/app/(app)/m/iscored-actions";
import { getGameroomGames } from "~/lib/iscored/client";
import { isIscoredConfigured } from "~/lib/iscored/config";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { signInAs, signOut } from "~/test/helpers/mock-auth";
import { seedMachine, seedUser } from "~/test/helpers/seed";
import type { IscoredGame } from "~/lib/iscored/types";

vi.mock("~/lib/supabase/server", () => import("~/test/helpers/mock-auth"));
vi.mock("~/lib/iscored/client", () => ({ getGameroomGames: vi.fn() }));
vi.mock("~/lib/iscored/config", () => ({ isIscoredConfigured: vi.fn() }));

const mockGames: IscoredGame[] = [
  { gameId: "77956", gameName: "Medieval Madness" },
  { gameId: "104656", gameName: "Demolition Man" },
];

describe("getIscoredGamesAction", () => {
  setupTestDb();

  beforeEach(() => {
    vi.clearAllMocks();
    signOut();
    vi.mocked(isIscoredConfigured).mockReturnValue(true);
    vi.mocked(getGameroomGames).mockResolvedValue(mockGames);
  });

  afterEach(() => vi.restoreAllMocks());

  async function makeUser(
    role: "guest" | "member" | "technician" | "admin"
  ): Promise<string> {
    return (await seedUser({ role })).id;
  }

  async function makeMachine(ownerId: string | null): Promise<string> {
    return (await seedMachine({ ownerId })).id;
  }

  it("returns error when user is not authenticated", async () => {
    expect(await getIscoredGamesAction()).toEqual({
      error: "Authentication required",
    });
    expect(getGameroomGames).not.toHaveBeenCalled();
  });

  it("returns error when the authenticated user has no profile even when another profile exists", async () => {
    await makeUser("admin");
    signInAs(randomUUID());
    expect(await getIscoredGamesAction()).toEqual({
      error: "User profile not found",
    });
    expect(getGameroomGames).not.toHaveBeenCalled();
  });

  it.each(["guest", "member"] as const)(
    "refuses a %s without machine context",
    async (role) => {
      signInAs(await makeUser(role));
      expect(await getIscoredGamesAction()).toEqual({
        error: "Permission denied",
      });
      expect(getGameroomGames).not.toHaveBeenCalled();
    }
  );

  it("returns error when machine lookup throws", async () => {
    signInAs(await makeUser("member"));
    const db = await getTestDb();
    vi.spyOn(db.query.machines, "findFirst").mockRejectedValueOnce(
      new Error("Connection reset")
    );
    expect(await getIscoredGamesAction({ machineId: randomUUID() })).toEqual({
      error: "Failed to verify machine ownership",
    });
    expect(getGameroomGames).not.toHaveBeenCalled();
  });

  it("returns error when iScored is not configured", async () => {
    signInAs(await makeUser("admin"));
    vi.mocked(isIscoredConfigured).mockReturnValue(false);
    expect(await getIscoredGamesAction()).toEqual({
      error: "iScored is not configured",
    });
    expect(getGameroomGames).not.toHaveBeenCalled();
  });

  it("returns error when getGameroomGames throws", async () => {
    signInAs(await makeUser("admin"));
    vi.mocked(getGameroomGames).mockRejectedValue(new Error("Network failure"));
    expect(await getIscoredGamesAction()).toEqual({
      error: "Failed to fetch iScored games",
    });
  });

  it("lets a member owner fetch iScored games for their owned machine when multiple machines exist", async () => {
    const callerId = await makeUser("member");
    const otherMemberId = await makeUser("member");
    // Seed unowned machine first so a missing where clause returns the wrong machine
    await makeMachine(otherMemberId);
    const ownedMachineId = await makeMachine(callerId);
    signInAs(callerId);

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
    signInAs(callerId);

    const result = await getIscoredGamesAction({ machineId: unownedMachineId });
    expect(result).toEqual({ error: "Permission denied" });
    expect(getGameroomGames).not.toHaveBeenCalled();
  });

  it("refuses a member when machine does not exist", async () => {
    const memberId = await makeUser("member");
    signInAs(memberId);

    const result = await getIscoredGamesAction({ machineId: randomUUID() });
    expect(result).toEqual({ error: "Permission denied" });
    expect(getGameroomGames).not.toHaveBeenCalled();
  });

  it("refuses a guest even when providing an owned machineId", async () => {
    const ownerId = await makeUser("member");
    const guestId = await makeUser("guest");
    const machineId = await makeMachine(ownerId);
    signInAs(guestId);

    const result = await getIscoredGamesAction({ machineId });
    expect(result).toEqual({ error: "Permission denied" });
    expect(getGameroomGames).not.toHaveBeenCalled();
  });

  it.each(["technician", "admin"] as const)(
    "lets a %s fetch games without machine ownership context",
    async (role) => {
      const staffId = await makeUser(role);
      signInAs(staffId);

      const result = await getIscoredGamesAction();
      expect(result).toEqual({ games: mockGames });
      expect(getGameroomGames).toHaveBeenCalledTimes(1);
    }
  );
});
