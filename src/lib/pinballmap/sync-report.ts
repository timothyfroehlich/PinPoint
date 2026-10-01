import "server-only";

import { and, eq, isNull, ne, or } from "drizzle-orm";

import { getDiscordBotToken } from "~/lib/discord/config";
import {
  DISCORD_MESSAGE_FLAGS,
  postChannelMessage,
} from "~/lib/discord/client";
import type { DiscordChannelStatus } from "~/lib/discord/channel-check";
import { requireSiteUrl } from "~/lib/url";
import { db } from "~/server/db";
import { pinballmapState } from "~/server/db/schema";

import { loadLineupData } from "./lineup-data";
import { getPinballMapState } from "./state";
import { formatSyncReportMessage } from "./sync-report-message";
import { formatLineupDate, syncReportWeekAt } from "./sync-report-schedule";

/**
 * The weekly Pinball Map sync report (pinballmap-sync-report spec).
 *
 * Posts the lineup page's review state to the configured report channel on
 * Monday at 6 PM US Central. Vercel cron is UTC-only, so the route is
 * scheduled twice — 23:00 UTC Monday (6 PM CDT) and 00:00 UTC Tuesday
 * (6 PM CST) — and each run posts only when the Central-time clock reads
 * Monday 18:xx (§3.1). The week is claimed in the database before the post,
 * so the slot that is not 6 PM, a duplicate cron delivery, or a concurrent
 * invocation all find it taken (§3.3).
 *
 * Reads stored data only — the same loader as the lineup page and the `/m`
 * badge — and never calls Pinball Map (§4.1, CORE-PBM-001).
 */

export type SyncReportRun =
  | {
      outcome: "skipped";
      reason:
        | "no_channel"
        | "off_schedule"
        | "not_configured"
        | "needs_discord"
        | "already_sent";
    }
  | { outcome: "posted"; week: string }
  | {
      outcome: "failed";
      week: string;
      status: Extract<DiscordChannelStatus, "cant_post" | "couldnt_check">;
    };

export async function runSyncReport(
  opts: { now?: Date } = {}
): Promise<SyncReportRun> {
  const now = opts.now ?? new Date();
  const state = await getPinballMapState();
  const channelId = state?.syncReportChannelId?.trim() ?? "";
  if (channelId.length === 0) {
    return { outcome: "skipped", reason: "no_channel" };
  }

  const week = syncReportWeekAt(now);
  if (week === null) return { outcome: "skipped", reason: "off_schedule" };

  // Not configured posts nothing (§4.7); Waiting still posts its one line.
  if (state?.locationId == null) {
    return { outcome: "skipped", reason: "not_configured" };
  }
  const locationId = state.locationId;

  const botToken = await getDiscordBotToken();
  if (!botToken) {
    await recordStatus(
      channelId,
      "needs_discord",
      "Discord bot token not configured"
    );
    return { outcome: "skipped", reason: "needs_discord" };
  }

  // Build the message before claiming the week, so a failed read surfaces as
  // a cron error without spending the week's one post.
  const data = await loadLineupData();
  const lastRefreshFailed =
    data.state?.lastSyncStatus === "error" && data.state.lastSyncedAt !== null;
  const content = formatSyncReportMessage({
    comparison: data.comparison,
    locationId,
    siteUrl: requireSiteUrl("pinballmap.syncReport"),
    staleLineupDate:
      lastRefreshFailed && data.state?.lastSyncedAt
        ? formatLineupDate(data.state.lastSyncedAt)
        : null,
  });
  if (content === null) return { outcome: "skipped", reason: "not_configured" };

  const claimed = await db
    .update(pinballmapState)
    .set({ syncReportLastWeek: week })
    .where(
      and(
        eq(pinballmapState.id, "singleton"),
        eq(pinballmapState.syncReportChannelId, channelId),
        or(
          isNull(pinballmapState.syncReportLastWeek),
          ne(pinballmapState.syncReportLastWeek, week)
        )
      )
    )
    .returning({ id: pinballmapState.id });
  if (claimed.length === 0) {
    return { outcome: "skipped", reason: "already_sent" };
  }

  const sent = await postChannelMessage({
    botToken,
    channelId,
    content,
    flags: DISCORD_MESSAGE_FLAGS.SUPPRESS_EMBEDS,
  });

  if (sent.ok) {
    await recordStatus(channelId, "posting", null, new Date());
    return { outcome: "posted", week };
  }

  // A failed post is not retried; next week's report posts as usual (§3.4).
  const status = sent.reason === "blocked" ? "cant_post" : "couldnt_check";
  await recordStatus(
    channelId,
    status,
    sent.reason === "blocked"
      ? "Channel unreachable or bot missing permissions"
      : "Discord was unreachable"
  );
  return { outcome: "failed", week, status };
}

/**
 * Real traffic updates the channel status (region alerts §3.3, sync report
 * §2.4) — only while the channel is still the one this run posted to, so a
 * save that changed it mid-run keeps its own status.
 */
async function recordStatus(
  channelId: string,
  status: DiscordChannelStatus,
  statusDetail: string | null,
  lastPostAt?: Date
): Promise<void> {
  await db
    .update(pinballmapState)
    .set({
      syncReportStatus: status,
      syncReportLastStatusDetail: statusDetail,
      ...(lastPostAt ? { syncReportLastPostAt: lastPostAt } : {}),
    })
    .where(
      and(
        eq(pinballmapState.id, "singleton"),
        eq(pinballmapState.syncReportChannelId, channelId)
      )
    );
}
