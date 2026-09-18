import "server-only";

import { cache as reactCache } from "react";
import { log } from "~/lib/logger";
import {
  ISCORED_BASE_URL,
  ISCORED_CACHE_TTL_MS,
  ISCORED_GAMES_CACHE_TTL_MS,
  getGameroomUrl,
  getIscoredUser,
  getScoreEntryUrl,
} from "./config";
import type { IscoredGame, IscoredScore } from "./types";

export { getGameroomUrl, getScoreEntryUrl };
export type { IscoredGame, IscoredScore };

interface CacheState {
  scoresByGameId: Map<string, IscoredScore[]>;
  lastFetchedAt: number | null;
  refreshPromise: Promise<void> | null;
  user: string | null;
}

const cache: CacheState = {
  scoresByGameId: new Map(),
  lastFetchedAt: null,
  refreshPromise: null,
  user: null,
};

function parseScoreValue(val: unknown): number {
  if (typeof val === "number") {
    return Number.isFinite(val) ? Math.floor(val) : 0;
  }
  if (typeof val === "string") {
    const cleaned = val.replace(/,/g, "").trim();
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? Math.floor(parsed) : 0;
  }
  return 0;
}

const EMAIL_IN_TEXT_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

function parsePlayerName(val: unknown): string {
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (trimmed.length > 0 && !EMAIL_IN_TEXT_REGEX.test(trimmed)) {
      return trimmed;
    }
  }
  return "Anonymous";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseGameId(val: unknown): string | null {
  if (typeof val === "number") {
    return Number.isFinite(val) ? String(val) : null;
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

/**
 * Parses raw JSON items from iScored into unranked sanitized score objects.
 *
 * CORE-SEC-007 compliance: Player email addresses are strictly stripped at this
 * boundary. `raw.email` is never read, retained, logged, or returned.
 */
function parseAndSanitizeScores(
  items: unknown[]
): Omit<IscoredScore, "rank">[] {
  const sanitized: Omit<IscoredScore, "rank">[] = [];

  for (const item of items) {
    if (!isRecord(item)) {
      continue;
    }

    const gameId = parseGameId(item["game"]);
    if (!gameId) {
      continue;
    }

    const id =
      typeof item["id"] === "number" ? item["id"] : Number(item["id"]) || 0;
    const gameName =
      typeof item["gameName"] === "string" ? item["gameName"].trim() : "";
    const playerName = parsePlayerName(item["name"]);
    const scoreVal = parseScoreValue(item["score"]);
    const date = typeof item["date"] === "string" ? item["date"].trim() : "";

    sanitized.push({
      id,
      gameId,
      gameName,
      playerName,
      score: scoreVal,
      date,
    });
  }

  return sanitized;
}

/**
 * Groups scores by `gameId`, sorts each leaderboard descending by score,
 * and assigns sequential 1-based ranks.
 */
function groupAndRankScores(
  scores: Omit<IscoredScore, "rank">[]
): Map<string, IscoredScore[]> {
  const grouped = new Map<string, Omit<IscoredScore, "rank">[]>();

  for (const s of scores) {
    const list = grouped.get(s.gameId);
    if (list) {
      list.push(s);
    } else {
      grouped.set(s.gameId, [s]);
    }
  }

  const result = new Map<string, IscoredScore[]>();

  for (const [gameId, list] of grouped.entries()) {
    list.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.date.localeCompare(a.date);
    });

    const ranked: IscoredScore[] = list.map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

    result.set(gameId, ranked);
  }

  return result;
}

/**
 * Fetches all scores from iScored in a single gameroom batch and populates the cache.
 * Catches all errors gracefully to prevent crashing callers or page loads.
 */
