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
 *
 * **Lowercase is load-bearing.** PBM's route matches the region name
 * case-insensitively, but the scopes behind it look it up with
 * `Region.find_by_name(name.downcase)` and fail open on a miss, in two different
 * and equally bad ways: the LMX scope returns nil, which leaves the query
 * UNSCOPED and hands back every xref on Earth; the locations scope silently
 * substitutes Portland. So a mis-cased or unknown region does not 404 — it
 * returns confident, wrong, enormous data. Normalize with `normalizeRegion`
 * before it reaches a URL.
 */
export const PBM_AUSTIN_REGION = "austin";

/** Canonical form of a region slug: trimmed and lowercased. */
export function normalizeRegion(region: string): string {
  return region.trim().toLowerCase();
}

/**
 * Manual-refresh token bucket (PP-hbi0, reshaped for spec 3.2 in PP-o355.21).
 *
 * The hourly cron is the sanctioned automated refresh (one location call/hour,
 * CORE-PBM-001); human-initiated refreshes draw from this bucket instead. It
 * replaced a flat 3-minute floor, which enforced the same sustained rate but
 * refused the thing people actually do — walking a few machines in a row and
 * wanting each one's lineup current.
 *
 * `BURST` back-to-back refreshes are allowed, then one per `REFILL_MS`. The
 * sustained rate is therefore 60/3 = **20 per hour exactly**, which is the
 * ceiling Tim approved with PBM on 2026-07-19 and the number CORE-PBM-001
 * records. Changing `REFILL_MS` changes that commitment; changing `BURST`
 * changes only how bunched the same traffic is.
 *
 * Global, not per-user: the cap is on PinPoint's traffic to someone else's
 * service, so ten people clicking once is the same load as one person clicking
 * ten times. Enforced at the `stampSyncAttempt` seam so every Pinball Map
 * fetch — manual, cron, enable, location-change validation — shares one
 * chokepoint (spec 6.5).
 */
export const PBM_REFRESH_BURST = 3;
export const PBM_REFRESH_REFILL_MS = 3 * 60 * 1000;
