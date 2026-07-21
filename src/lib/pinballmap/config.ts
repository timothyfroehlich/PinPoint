/**
 * PinballMap client configuration: mode selection and API constants.
 *
 * Mode resolution:
 * - `PINBALLMAP_MODE=mock|live` wins when set.
 * - Otherwise: `live` in production, `mock` everywhere else (dev/test).
 *
 * The mock default keeps the dev server and the whole test suite off the
 * network and off PBM's servers (CORE-TEST-006), with no credentials needed.
 */

export type PinballMapMode = "live" | "mock";

export function getPinballMapMode(): PinballMapMode {
  const explicit = process.env["PINBALLMAP_MODE"];
  if (explicit === "live" || explicit === "mock") return explicit;
  return process.env.NODE_ENV === "production" ? "live" : "mock";
}

/** All PBM endpoints live under this base (vendored llms.txt §"Base URL"). */
export const PBM_API_BASE = "https://pinballmap.com/api/v1";

/**
 * Descriptive User-Agent with a contact URL. Not required by PBM, but good
 * API citizenship: it identifies our traffic and gives them a way to reach us.
 */
export const PBM_USER_AGENT =
  "PinPoint/1.0 (Austin Pinball Collective issue tracker; +https://github.com/timothyfroehlich/PinPoint)";

/** Austin Pinball Collective's PBM location id. */
export const APC_LOCATION_ID = 26454;

/**
 * Minimum interval between MANUAL ("Sync now") snapshot refreshes (PP-hbi0).
 *
 * The hourly cron is the sanctioned automated refresh (one location call/hour,
 * CORE-PBM-001); human-initiated refreshes are throttled to at most one per this
 * interval — 3 minutes → a ceiling of 20 manual syncs/hour (approved by Tim,
 * 2026-07-19). Enforced at the `syncLocationSnapshot` seam so every live-fetch
 * caller (Sync now, verify/reconnect, any future caller) inherits one chokepoint;
 * the cron path bypasses it by passing `trigger: "cron"`.
 */
export const PBM_MANUAL_SYNC_MIN_INTERVAL_MS = 3 * 60 * 1000;