async function fetchAndCacheScores(user: string): Promise<void> {
  const url = `${ISCORED_BASE_URL}/api/${encodeURIComponent(user)}/getAllScores?max=10`;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      log.warn(
        { status: res.status, user },
        "iScored API returned non-OK status"
      );
      cache.lastFetchedAt = Date.now();
      return;
    }

    const text = await res.text();
    let rawData: unknown;
    try {
      rawData = JSON.parse(text);
    } catch {
      // Upstream returns 200 text/html when API read access is disabled or user not found
      log.warn({ user }, "iScored API response was not valid JSON");
      cache.lastFetchedAt = Date.now();
      return;
    }

    if (!Array.isArray(rawData)) {
      log.warn({ user }, "iScored API response was not an array");
      cache.lastFetchedAt = Date.now();
      return;
    }

    const parsed = parseAndSanitizeScores(rawData);
    cache.scoresByGameId = groupAndRankScores(parsed);
    cache.lastFetchedAt = Date.now();
  } catch (err) {
    log.warn({ err, user }, "Failed to fetch iScored scores");
    cache.lastFetchedAt = Date.now();
  }
}

function triggerRefresh(user: string): Promise<void> {
  if (cache.refreshPromise) {
    return cache.refreshPromise;
  }
  cache.refreshPromise = fetchAndCacheScores(user).finally(() => {
    cache.refreshPromise = null;
  });
  return cache.refreshPromise;
}

function syncUser(user: string): void {
  if (cache.user !== user) {
    cache.scoresByGameId = new Map();
    cache.lastFetchedAt = null;
    cache.refreshPromise = null;
    cache.user = user;
  }
}

/**
 * Ensures the cache is ready.
 *
 * - Cold cache (`lastFetchedAt === null`): Await initial fetch so initial page load
 *   receives leaderboard data.
 * - Warm cache: Return immediately. If older than 15s, trigger an asynchronous
 *   background refresh (stale-while-revalidate non-blocking).
 */
async function ensureCacheReady(user: string): Promise<void> {
  syncUser(user);

  const now = Date.now();
  if (cache.lastFetchedAt === null) {
    await triggerRefresh(user);
    return;
  }

  if (now - cache.lastFetchedAt > ISCORED_CACHE_TTL_MS) {
    void triggerRefresh(user);
  }
}

/**
 * Retrieves all scores for a specific machine's iScored game ID.
 *
 * Returns empty array if `ISCORED_USER` is unset, game ID is unlinked/blank,
 * or if upstream is unreachable.
 */
export const getAllScoresForMachine = reactCache(
  async (iscoredGameId: string): Promise<IscoredScore[]> => {
    const trimmedId = iscoredGameId.trim();
    if (!trimmedId) {
      return [];
    }

    const user = getIscoredUser();
    if (!user) {
      return [];
    }

    await ensureCacheReady(user);
    return (
      cache.scoresByGameId.get(trimmedId)?.map((score) => ({ ...score })) ?? []
    );
  }
);

/**
 * Retrieves the top scores for a specific machine's iScored game ID.
 *
 * @param iscoredGameId The machine's linked iScored game ID.
 * @param limit Maximum number of top scores to return (defaults to 3).
 */
export async function getTopScoresForMachine(
  iscoredGameId: string,
  limit = 3
): Promise<IscoredScore[]> {
  const scores = await getAllScoresForMachine(iscoredGameId);
  return scores.slice(0, Math.max(0, limit));
}

/**
 * Explicitly triggers a cache refresh for the gameroom and awaits completion.
 * Throttled to the 15-second minimum interval (Spec §3.3).
 */
export async function refreshIscoredScores(): Promise<void> {
  const user = getIscoredUser();
  if (!user) {
    return;
  }
  syncUser(user);
  if (
    cache.lastFetchedAt !== null &&
    Date.now() - cache.lastFetchedAt < ISCORED_CACHE_TTL_MS
  ) {
    return;
  }
  await triggerRefresh(user);
}

/**
 * Games list cache state.
 */
interface GamesCacheState {
  games: IscoredGame[];
  lastFetchedAt: number | null;
  refreshPromise: Promise<void> | null;
  user: string | null;
}

const gamesCache: GamesCacheState = {
  games: [],
  lastFetchedAt: null,
  refreshPromise: null,
  user: null,
};

