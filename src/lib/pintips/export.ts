import { parsePinTipsExport } from "./parse";
import type { PinTip } from "./types";

/**
 * The PinTips daily export, published by Match Play alongside the OPDB export
 * (docs.matchplay.events, "Data exports"). Match Play asks consumers to use
 * this file rather than their API (spec 2.1). About 0.9 MB.
 */
export const PINTIPS_EXPORT_URL =
  "https://mp-data.sfo3.cdn.digitaloceanspaces.com/latest-pintips.json";

const USER_AGENT =
  "PinPoint/1.0 (Austin Pinball Collective issue tracker; +https://github.com/timothyfroehlich/PinPoint)";

/** A bulk file download, not an API call; allow it time on a slow CDN edge. */
const FETCH_TIMEOUT_MS = 60_000;

/**
 * The export held about 3,470 usable tips in September 2026. A parse far below
 * that is a truncated or wrong document, and writing it would erase most
 * games' tips (spec 2.4).
 */
export const MIN_EXPORT_TIPS = 1_000;

/**
 * Download and parse the export. Throws on any HTTP failure, a payload that is
 * not the export, or one implausibly small, so the caller keeps its last copy.
 */
export async function fetchPinTipsExport(): Promise<PinTip[]> {
  const response = await fetch(PINTIPS_EXPORT_URL, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `PinTips export request failed: HTTP ${String(response.status)}`
    );
  }
  const tips = parsePinTipsExport(await response.json());
  if (tips.length < MIN_EXPORT_TIPS) {
    throw new Error(
      `PinTips export held only ${String(tips.length)} usable tips; keeping the stored copy`
    );
  }
  return tips;
}
