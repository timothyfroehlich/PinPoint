import { APC_LOCATION_ID } from "./config";

/**
 * Public PinballMap deep link for a location's page on pinballmap.com.
 *
 * This is the CORE-PBM-001 attribution link-back shown wherever we render
 * PBM-sourced listing data (e.g. the machine Info-tab status card). It targets
 * the location's public map view — which lists the location's machines — rather
 * than a per-machine URL: PBM's per-location lmx id is ephemeral (removing +
 * re-adding a machine mints a new one), so a location deep link is the stable,
 * always-resolvable target. Public and visible to anonymous visitors — no auth
 * required.
 *
 * The `by_location_id` query form is not a stylistic choice — since 2026-08-06
 * PBM's `llms.txt` (vendored at `docs/external/pinballmap-llms.txt`, section
 * "Attribution") requires it: their data is CC BY-SA 4.0, and a surface showing
 * data for a specific location must attribute to that location's listing, not
 * to the pinballmap.com homepage. So this function is the ONLY place a
 * pinballmap.com link may be built; hand-writing one elsewhere is how the
 * requirement gets silently dropped.
 *
 * The trailing slash in `/map/` is incidental — PBM serves 200 for both `/map`
 * and `/map/` with no redirect (verified 2026-08-09).
 */
export function pinballmapLocationUrl(
  locationId: number = APC_LOCATION_ID
): string {
  return `https://pinballmap.com/map/?by_location_id=${locationId}`;
}
