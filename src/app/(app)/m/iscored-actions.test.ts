import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { machines } from "~/server/db/schema";
import { getIscoredGamesAction } from "./iscored-actions";
import { getGameroomGames } from "~/lib/iscored/client";
import { isIscoredConfigured } from "~/lib/iscored/config";

const { mockGetUser, mockFindFirstProfile, mockFindFirstMachine } = vi.hoisted(
  () => ({
    mockGetUser: vi.fn(),
    mockFindFirstProfile: vi.fn(),
    mockFindFirstMachine: vi.fn(),
  })
);

vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(async () => {
    await Promise.resolve();
    return {
      auth: { getUser: mockGetUser },
    };
  }),
}));

vi.mock("~/server/db", () => ({
  db: {
    query: {
      userProfiles: {
        findFirst: mockFindFirstProfile,
      },
      machines: {
        findFirst: mockFindFirstMachine,
      },
    },
  },
}));

vi.mock("~/lib/iscored/client", () => ({
  getGameroomGames: vi.fn(),
}));

vi.mock("~/lib/iscored/config", () => ({
  isIscoredConfigured: vi.fn(),
}));

describe("getIscoredGamesAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const result = await getIscoredGamesAction();
    expect(result).toEqual({ error: "Authentication required" });
    expect(getGameroomGames).not.toHaveBeenCalled();
  });

  it("returns error when user profile is not found", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mockFindFirstProfile.mockResolvedValue(undefined);

    const result = await getIscoredGamesAction();
    expect(result).toEqual({ error: "User profile not found" });
    expect(getGameroomGames).not.toHaveBeenCalled();
  });

  it("returns error when user has guest role (permission denied)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mockFindFirstProfile.mockResolvedValue({ role: "guest" });

    const result = await getIscoredGamesAction();
    expect(result).toEqual({ error: "Permission denied" });
    expect(getGameroomGames).not.toHaveBeenCalled();
  });

  it("returns error when user has member role without machine context (permission denied)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mockFindFirstProfile.mockResolvedValue({ role: "member" });

    const result = await getIscoredGamesAction();
    expect(result).toEqual({ error: "Permission denied" });
    expect(getGameroomGames).not.toHaveBeenCalled();
  });

  it("returns games list when user is member and owns the machine", async () => {
    const mockGames = [{ gameId: "77956", gameName: "Medieval Madness" }];
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mockFindFirstProfile.mockResolvedValue({ role: "member" });
    mockFindFirstMachine.mockResolvedValue({ ownerId: "user-123" });
    vi.mocked(isIscoredConfigured).mockReturnValue(true);
    vi.mocked(getGameroomGames).mockResolvedValue(mockGames);

    const result = await getIscoredGamesAction({ machineId: "machine-abc" });
    expect(result).toEqual({ games: mockGames });
    expect(getGameroomGames).toHaveBeenCalledTimes(1);
    expect(mockFindFirstMachine).toHaveBeenCalledWith(
      expect.objectContaining({
        where: eq(machines.id, "machine-abc"),
        columns: { ownerId: true },
      })
    );
  });

  it("returns error when user is member and does not own the machine", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mockFindFirstProfile.mockResolvedValue({ role: "member" });
    mockFindFirstMachine.mockResolvedValue({ ownerId: "other-user" });

    const result = await getIscoredGamesAction({ machineId: "machine-abc" });
    expect(result).toEqual({ error: "Permission denied" });
    expect(getGameroomGames).not.toHaveBeenCalled();
    expect(mockFindFirstMachine).toHaveBeenCalledWith(
      expect.objectContaining({
        where: eq(machines.id, "machine-abc"),
        columns: { ownerId: true },
      })
    );
  });

  it("returns error when user is member and machine is not found", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mockFindFirstProfile.mockResolvedValue({ role: "member" });
    mockFindFirstMachine.mockResolvedValue(undefined);

    const result = await getIscoredGamesAction({ machineId: "machine-abc" });
    expect(result).toEqual({ error: "Permission denied" });
    expect(getGameroomGames).not.toHaveBeenCalled();
    expect(mockFindFirstMachine).toHaveBeenCalledWith(
      expect.objectContaining({
        where: eq(machines.id, "machine-abc"),
        columns: { ownerId: true },
      })
    );
  });

  it("returns error when user is guest even if machineId is provided", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mockFindFirstProfile.mockResolvedValue({ role: "guest" });
    mockFindFirstMachine.mockResolvedValue({ ownerId: "user-123" });

    const result = await getIscoredGamesAction({ machineId: "machine-abc" });
    expect(result).toEqual({ error: "Permission denied" });
    expect(getGameroomGames).not.toHaveBeenCalled();
    expect(mockFindFirstMachine).toHaveBeenCalledWith(
      expect.objectContaining({
        where: eq(machines.id, "machine-abc"),
        columns: { ownerId: true },
      })
    );
  });

  it("returns error when iScored is not configured", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mockFindFirstProfile.mockResolvedValue({ role: "admin" });
    vi.mocked(isIscoredConfigured).mockReturnValue(false);

    const result = await getIscoredGamesAction();
    expect(result).toEqual({ error: "iScored is not configured" });
    expect(getGameroomGames).not.toHaveBeenCalled();
  });

  it("returns games list when authorized and configured", async () => {
    const mockGames = [
      { gameId: "77956", gameName: "Medieval Madness" },
      { gameId: "104656", gameName: "Demolition Man" },
    ];
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mockFindFirstProfile.mockResolvedValue({ role: "admin" });
    vi.mocked(isIscoredConfigured).mockReturnValue(true);
    vi.mocked(getGameroomGames).mockResolvedValue(mockGames);

    const result = await getIscoredGamesAction();
    expect(result).toEqual({ games: mockGames });
    expect(getGameroomGames).toHaveBeenCalledTimes(1);
  });

  it("returns error when getGameroomGames throws", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mockFindFirstProfile.mockResolvedValue({ role: "admin" });
    vi.mocked(isIscoredConfigured).mockReturnValue(true);
    vi.mocked(getGameroomGames).mockRejectedValue(new Error("Network failure"));

    const result = await getIscoredGamesAction();
    expect(result).toEqual({ error: "Failed to fetch iScored games" });
  });
});
