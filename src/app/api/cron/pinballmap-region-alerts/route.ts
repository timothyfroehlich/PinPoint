import { NextResponse } from "next/server";
import { assertCronAuthorized } from "~/lib/cron/auth";
import { log } from "~/lib/logger";
import { getPinballMapState } from "~/lib/pinballmap/state";
import { runRegionNewMachineAlerts } from "~/lib/pinballmap/region-alerts";

/**
 * Daily "new machines in the Austin region" Discord alert (PP-o355.18).
 *
 * One bulk region read, diffed against the stored seen-set, announced to the
 * configured Discord channel. CRON_SECRET-gated like the other cron routes.
 *
 * **Daily, not hourly.** A machine appearing at a venue is news on a
 * day-timescale, so an hourly poll would spend 24× the requests to deliver the
 * same information later broken into fragments — and PBM's llms.txt is explicit
 * that request volume should track how often the data changes (CORE-PBM-001). The
 * hourly slot in our budget belongs to the location snapshot sync, which backs
 * interactive UI; this job backs a notification.
 *
 * Two gates, both cheap and both before any PBM call:
 * - `state.enabled` — the integration-level kill switch, same as the snapshot sync
 *   route. While the integration is off this route makes ZERO PBM calls, so it is
 *   safe to register before rollout (PP-o355.10).
 * - a configured alert channel — enforced inside `runRegionNewMachineAlerts`.
 */

export const dynamic = "force-dynamic";
// A whole region's LMX list is a large payload and the insert is chunked.
export const maxDuration = 120;

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
    log.error(
      { err, action: "pinballmap.regionAlerts" },
      "PinballMap region new-machine alert failed"
    );
    return NextResponse.json({ error: "Region alert failed" }, { status: 502 });
  }
}
