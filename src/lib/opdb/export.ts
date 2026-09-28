import { parseOpdbExport } from "./parse";
import type { OpdbMachine } from "./types";

/**
 * OPDB's full daily export, published by Match Play (docs.matchplay.events,
 * "Data exports"). Free and tokenless; Match Play asks consumers to use it
 * rather than fetching entries one by one. About 5.6 MB, rebuilt once a day.
 */
export const OPDB_EXPORT_URL =
  "https://mp-data.sfo3.cdn.digitaloceanspaces.com/opdb-v2.json";

const OPDB_USER_AGENT =
  "PinPoint/1.0 (Austin Pinball Collective issue tracker; +https://github.com/timothyfroehlich/PinPoint)";

/** A bulk file download, not an API call; allow it time on a slow CDN edge. */
const FETCH_TIMEOUT_MS = 60_000;

/**
 * The export held about 2,400 machine and alias entries in September 2026. A
 * parse far below that is a truncated or wrong document, and writing it would
 * leave most machines looking as if OPDB had no data for them.
 */
export const MIN_EXPORT_MACHINES = 1_000;

/**
 * Download and parse the export. Throws on any HTTP failure, a payload that is
 * not the export, or one implausibly small, so the caller keeps its last copy.
 */
export async function fetchOpdbExport(): Promise<OpdbMachine[]> {
  const response = await fetch(OPDB_EXPORT_URL, {
    headers: { Accept: "application/json", "User-Agent": OPDB_USER_AGENT },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `OPDB export request failed: HTTP ${String(response.status)}`
    );
  }
  const machines = parseOpdbExport(await response.json());
  if (machines.length < MIN_EXPORT_MACHINES) {
    throw new Error(
      `OPDB export held only ${String(machines.length)} machines; keeping the stored copy`
    );
  }
  return machines;
}
