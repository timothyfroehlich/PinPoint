import { APC_LOCATION_ID } from "./config";

/**
 * Public PinballMap deep link for a location's page on pinballmap.com.
 *
 * This is the CORE-PBM-001 "link back to pinballmap.com" attribution shown
 * wherever we render PBM-sourced listing data (e.g. the machine Info-tab status
 * card). It targets the location's public map view — which lists the location's
 * machines — rather than a per-machine URL: PBM's per-location lmx id is
 * ephemeral (removing + re-adding a machine mints a new one), so a location deep
 * link is the stable, always-resolvable target. Public and visible to anonymous
 * visitors — no auth required.
 */
export function pinballmapLocationUrl(
  locationId: number = APC_LOCATION_ID
): string {
  return `https://pinballmap.com/map/?by_location_id=${locationId}`;
}
