import { NextResponse } from "next/server";
import { assertCronAuthorized } from "~/lib/cron/auth";
import { log } from "~/lib/logger";
import { reportError } from "~/lib/observability/report-error";
import { getPinballMapState } from "~/lib/pinballmap/state";
import { runRegionNewMachineAlerts } from "~/lib/pinballmap/region-alerts";

/**
 * Hourly "new machines in the Austin region" Discord alert (PP-o355.18).
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
 * Two gates, both cheap and both before any PBM call:
 * - `state.enabled` — the integration-level kill switch, same as the snapshot sync
 *   route. While the integration is off this route makes ZERO PBM calls, so it is
 *   safe to register before rollout (PP-o355.10).
 * - a configured alert channel — enforced inside `runRegionNewMachineAlerts`.
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
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  const state = await getPinballMapState();
  if (!state?.enabled) {
    // Dormant: the integration isn't enabled yet. Correct no-op, not an error.
    return NextResponse.json({ ok: true, skipped: "disabled" });
  }

  try {
    const run = await runRegionNewMachineAlerts();
    log.info(
      { ...run, action: "pinballmap.regionAlerts" },
      "PinballMap region new-machine alert run"
    );
    return NextResponse.json({ ok: true, ...run });
  } catch (err) {
    // `reportError`, not a bare `log.error` (PP-a5y): we CATCH here to return a
    // 502, and Sentry's auto-capture only ever sees uncaught exceptions — so a
    // bare log would make every failure of this job invisible to monitoring, with
    // a Vercel log line that ages out as the only evidence it ever ran badly.
    reportError(err, { action: "pinballmap.regionAlerts" });
    return NextResponse.json({ error: "Region alert failed" }, { status: 502 });
  }
}