function parseAndSanitizeGames(items: unknown[]): IscoredGame[] | null {
  const games: IscoredGame[] = [];
  const seenIds = new Set<string>();

  for (const item of items) {
    if (!isRecord(item)) {
      return null;
    }

    const gameId = parseGameId(
      item["gameID"] ?? item["gameId"] ?? item["game"]
    );
    if (!gameId) {
      return null;
    }

    const rawName =
      typeof item["gameName"] === "string"
        ? item["gameName"].trim()
        : typeof item["name"] === "string"
          ? item["name"].trim()
          : "";

    if (!rawName) {
      return null;
    }

    if (!seenIds.has(gameId)) {
      seenIds.add(gameId);
      games.push({
        gameId,
        gameName: rawName,
      });
    }
  }

  games.sort((a, b) => a.gameName.localeCompare(b.gameName));
  return games;
}

const FAILURE_RETRY_INTERVAL_MS = 15_000;

function markFetchFailure(): void {
  // Rather than caching an empty failure for the full 1-hour TTL,
  // set lastFetchedAt to expire after a short retry interval (15s).
  gamesCache.lastFetchedAt =
    Date.now() - ISCORED_GAMES_CACHE_TTL_MS + FAILURE_RETRY_INTERVAL_MS;
}

async function fetchAndCacheGames(user: string): Promise<void> {
  const url = `${ISCORED_BASE_URL}/api/${encodeURIComponent(user)}`;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      log.warn(
        { status: res.status, user },
        "iScored API returned non-OK status for gameroom games"
      );
      markFetchFailure();
      return;
    }

    const text = await res.text();
    let rawData: unknown;
    try {
      rawData = JSON.parse(text);
    } catch {
      log.warn(
        { user },
        "iScored gameroom games API response was not valid JSON"
      );
      markFetchFailure();
      return;
    }

    if (!Array.isArray(rawData)) {
      log.warn(
        { user },
        "iScored gameroom games API response was not an array"
      );
      markFetchFailure();
      return;
    }

    const parsedGames = parseAndSanitizeGames(rawData);
    if (parsedGames === null) {
      log.warn(
        { user },
        "iScored gameroom games response contained malformed records; preserving cache"
      );
      markFetchFailure();
      return;
    }

    gamesCache.games = parsedGames;
    gamesCache.lastFetchedAt = Date.now();
  } catch (err) {
    log.warn({ err, user }, "Failed to fetch iScored gameroom games");
    markFetchFailure();
  }
}

function triggerGamesRefresh(user: string): Promise<void> {
  if (gamesCache.refreshPromise) {
    return gamesCache.refreshPromise;
  }
  gamesCache.refreshPromise = fetchAndCacheGames(user).finally(() => {
    gamesCache.refreshPromise = null;
  });
  return gamesCache.refreshPromise;
}

function syncGamesUser(user: string): void {
  if (gamesCache.user !== user) {
    gamesCache.games = [];
    gamesCache.lastFetchedAt = null;
    gamesCache.refreshPromise = null;
    gamesCache.user = user;
  }
}

async function ensureGamesCacheReady(user: string): Promise<void> {
  syncGamesUser(user);

  const now = Date.now();
  if (gamesCache.lastFetchedAt === null) {
    await triggerGamesRefresh(user);
    return;
  }

  if (now - gamesCache.lastFetchedAt > ISCORED_GAMES_CACHE_TTL_MS) {
    void triggerGamesRefresh(user);
  }
}

/**
 * Retrieves the full list of games configured in the iScored gameroom.
 *
 * Server-side cached for 1 hour. Returns an empty array if `ISCORED_USER`
 * is not configured or upstream is unreachable.
 */
export const getGameroomGames = reactCache(async (): Promise<IscoredGame[]> => {
  const user = getIscoredUser();
  if (!user) {
    return [];
  }

  await ensureGamesCacheReady(user);
  return gamesCache.games.map((g) => ({ ...g }));
});

/**
 * Resets the in-memory caches. Exported for test isolation.
 */
export function clearIscoredCacheForTesting(): void {
  cache.scoresByGameId = new Map();
  cache.lastFetchedAt = null;
  cache.refreshPromise = null;
  cache.user = null;

  gamesCache.games = [];
  gamesCache.lastFetchedAt = null;
  gamesCache.refreshPromise = null;
  gamesCache.user = null;
}
