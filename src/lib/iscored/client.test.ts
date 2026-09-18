import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearIscoredCacheForTesting,
  getAllScoresForMachine,
  getGameroomGames,
  getTopScoresForMachine,
  refreshIscoredScores,
} from "./client";

describe("iscored client", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.ISCORED_USER = "Apcscore";
    clearIscoredCacheForTesting();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    process.env = originalEnv;
    clearIscoredCacheForTesting();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const mockApiScores = [
    {
      id: 101,
      game: 77956,
      gameName: "Medieval Madness",
      name: "Alice",
      score: 55000000,
      date: "2026-09-01 12:00:00",
      email: "alice@secret.com",
    },
    {
      id: 102,
      game: 77956,
      gameName: "Medieval Madness",
      name: "Bob",
      score: 85000000,
      date: "2026-09-02 14:00:00",
      email: "bob@secret.com",
    },
    {
      id: 103,
      game: 77956,
      gameName: "Medieval Madness",
      name: "Charlie",
      score: 30000000,
      date: "2026-09-03 16:00:00",
      email: "charlie@secret.com",
    },
    {
      id: 104,
      game: 77956,
      gameName: "Medieval Madness",
      name: "Dave",
      score: 15000000,
      date: "2026-09-04 18:00:00",
      email: "dave@secret.com",
    },
    {
      id: 201,
      game: 104656,
      gameName: "Demolition Man",
      name: "Eve",
      score: "1,250,000",
      date: "2026-09-05 10:00:00",
      email: "eve@secret.com",
    },
  ];

  describe("parsing, ranking, and PII email stripping (CORE-SEC-007)", () => {
    it("parses scores, normalizes numeric game to string, and strips emails at client boundary", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockApiScores), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const scores = await getAllScoresForMachine("77956");
      expect(scores).toHaveLength(4);

      // Verify rank order (descending by score)
      expect(scores[0]?.playerName).toBe("Bob");
      expect(scores[0]?.score).toBe(85000000);
      expect(scores[0]?.rank).toBe(1);
      expect(scores[0]?.gameId).toBe("77956");

      expect(scores[1]?.playerName).toBe("Alice");
      expect(scores[1]?.score).toBe(55000000);
      expect(scores[1]?.rank).toBe(2);

      expect(scores[2]?.playerName).toBe("Charlie");
      expect(scores[2]?.score).toBe(30000000);
      expect(scores[2]?.rank).toBe(3);

      expect(scores[3]?.playerName).toBe("Dave");
      expect(scores[3]?.score).toBe(15000000);
      expect(scores[3]?.rank).toBe(4);

      // CORE-SEC-007: Strictly verify email is not present on any record
      for (const score of scores) {
        expect(Object.hasOwn(score, "email")).toBe(false);
        expect(Object.keys(score)).not.toContain("email");
      }
    });

    it("parses string scores with commas", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockApiScores), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const scores = await getAllScoresForMachine("104656");
      expect(scores).toHaveLength(1);
      expect(scores[0]?.score).toBe(1250000);
      expect(scores[0]?.playerName).toBe("Eve");
      expect(scores[0]?.rank).toBe(1);
    });

    it("falls back to Anonymous when player name is empty or missing", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { id: 301, game: 999, name: "", score: 100 },
            { id: 302, game: 999, name: "   ", score: 200 },
            { id: 303, game: 999, score: 300 },
          ]),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      );

      const scores = await getAllScoresForMachine("999");
      expect(scores).toHaveLength(3);
      expect(scores[0]?.playerName).toBe("Anonymous");
      expect(scores[1]?.playerName).toBe("Anonymous");
      expect(scores[2]?.playerName).toBe("Anonymous");
    });

    it("masks email-shaped player names with Anonymous (CORE-SEC-007)", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { id: 401, game: 888, name: "user@domain.com", score: 500 },
            { id: 402, game: 888, name: "  player@test.org  ", score: 600 },
            { id: 403, game: 888, name: "ValidPlayer", score: 700 },
            { id: 404, game: 888, name: "Alice alice@example.com", score: 400 },
            { id: 405, game: 888, name: "bob@domain.org (Guest)", score: 300 },
          ]),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      );

      const scores = await getAllScoresForMachine("888");
      expect(scores).toHaveLength(5);
      expect(scores[0]?.playerName).toBe("ValidPlayer");
      expect(scores[1]?.playerName).toBe("Anonymous");
      expect(scores[2]?.playerName).toBe("Anonymous");
      expect(scores[3]?.playerName).toBe("Anonymous");
      expect(scores[4]?.playerName).toBe("Anonymous");
    });
  });

  describe("helper methods", () => {
    it("getTopScoresForMachine defaults to 3 scores", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockApiScores), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const topScores = await getTopScoresForMachine("77956");
      expect(topScores).toHaveLength(3);
      expect(topScores.map((s) => s.rank)).toEqual([1, 2, 3]);
    });

    it("getTopScoresForMachine respects custom limit", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockApiScores), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const topScores = await getTopScoresForMachine("77956", 2);
      expect(topScores).toHaveLength(2);
      expect(topScores[0]?.rank).toBe(1);
      expect(topScores[1]?.rank).toBe(2);
    });

    it("returns empty array for empty or unlinked game ID without fetching", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      expect(await getAllScoresForMachine("")).toEqual([]);
      expect(await getAllScoresForMachine("   ")).toEqual([]);
      expect(await getTopScoresForMachine("")).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("returns empty array when machine has no scores in gameroom", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockApiScores), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const scores = await getAllScoresForMachine("nonexistent_game_id");
      expect(scores).toEqual([]);
    });
  });

  describe("batch caching & 15-second throttle with SWR", () => {
    it("serves from cache on subsequent calls within 15 seconds", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(mockApiScores), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      // First call (cold cache)
      const scores1 = await getAllScoresForMachine("77956");
      expect(scores1).toHaveLength(4);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Second call (cache warm, within 15s)
      const scores2 = await getAllScoresForMachine("104656");
      expect(scores2).toHaveLength(1);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("serves stale cache immediately and triggers background refresh after 15 seconds", async () => {
      let fetchCount = 0;
      let resolveSecondFetch: (res: Response) => void = () => {};

      vi.spyOn(globalThis, "fetch").mockImplementation(() => {
        fetchCount++;
        if (fetchCount === 1) {
          return Promise.resolve(
            new Response(JSON.stringify(mockApiScores), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          );
        }

        // Second fetch: delayed promise to verify non-blocking SWR
        return new Promise((resolve) => {
          resolveSecondFetch = resolve;
        });
      });

      // Cold fetch at T=0
      vi.useFakeTimers();
      const initialTime = 1000000;
      vi.setSystemTime(initialTime);

      const scores1 = await getAllScoresForMachine("77956");
      expect(scores1).toHaveLength(4);
      expect(fetchCount).toBe(1);

      // Advance time by 16 seconds (past 15s TTL)
      vi.setSystemTime(initialTime + 16000);

      // Stale call: must return stale cached scores immediately without waiting for second fetch
      const stalePromise = getAllScoresForMachine("77956");
      const staleScores = await stalePromise;
      expect(staleScores).toHaveLength(4);
      expect(staleScores[0]?.playerName).toBe("Bob");

      // Background fetch was triggered
      expect(fetchCount).toBe(2);

      // Resolve the second fetch with updated scores
      const updatedScores = [
        {
          id: 105,
          game: 77956,
          gameName: "Medieval Madness",
          name: "NewChampion",
          score: 99999999,
          date: "2026-09-10 10:00:00",
        },
      ];
      resolveSecondFetch(
        new Response(JSON.stringify(updatedScores), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      // Wait a tick for the background promise to finish
      await vi.advanceTimersByTimeAsync(1);
      await Promise.resolve();

      // Subsequent call now receives the refreshed scores
      const freshScores = await getAllScoresForMachine("77956");
      expect(freshScores).toHaveLength(1);
      expect(freshScores[0]?.playerName).toBe("NewChampion");

      vi.useRealTimers();
    });

    it("deduplicates concurrent requests into a single in-flight fetch", async () => {
      let fetchCount = 0;
      vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        fetchCount++;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return new Response(JSON.stringify(mockApiScores), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      const [res1, res2, res3] = await Promise.all([
        getAllScoresForMachine("77956"),
        getAllScoresForMachine("104656"),
        getTopScoresForMachine("77956", 1),
      ]);

      expect(fetchCount).toBe(1);
      expect(res1).toHaveLength(4);
      expect(res2).toHaveLength(1);
      expect(res3).toHaveLength(1);
    });

    it("refreshIscoredScores explicitly triggers and awaits a fresh batch", async () => {
      let fetchCount = 0;
      vi.spyOn(globalThis, "fetch").mockImplementation(() => {
        fetchCount++;
        return Promise.resolve(
          new Response(JSON.stringify(mockApiScores), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      });

      await refreshIscoredScores();
      expect(fetchCount).toBe(1);

      const scores = await getAllScoresForMachine("77956");
      expect(scores).toHaveLength(4);
      expect(fetchCount).toBe(1); // Cached
    });

    it("throttles sequential refreshIscoredScores calls within 15 seconds", async () => {
      vi.useFakeTimers();
      const initialTime = 1000000;
      vi.setSystemTime(initialTime);

      let fetchCount = 0;
      vi.spyOn(globalThis, "fetch").mockImplementation(() => {
        fetchCount++;
        return Promise.resolve(
          new Response(JSON.stringify(mockApiScores), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      });

      await refreshIscoredScores();
      expect(fetchCount).toBe(1);

      // Immediately call refresh again
      await refreshIscoredScores();
      expect(fetchCount).toBe(1); // Throttled

      // Advance time past 15s TTL
      vi.setSystemTime(initialTime + 16000);
      await refreshIscoredScores();
      expect(fetchCount).toBe(2); // Allowed after TTL
    });

    it("returns detached cloned records to prevent external cache mutation", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(mockApiScores), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const firstCall = await getAllScoresForMachine("77956");
      expect(firstCall[0]?.playerName).toBe("Bob");

      // Mutate the returned object
      if (firstCall[0]) {
        firstCall[0].playerName = "MutatedHacker";
      }

      // Second call should still have original cached data
      const secondCall = await getAllScoresForMachine("77956");
      expect(secondCall[0]?.playerName).toBe("Bob");
    });
  });

  describe("graceful degradation", () => {
    it("returns empty array if ISCORED_USER is unset", async () => {
      delete process.env.ISCORED_USER;
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      const scores = await getAllScoresForMachine("77956");
      expect(scores).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("handles HTTP 500 error without throwing", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Internal Server Error", { status: 500 })
      );

      const scores = await getAllScoresForMachine("77956");
      expect(scores).toEqual([]);
    });

    it("handles network/timeout errors without throwing", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
        new Error("Network connection failed")
      );

      const scores = await getAllScoresForMachine("77956");
      expect(scores).toEqual([]);
    });

    it("handles upstream text response (user has no API access enabled) without throwing", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Sorry, this user does not have API access enabled.", {
          status: 200,
          headers: { "Content-Type": "text/html; charset=UTF-8" },
        })
      );

      const scores = await getAllScoresForMachine("77956");
      expect(scores).toEqual([]);
    });

    it("handles non-array JSON response without throwing", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "unknown format" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const scores = await getAllScoresForMachine("77956");
      expect(scores).toEqual([]);
    });
  });

  describe("getGameroomGames", () => {
    const mockGameroomGames = [
      {
        gameName: "Medieval Madness",
        gameID: "77956",
        CSSInitials: "...",
        GameLogo: "/community/images/games/game1",
      },
      {
        gameName: "Demolition Man",
        gameID: 104656,
        CSSInitials: "...",
      },
      {
        gameName: "Game of Thrones (half-height)",
        gameID: "79212",
      },
    ];

    it("parses and returns games sorted alphabetically by gameName", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockGameroomGames), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const games = await getGameroomGames();
      expect(games).toHaveLength(3);
      expect(games[0]).toEqual({
        gameId: "104656",
        gameName: "Demolition Man",
      });
      expect(games[1]).toEqual({
        gameId: "79212",
        gameName: "Game of Thrones (half-height)",
      });
      expect(games[2]).toEqual({
        gameId: "77956",
        gameName: "Medieval Madness",
      });
    });

    it("uses in-memory cache on subsequent calls within TTL", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockGameroomGames), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const first = await getGameroomGames();
      const second = await getGameroomGames();

      expect(first).toEqual(second);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("returns empty array when ISCORED_USER is unset", async () => {
      delete process.env.ISCORED_USER;
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      const games = await getGameroomGames();
      expect(games).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("gracefully handles HTTP error", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Server Error", { status: 500 })
      );

      const games = await getGameroomGames();
      expect(games).toEqual([]);
    });

    it("gracefully handles invalid JSON or non-array payload", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("not json", { status: 200 })
      );

      const games = await getGameroomGames();
      expect(games).toEqual([]);
    });

    it("preserves existing cached games when upstream response contains malformed records", async () => {
      vi.useFakeTimers();
      const initialTime = 1000000;
      vi.setSystemTime(initialTime);

      // 1. Initial successful fetch
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockGameroomGames), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
      const initial = await getGameroomGames();
      expect(initial).toHaveLength(3);

      // Advance time past 1 hour (3600000 ms)
      vi.setSystemTime(initialTime + 3600001);

      // 2. Second fetch returns a malformed record (missing gameID)
      const malformedGames = [
        ...mockGameroomGames,
        { gameName: "Broken Game", gameID: null },
      ];
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(malformedGames), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      // Should preserve previous cached games and not return empty/broken list
      const refreshed = await getGameroomGames();
      expect(refreshed).toHaveLength(3);
      expect(refreshed[0]?.gameName).toBe("Demolition Man");

      vi.useRealTimers();
    });
  });
});
