import "server-only";

import { cache as reactCache } from "react";
import { NETWORK_ERROR_STATUS, safeFetch } from "~/lib/http/external";
import { log } from "~/lib/logger";
import { reportError } from "~/lib/observability/report-error";
import {
  ISCORED_BASE_URL,
  ISCORED_CACHE_TTL_MS,
  ISCORED_GAMES_CACHE_TTL_MS,
  getGameroomUrl,
  getGameUrl,
  getIscoredUser,
  getScoreEntryUrl,
  isIscoredFixtureMode,
} from "./config";
import { ISCORED_FIXTURE_GAMES, ISCORED_FIXTURE_SCORES } from "./fixture";
import type { IscoredGame, IscoredScore } from "./types";

export { getGameroomUrl, getGameUrl, getScoreEntryUrl };
export type { IscoredGame, IscoredScore };

/** Per-attempt budget for an iScored request, headers and body together. */
const ISCORED_FETCH_TIMEOUT_MS = 8000;

interface SwrCacheOptions<T> {
  /** Age after which a read serves the cached value and refreshes behind it. */
  ttlMs: number;
  /**
   * Age at which a failed load is tried again. A failure that should wait the
   * normal TTL passes `ttlMs`.
   */
  failureRetryMs: number;
  /** The value served before any load has succeeded; called again on reset. */
  empty: () => T;
  /** Loads the value for `key`, or returns null on failure (it does its own logging). */
  load: (key: string) => Promise<T | null>;
}

interface SwrCache<T> {
  /** Returns the cached value: awaits a cold load, refreshes a stale one behind the read. */
  get: (key: string) => Promise<T>;
  /** Awaits a refresh unless the cached value is younger than `ttlMs`. */
  refresh: (key: string) => Promise<void>;
  clear: () => void;
}

/**
 * A single-entry, in-memory stale-while-revalidate cache keyed by gameroom
 * user. A failed load keeps the previous value and is marked so the next
 * attempt comes after `failureRetryMs`; concurrent loads share one request.
 */
function createSwrCache<T>(options: SwrCacheOptions<T>): SwrCache<T> {
  const { ttlMs, failureRetryMs, empty, load } = options;
  let value = empty();
  let lastFetchedAt: number | null = null;
  let refreshPromise: Promise<void> | null = null;
  let activeKey: string | null = null;

  async function loadAndStore(key: string): Promise<void> {
    let loaded: T | null = null;
    try {
      loaded = await load(key);
    } catch (err) {
      reportError(err, {
        action: "iscored.cacheLoad",
        bestEffort: true,
        user: key,
      });
    }
    if (loaded === null) {
      lastFetchedAt = Date.now() - ttlMs + failureRetryMs;
      return;
    }
    value = loaded;
    lastFetchedAt = Date.now();
  }

  function trigger(key: string): Promise<void> {
    if (refreshPromise) {
      return refreshPromise;
    }
    refreshPromise = loadAndStore(key).finally(() => {
      refreshPromise = null;
    });
    return refreshPromise;
  }

  function reset(): void {
    value = empty();
    lastFetchedAt = null;
    refreshPromise = null;
    activeKey = null;
  }

  function syncKey(key: string): void {
    if (activeKey !== key) {
      reset();
      activeKey = key;
    }
  }

  return {
    async get(key) {
      syncKey(key);
      if (lastFetchedAt === null) {
        await trigger(key);
      } else if (Date.now() - lastFetchedAt > ttlMs) {
        void trigger(key);
      }
      return value;
    },
    async refresh(key) {
      syncKey(key);
      if (lastFetchedAt !== null && Date.now() - lastFetchedAt < ttlMs) {
        return;
      }
      await trigger(key);
    },
    clear: reset,
  };
}

interface IscoredJsonLogMessages {
  /** `reportError` action for an unreadable response body. */
  action: string;
  nonOk: string;
  notJson: string;
  networkFailure: string;
}

/**
 * GETs an iScored API URL and parses the body as JSON. Every failure (network,
 * timeout, non-OK status, unreadable or non-JSON body) is logged with the
 * caller's wording and returned as `{ ok: false }`; it never throws.
 */
