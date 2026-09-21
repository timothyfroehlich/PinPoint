/**
 * Types for iScored API integration.
 */

/**
 * Raw score payload returned from iScored's `/api/{user}/getAllScores` endpoint.
 *
 * NOTE: Upstream includes an `email` field when players enter it during score
 * submission. Under CORE-SEC-007, this field is strictly stripped at the client
 * boundary and never propagated to application models or UI components.
 */
export interface RawIscoredScore {
  id: number;
  game?: number | string | null;
  name?: string | null;
  score: number | string;
  gameName?: string | null;
  date?: string | null;
  event?: string | null;
  wins?: number | null;
  losses?: number | null;
  email?: string | null;
  rank?: string | number | null;
}

/**
 * Sanitized, typed score record exposed to PinPoint callers.
 *
 * Guaranteed free of PII (email addresses). Normalized `gameId` as string
 * to match `machines.iscored_game_id`.
 */
export interface IscoredScore {
  id: number;
  gameId: string;
  gameName: string;
  playerName: string;
  score: number;
  date: string;
  rank: number;
}
