/**
 * PinballMap client configuration: mode selection and API constants.
 *
 * Mode resolution:
 * - `PINBALLMAP_MODE=mock|live` wins when set.
 * - Otherwise: `live` only on a Vercel PRODUCTION deployment; `mock` everywhere
 *   else — previews, local dev, CI, tests.
 *
 * The mock default keeps the dev server and the whole test suite off the
 * network and off PBM's servers (CORE-TEST-006), with no credentials needed.
 *
 * **Why `VERCEL_ENV` and not `NODE_ENV`** (PP-o355.24): Vercel sets
 * `NODE_ENV=production` for PREVIEW builds and preview runtime too, not just
 * production — so keying off it silently resolved every preview deployment to
 * the live client. `VERCEL_ENV` is the one that actually discriminates:
 * `production` | `preview` | `development`, and undefined off-Vercel, which
 * correctly yields `mock` for local and CI.
 *
 * Previews reaching PBM would be unsanctioned automated traffic against a
 * conduct policy that budgets one automated call per hour (CORE-PBM-001), and
 * would do it unauthenticated — `PINBALLMAP_API_TOKEN` is scoped
 * production-only, so those calls 401 under PBM's `REQUIRE_API_TOKEN` gate.
 * Set `PINBALLMAP_MODE=live` explicitly to exercise the live client anyway.
 */

export type PinballMapMode = "live" | "mock";

export function getPinballMapMode(): PinballMapMode {
  const explicit = process.env["PINBALLMAP_MODE"];
  if (explicit === "live" || explicit === "mock") return explicit;
  return process.env["VERCEL_ENV"] === "production" ? "live" : "mock";
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
 * PBM region slug for the Austin metro — the `:region` path segment of the bulk
 * region endpoints (lowercase region name, vendored llms.txt §Regions).
 *
 * Scope note (PP-o355.18): this is the whole metro, not just our location. The
 * new-machine alert is region-wide discovery — "a game appeared somewhere in
 * Austin" — which is a different question from the APC-location snapshot sync
 * (PP-o355.11) and reads a different endpoint.
 */
export const PBM_AUSTIN_REGION = "austin";

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
