/**
 * PinballMap client configuration: mode selection, the production-only network
 * policy, and API constants.
 *
 * **Only a Vercel production deployment may reach pinballmap.com.** Local dev,
 * CI, E2E, tests, and preview deployments never do: reads come from the mock
 * client's captured fixtures, and writes land in the mock's in-memory state
 * (CORE-PBM-001, CORE-TEST-006). Two layers enforce it, both keyed off
 * `isPinballMapProduction()`:
 *
 * 1. `getPinballMapMode()` resolves `mock` everywhere outside production, so the
 *    app never builds a live client there.
 * 2. The live client's single `fetch` call site refuses to run outside
 *    production (`assertPinballMapNetworkAllowed`), so a live client that exists
 *    anyway — constructed directly, or through a future mode bug — still cannot
 *    send a request.
 *
 * Both fail closed: an unset, empty, or unrecognised `VERCEL_ENV` is
 * non-production.
 *
 * **Why `VERCEL_ENV` and not `NODE_ENV`** (PP-o355.24): Vercel sets
 * `NODE_ENV=production` for PREVIEW builds and preview runtime too, not just
 * production. `VERCEL_ENV` is the one that discriminates: `production` |
 * `preview` | `development`, and undefined off-Vercel.
 *
 * **Why there is no opt-in.** Non-production databases carry seeded fake
 * operator credentials (`supabase/seed-pinballmap-state.ts`) so the push
 * surfaces render. A request sent from there would be unsanctioned automated
 * traffic against a conduct policy that budgets one automated call per hour,
 * and a write would be a public edit to the real lineup. An earlier
 * `PINBALLMAP_MODE=live` override allowed exactly that from any environment; it
 * was removed rather than guarded.
 *
 * `PINBALLMAP_MODE=mock` is still honoured in production as a kill switch. Any
 * other value, `live` included, changes nothing: production defaults to `live`,
 * and everywhere else is `mock`.
 */

export type PinballMapMode = "live" | "mock";

/** The one place that decides whether this process may reach PinballMap. */
export function isPinballMapProduction(): boolean {
  return process.env["VERCEL_ENV"] === "production";
}

export function getPinballMapMode(): PinballMapMode {
  if (!isPinballMapProduction()) return "mock";
  return process.env["PINBALLMAP_MODE"] === "mock" ? "mock" : "live";
}

/**
 * Thrown when anything tries to send a request to PinballMap outside
 * production. Reaching it is a PinPoint bug (mode resolution should have handed
 * the caller the mock), so it throws rather than degrading into a failed-request
 * result that would hide the bug.
 */
export class PinballMapNetworkBlockedError extends Error {
  constructor(method: string, label: string) {
    super(
      `Refused ${method} ${label}: PinballMap is reachable only from a Vercel ` +
        `production deployment (VERCEL_ENV=production). Use the mock client.`
    );
    this.name = "PinballMapNetworkBlockedError";
  }
}

/**
 * Throws unless this process is production. The live client calls it
 * immediately before its only `fetch`, for every method, reads included.
 */
export function assertPinballMapNetworkAllowed(
  method: string,
  label: string
): void {
  if (!isPinballMapProduction()) {
    throw new PinballMapNetworkBlockedError(method, label);
  }
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
 * Scope note (PP-o355.18, PP-o355.51.9): this is the whole metro, not just our
 * location. The machine-change alert is region-wide discovery — "a game appeared
 * or disappeared somewhere in Austin" — which is a different question from the
 * APC-location snapshot sync (PP-o355.11) and reads a different endpoint.
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
 * ten times. Enforced at the `syncLocationSnapshot` seam so every live-fetch
 * caller inherits one chokepoint; the cron path bypasses it with
 * `trigger: "cron"`.
 */
export const PBM_REFRESH_BURST = 3;
export const PBM_REFRESH_REFILL_MS = 3 * 60 * 1000;
/** Checked location snapshots remain committable for ten minutes. */
export const PBM_LOCATION_CHECK_TTL_MS = 10 * 60 * 1000;
