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
