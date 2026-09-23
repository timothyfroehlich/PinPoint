/**
 * Configuration and URL helpers for the iScored integration.
 */

import { LOCAL_AFM_DEMO_GAME_ID } from "./local-demo";

/** Upstream iScored service base URL. */
export const ISCORED_BASE_URL = "https://www.iscored.info";

/**
 * Minimum interval between batch score refreshes.
 * Spec §3.3: "Batch score fetching is throttled to a minimum interval of 15 seconds."
 */
export const ISCORED_CACHE_TTL_MS = 15_000;

/**
 * Cache TTL for the full gameroom games list.
 * Games in a gameroom change rarely, so a 1-hour TTL avoids frequent upstream hits.
 */
export const ISCORED_GAMES_CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Returns the configured iScored gameroom username from environment variables,
 * or null if unconfigured.
 */
export function getIscoredUser(): string | null {
  const user = process.env["ISCORED_USER"]?.trim();
  return user && user.length > 0 ? user : null;
}

/**
 * Whether the iScored integration has a configured gameroom user.
 */
export function isIscoredConfigured(): boolean {
  return getIscoredUser() !== null;
}

/**
 * Builds the direct external URL taking a player to iScored's mobile score submission
 * screen for a specific game (Spec §1, §4.2, §5.3).
 *
 * Pattern: `https://www.iscored.info/?mode=public&user={user}&game={gameID}`
 *
 * Returns null if no user is configured (or passed) or if the game ID is blank.
 */
export function getScoreEntryUrl(
  iscoredGameId: string,
  user?: string | null
): string | null {
  const resolvedUser = (user ?? getIscoredUser())?.trim();
  const trimmedId = iscoredGameId.trim();

  if (!resolvedUser || !trimmedId || trimmedId === LOCAL_AFM_DEMO_GAME_ID) {
    return null;
  }

  return `${ISCORED_BASE_URL}/?mode=public&user=${encodeURIComponent(resolvedUser)}&game=${encodeURIComponent(trimmedId)}`;
}

/**
 * Builds the direct external URL to view a specific game in the location's
 * public iScored gameroom (Spec §1, §4.2, §4.3).
 *
 * Pattern: `https://www.iscored.info/{user}?scrollTo={gameID}`
 *
 * Returns null if no user is configured (or passed) or if the game ID is blank.
 */
export function getGameUrl(
  iscoredGameId: string,
  user?: string | null
): string | null {
  const resolvedUser = (user ?? getIscoredUser())?.trim();
  const trimmedId = iscoredGameId.trim();

  if (!resolvedUser || !trimmedId || trimmedId === LOCAL_AFM_DEMO_GAME_ID) {
    return null;
  }

  return `${ISCORED_BASE_URL}/${encodeURIComponent(resolvedUser)}?scrollTo=${encodeURIComponent(trimmedId)}`;
}

/**
 * Builds the location's public iScored gameroom URL (Spec §5.4).
 *
 * Pattern: `https://www.iscored.info/{user}`
 *
 * Returns null if no user is configured (or passed).
 */
export function getGameroomUrl(user?: string | null): string | null {
  const resolvedUser = (user ?? getIscoredUser())?.trim();

  if (!resolvedUser) {
    return null;
  }

  return `${ISCORED_BASE_URL}/${encodeURIComponent(resolvedUser)}`;
}
