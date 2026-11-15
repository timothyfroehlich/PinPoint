import type { NextResponse } from "next/server";
import { runCron } from "~/lib/cron/run-cron";
import { log } from "~/lib/logger";
import { runRegionMachineAlerts } from "~/lib/pinballmap/region-alerts";

/**
 * Hourly Pinball Map machine additions/removals Discord alert (PP-o355.51.9).
 *
 * One bulk region read, diffed against the stored seen-set, announced to the
 * configured Discord channel. CRON_SECRET-gated like the other cron routes.
 *
 * **Hourly, at :23.** A machine appearing at a venue is news people want the same
 * day, and an hourly poll is what makes the alert feel like news rather than a
 * digest. The cost stays trivial under CORE-PBM-001: one region request on a
 * quiet hour, two when there is something to announce (the second names the
 * venues), so ~24-48 requests a day against an endpoint that permits 120 per
 * MINUTE. The off-zero minute keeps us out of the thundering herd that hits every
 * platform on the hour, and off the minutes the blob cleanup and catalog refresh
 * already use.
 *
 * Most runs announce nothing — the region gains 1-3 machines on a typical DAY —
 * so the steady state is a cheap no-op that exists to make the rare real one
 * prompt.
 *
 * The configured alert channel and shared Discord bot token are checked inside
 * `runRegionMachineAlerts` before any Pinball Map call. Region alerts are
 * independent from a tracked Pinball Map location.
 */

export const dynamic = "force-dynamic";
/**
 * 300s, matching the weekly catalog-refresh route rather than the 120s a region
 * read alone needs.
 *
 * The region payload itself is small (487 entries, ~77KB) and finishes in
 * well under a second. The budget is sized for the rare branch: an unknown machine
 * id makes this run trigger a full `refreshCatalog()`, the same ~10k-title fetch
 * the weekly job allots 300s for. Leaving this at 120 would mean the one run that
 * most needs to finish — the one naming a brand-new release — is the run at risk of
 * being cut off partway through the catalog upsert.
 */
export const maxDuration = 300;

export async function GET(request: Request): Promise<NextResponse> {
  return runCron(request, "pinballmap.regionAlerts", async () => {
    const run = await runRegionMachineAlerts();
    log.info(
      { ...run, action: "pinballmap.regionAlerts" },
      "Pinball Map region machine-alert run"
    );
    return { ok: true, ...run };
  });
}
