import { NextResponse } from "next/server";
import { assertCronAuthorized } from "~/lib/cron/auth";
import { runScheduledActivitySummary } from "~/lib/discord/activity-summary/runner";
import { log } from "~/lib/logger";
import { reportError } from "~/lib/observability/report-error";

/**
 * Discord activity summary (PP-ogup, discord-activity-summary spec §3).
 * CRON_SECRET-gated like the other cron routes.
 *
 * **Hourly, on the hour.** Post times are a Central wall-clock schedule the
 * admin sets — any hour, every 1 to 24 hours — and Vercel cron is UTC-only, so
 * the route runs every hour and `runScheduledActivitySummary` posts only when
 * this Central hour is a post time. It claims the period before posting, so a
 * duplicate delivery or the repeated fall-back hour posts once (§3.4, §3.5).
 *
 * Reads stored data only; never calls Pinball Map (§5.12, CORE-PBM-001).
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request): Promise<NextResponse> {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  try {
    const run = await runScheduledActivitySummary();
    log.info(
      { ...run, action: "discord.activitySummary" },
      "Discord activity summary run"
    );
    return NextResponse.json({ ok: true, ...run });
  } catch (err) {
    // `reportError`, not a bare `log.error`: this route catches to return a
    // 502, and Sentry's auto-capture only sees uncaught exceptions (PP-a5y).
    reportError(err, { action: "discord.activitySummary" });
    return NextResponse.json(
      { error: "Activity summary failed" },
      { status: 502 }
    );
  }
}