async function fetchIscoredJson(
  url: string,
  user: string,
  messages: IscoredJsonLogMessages
): Promise<{ ok: true; data: unknown } | { ok: false }> {
  const res = await safeFetch(
    url,
    { cache: "no-store", headers: { Accept: "application/json" } },
    {
      timeoutMs: ISCORED_FETCH_TIMEOUT_MS,
      networkErrorLog: {
        fields: { user },
        message: messages.networkFailure,
      },
    }
  );

  // safeFetch already logged the network failure or timeout.
  if (res.status === NETWORK_ERROR_STATUS) {
    return { ok: false };
  }

  if (!res.ok) {
    log.warn({ status: res.status, user }, messages.nonOk);
    return { ok: false };
  }

  let text: string;
  try {
    text = await res.text();
  } catch (err) {
    reportError(err, { action: messages.action, bestEffort: true, user });
    return { ok: false };
  }

  try {
    return { ok: true, data: JSON.parse(text) as unknown };
  } catch {
    // Upstream returns 200 text/html when API read access is disabled or user not found
    log.warn({ user }, messages.notJson);
    return { ok: false };
  }
}

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
 * Fetches all scores from iScored in a single gameroom batch.
 * Returns null on any failure so callers keep the previous scores.
 */
async function loadScores(
  user: string
): Promise<Map<string, IscoredScore[]> | null> {
  if (isIscoredFixtureMode()) {
    return groupAndRankScores(
      parseAndSanitizeScores([...ISCORED_FIXTURE_SCORES])
    );
  }

  const result = await fetchIscoredJson(
    `${ISCORED_BASE_URL}/api/${encodeURIComponent(user)}/getAllScores?max=10`,
    user,
    {
      action: "iscored.fetchScores",
      nonOk: "iScored API returned non-OK status",
      notJson: "iScored API response was not valid JSON",
      networkFailure: "Failed to fetch iScored scores",
    }
  );
  if (!result.ok) {
    return null;
  }

  const rawData = result.data;
  const items = Array.isArray(rawData)
    ? rawData
    : isRecord(rawData) && Array.isArray(rawData["scores"])
      ? rawData["scores"]
      : null;

  if (!items) {
    log.warn(
      { user },
      "iScored API response was not an array or scores envelope"
    );
    return null;
  }

  return groupAndRankScores(parseAndSanitizeScores(items));
}

/**
 * Scores cache: warm reads return immediately and, once older than 15s,
 * trigger a background refresh; a cold read awaits the first fetch. A failed
 * fetch waits the full TTL before the next attempt.
 */
const scoresCache = createSwrCache<Map<string, IscoredScore[]>>({
  ttlMs: ISCORED_CACHE_TTL_MS,
  failureRetryMs: ISCORED_CACHE_TTL_MS,
  empty: () => new Map(),
  load: loadScores,
});

/**
 * Retrieves all scores for a specific machine's iScored game ID.
 *
 * Returns empty array if no gameroom is configured, game ID is unlinked/blank,
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

    const scoresByGameId = await scoresCache.get(user);
    return scoresByGameId.get(trimmedId)?.map((score) => ({ ...score })) ?? [];
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
  await scoresCache.refresh(user);
}

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

/**
 * Fetches the gameroom's games list. Returns null on any failure so callers
 * keep the previous list.
 */
async function loadGames(user: string): Promise<IscoredGame[] | null> {
  if (isIscoredFixtureMode()) {
    return parseAndSanitizeGames([...ISCORED_FIXTURE_GAMES]) ?? [];
  }

  const result = await fetchIscoredJson(
    `${ISCORED_BASE_URL}/api/${encodeURIComponent(user)}`,
    user,
    {
      action: "iscored.fetchGameroomGames",
      nonOk: "iScored API returned non-OK status for gameroom games",
      notJson: "iScored gameroom games API response was not valid JSON",
      networkFailure: "Failed to fetch iScored gameroom games",
    }
  );
  if (!result.ok) {
    return null;
  }

  if (!Array.isArray(result.data)) {
    log.warn({ user }, "iScored gameroom games API response was not an array");
    return null;
  }

  const parsedGames = parseAndSanitizeGames(result.data);
  if (parsedGames === null) {
    log.warn(
      { user },
      "iScored gameroom games response contained malformed records; preserving cache"
    );
  }
  return parsedGames;
}

/**
 * Games cache: unlike scores, a failed fetch retries after 15s rather than
 * caching the failure for the full 1-hour TTL.
 */
const gamesCache = createSwrCache<IscoredGame[]>({
  ttlMs: ISCORED_GAMES_CACHE_TTL_MS,
  failureRetryMs: FAILURE_RETRY_INTERVAL_MS,
  empty: () => [],
  load: loadGames,
});

/**
 * Retrieves the full list of games configured in the iScored gameroom.
 *
 * Server-side cached for 1 hour. Returns an empty array if no gameroom is
 * configured or upstream is unreachable.
 */
export const getGameroomGames = reactCache(async (): Promise<IscoredGame[]> => {
  const user = getIscoredUser();
  if (!user) {
    return [];
  }

  const games = await gamesCache.get(user);
  return games.map((g) => ({ ...g }));
});

/**
 * Resets the in-memory caches. Exported for test isolation.
 */
export function clearIscoredCacheForTesting(): void {
  scoresCache.clear();
  gamesCache.clear();
}
