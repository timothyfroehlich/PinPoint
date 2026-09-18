import { beforeEach, describe, expect, it, vi } from "vitest";
import { getIscoredGamesAction } from "./iscored-actions";
import { createClient } from "~/lib/supabase/server";
import { getGameroomGames } from "~/lib/iscored/client";
import { isIscoredConfigured } from "~/lib/iscored/config";

vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
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
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const result = await getIscoredGamesAction();
    expect(result).toEqual({ error: "Authentication required" });
    expect(getGameroomGames).not.toHaveBeenCalled();
  });

  it("returns error when iScored is not configured", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: "user-123" } } }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);
    vi.mocked(isIscoredConfigured).mockReturnValue(false);

    const result = await getIscoredGamesAction();
    expect(result).toEqual({ error: "iScored is not configured" });
    expect(getGameroomGames).not.toHaveBeenCalled();
  });

  it("returns games list when authenticated and configured", async () => {
    const mockGames = [
      { gameId: "77956", gameName: "Medieval Madness" },
      { gameId: "104656", gameName: "Demolition Man" },
    ];
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: "user-123" } } }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);
    vi.mocked(isIscoredConfigured).mockReturnValue(true);
    vi.mocked(getGameroomGames).mockResolvedValue(mockGames);

    const result = await getIscoredGamesAction();
    expect(result).toEqual({ games: mockGames });
    expect(getGameroomGames).toHaveBeenCalledTimes(1);
  });

  it("returns error when getGameroomGames throws", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: "user-123" } } }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);
    vi.mocked(isIscoredConfigured).mockReturnValue(true);
    vi.mocked(getGameroomGames).mockRejectedValue(new Error("Network failure"));

    const result = await getIscoredGamesAction();
    expect(result).toEqual({ error: "Failed to fetch iScored games" });
  });
});
