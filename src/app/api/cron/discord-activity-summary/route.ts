import type { NextResponse } from "next/server";
import { runCron } from "~/lib/cron/run-cron";
import { runScheduledActivitySummary } from "~/lib/discord/activity-summary/runner";
import { log } from "~/lib/logger";

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
  return runCron(request, "discord.activitySummary", async () => {
    const run = await runScheduledActivitySummary();
    log.info(
      { ...run, action: "discord.activitySummary" },
      "Discord activity summary run"
    );
    return { ok: true, ...run };
  });
}
