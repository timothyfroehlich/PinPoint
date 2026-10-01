import { NextResponse } from "next/server";
import { assertCronAuthorized } from "~/lib/cron/auth";
import { log } from "~/lib/logger";
import { reportError } from "~/lib/observability/report-error";
import { runSyncReport } from "~/lib/pinballmap/sync-report";

/**
 * Weekly Pinball Map sync report to Discord (PP-5qwx, pinballmap-sync-report
 * spec). CRON_SECRET-gated like the other cron routes.
 *
 * **Scheduled twice, posts once.** `vercel.json` runs this at 23:00 UTC Monday
 * and 00:00 UTC Tuesday — 6 PM Central under daylight time and standard time
 * respectively. `runSyncReport` posts only on the run whose Central-time clock
 * reads Monday 18:xx, and claims the week first, so the other slot and any
 * duplicate delivery are no-ops (spec §3.1, §3.3).
 *
 * Reads stored data only; never calls Pinball Map (CORE-PBM-001).
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request): Promise<NextResponse> {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  try {
    const run = await runSyncReport();
    log.info(
      { ...run, action: "pinballmap.syncReport" },
      "Pinball Map sync report run"
    );
    return NextResponse.json({ ok: true, ...run });
  } catch (err) {
    // `reportError`, not a bare `log.error`: this route catches to return a
    // 502, and Sentry's auto-capture only sees uncaught exceptions (PP-a5y).
    reportError(err, { action: "pinballmap.syncReport" });
    return NextResponse.json({ error: "Sync report failed" }, { status: 502 });
  }
}
