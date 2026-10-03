import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import type { DiscordChannelStatus } from "~/lib/discord/channel-check";
import {
  DISCORD_MESSAGE_FLAGS,
  postChannelMessage,
  type DiscordSendResult,
} from "~/lib/discord/client";
import { getDiscordBotToken } from "~/lib/discord/config";
import { DISCORD_MAX_MESSAGE_LENGTH } from "~/lib/discord/messages";
import { loadLineupData } from "~/lib/pinballmap/lineup-data";
import { requireSiteUrl } from "~/lib/url";
import { db } from "~/server/db";
import { discordIntegrationConfig } from "~/server/db/schema";

import {
  isActivitySummaryEventKey,
  type ActivitySummaryEventKey,
} from "./events";
import { loadActivityHistory, type ActivityPeriod } from "./history";
import { planSummaryMessages } from "./message";
import { buildSummaryModel } from "./model";
import {
  formatPinballMapSection,
  pinballMapReviewChanged,
  pinballMapReviewKeys,
} from "./pinball-map-section";
import {
  formatLineupDate,
  scheduledPeriodStart,
  scheduledPostInstant,
} from "./schedule";

/**
 * Posting the activity summary (discord-activity-summary spec §3, §5–§7).
 *
 * The cron route runs {@link runScheduledActivitySummary} every hour; it posts
 * only on the hours the saved schedule names. Send summary now runs
 * {@link sendActivitySummaryNow}. Both build the summary from stored data
 * only — the same lineup loader as the lineup page, never a Pinball Map call
 * (§5.12, CORE-PBM-001) — and post outside any transaction (CORE-ARCH-011).
 */

/** Room the Pinball Map section leaves in a message for the summary heading. */
const PINBALL_MAP_SECTION_MAX_LENGTH = DISCORD_MAX_MESSAGE_LENGTH - 200;
const HOUR_MS = 60 * 60 * 1000;
/** What Send summary now covers while the interval is Disabled (§3.8). */
const DISABLED_SEND_NOW_HOURS = 24;

interface SummaryConfig {
  channelId: string;
  intervalHours: number | null;
  startHour: number;
  events: ActivitySummaryEventKey[];
  periodEnd: Date | null;
  pinballMapReviewKeys: string[] | null;
}

async function readSummaryConfig(): Promise<SummaryConfig | null> {
  const row = await db.query.discordIntegrationConfig.findFirst({
    where: eq(discordIntegrationConfig.id, "singleton"),
    columns: {
      summaryChannelId: true,
      summaryIntervalHours: true,
      summaryStartHour: true,
      summaryEvents: true,
      summaryPeriodEnd: true,
      summaryPinballMapReviewKeys: true,
    },
  });
  const channelId = row?.summaryChannelId?.trim() ?? "";
  if (!row || channelId.length === 0) return null;
  return {
    channelId,
    intervalHours: row.summaryIntervalHours,
    startHour: row.summaryStartHour,
    events: row.summaryEvents.filter(isActivitySummaryEventKey),
    periodEnd: row.summaryPeriodEnd,
    pinballMapReviewKeys: row.summaryPinballMapReviewKeys,
  };
}

interface BuiltSummary {
  /** Empty for a scheduled period with nothing to report (§3.6). */
  messages: string[];
  /** The rows to review now (§5.11); null while there is no comparison. */
  pinballMapReviewKeys: string[] | null;
}

/**
 * Build a period's messages. Reads only — nothing is claimed or posted here,
 * so a read failure surfaces as an error without spending the period.
 */
async function buildSummary(args: {
  period: ActivityPeriod;
  events: readonly ActivitySummaryEventKey[];
  storedReviewKeys: string[] | null;
  trigger: "scheduled" | "manual";
}): Promise<BuiltSummary> {
  const siteUrl = requireSiteUrl("discord.activitySummary");
  const [history, lineup] = await Promise.all([
    loadActivityHistory(args.period, args.events),
    loadLineupData(),
  ]);
  const model = buildSummaryModel(history, args.events);

  const currentKeys = pinballMapReviewKeys(lineup.comparison);
  const locationId = lineup.state?.locationId ?? null;
  const lastRefreshFailed =
    lineup.state?.lastSyncStatus === "error" &&
    lineup.state.lastSyncedAt !== null;
  const section =
    args.events.includes("pinball_map_sync") && locationId !== null
      ? formatPinballMapSection({
          comparison: lineup.comparison,
          locationId,
          siteUrl,
          staleLineupDate:
            lastRefreshFailed && lineup.state?.lastSyncedAt
              ? formatLineupDate(lineup.state.lastSyncedAt)
              : null,
          maxLength: PINBALL_MAP_SECTION_MAX_LENGTH,
        })
      : null;

  return {
    messages: planSummaryMessages({
      model,
      period: args.period,
      siteUrl,
      trigger: args.trigger,
      pinballMap:
        section === null
          ? null
          : {
              section,
              changed: pinballMapReviewChanged(
                args.storedReviewKeys,
                currentKeys
              ),
            },
    }),
    pinballMapReviewKeys: currentKeys,
  };
}

/** Post the messages in order, stopping at the first failure. */
async function postMessages(
  botToken: string,
  channelId: string,
  messages: readonly string[]
): Promise<DiscordSendResult> {
  for (const content of messages) {
    const sent = await postChannelMessage({
      botToken,
      channelId,
      content,
      flags: DISCORD_MESSAGE_FLAGS.SUPPRESS_EMBEDS,
    });
    if (!sent.ok) return sent;
  }
  return { ok: true };
}

type FailedStatus = Extract<
  DiscordChannelStatus,
  "cant_post" | "couldnt_check" | "needs_discord"
>;

/** A failed post's channel status (region alerts §3.3). */
function failureStatus(sent: Exclude<DiscordSendResult, { ok: true }>): {
  status: FailedStatus;
  statusDetail: string;
} {
  if (sent.invalidToken) {
    return {
      status: "needs_discord",
      statusDetail: "Discord rejected the bot token",
    };
  }
  return sent.reason === "blocked"
    ? {
        status: "cant_post",
        statusDetail: "Channel unreachable or bot missing permissions",
      }
    : { status: "couldnt_check", statusDetail: "Discord was unreachable" };
}

/**
 * Real traffic updates the channel status (§2.7, region alerts §3.3) — only
 * while the channel is still the one this run posted to, so a save that
 * changed it mid-run keeps its own status.
 */
async function recordStatus(
  channelId: string,
  fields: {
    status: DiscordChannelStatus;
    statusDetail: string | null;
    lastPostAt?: Date;
    periodEnd?: Date;
    reviewKeys?: string[] | null;
  }
): Promise<void> {
  await db
    .update(discordIntegrationConfig)
    .set({
      summaryStatus: fields.status,
      summaryStatusDetail: fields.statusDetail,
      ...(fields.lastPostAt ? { summaryLastPostAt: fields.lastPostAt } : {}),
      ...(fields.periodEnd ? { summaryPeriodEnd: fields.periodEnd } : {}),
      ...(fields.reviewKeys
        ? { summaryPinballMapReviewKeys: fields.reviewKeys }
        : {}),
    })
    .where(
      and(
        eq(discordIntegrationConfig.id, "singleton"),
        eq(discordIntegrationConfig.summaryChannelId, channelId)
      )
    );
}

// ─── Scheduled ────────────────────────────────────────────────────────

export type ScheduledSummaryRun =
  | {
      outcome: "skipped";
      reason:
        | "no_channel"
        | "disabled"
        | "off_schedule"
        | "needs_discord"
        | "already_sent";
    }
  | { outcome: "quiet"; periodStart: string; periodEnd: string }
  | {
      outcome: "posted";
      periodStart: string;
      periodEnd: string;
      messages: number;
    }
  | {
      outcome: "failed";
      periodStart: string;
      periodEnd: string;
      status: FailedStatus;
    };

/**
 * One cron run (§3). Posts when this Central hour is a post time, covering
 * the period since the last one ended (§3.2, §3.3).
 *
 * The period is claimed before posting with an optimistic conditional UPDATE:
 * it moves the stored period end to this post time only if the end is still
 * the value this run read and the channel is unchanged. A duplicate delivery,
 * a concurrent run, or the second run of a repeated fall-back hour finds the
 * period already claimed (§3.4, §3.5). A failed post is not retried — the
 * period stays claimed and the next one starts where it ended (§3.7).
 */
export async function runScheduledActivitySummary(
  opts: { now?: Date } = {}
): Promise<ScheduledSummaryRun> {
  const now = opts.now ?? new Date();
  const config = await readSummaryConfig();
  if (config === null) return { outcome: "skipped", reason: "no_channel" };
  if (config.intervalHours === null) {
    return { outcome: "skipped", reason: "disabled" };
  }

  const postInstant = scheduledPostInstant(
    now,
    config.intervalHours,
    config.startHour
  );
  if (postInstant === null) {
    return { outcome: "skipped", reason: "off_schedule" };
  }
  if (
    config.periodEnd !== null &&
    config.periodEnd.getTime() >= postInstant.getTime()
  ) {
    return { outcome: "skipped", reason: "already_sent" };
  }

  // A missing token is reported without spending the period, so a run in the
  // same hour after the token is fixed still posts.
  const botToken = await getDiscordBotToken();
  if (!botToken) {
    await recordStatus(config.channelId, {
      status: "needs_discord",
      statusDetail: "Discord bot token not configured",
    });
    return { outcome: "skipped", reason: "needs_discord" };
  }

  const period = {
    start: scheduledPeriodStart(
      postInstant,
      config.intervalHours,
      config.periodEnd
    ),
    end: postInstant,
  };
  const built = await buildSummary({
    period,
    events: config.events,
    storedReviewKeys: config.pinballMapReviewKeys,
    trigger: "scheduled",
  });

  const claimed = await db
    .update(discordIntegrationConfig)
    .set({
      summaryPeriodEnd: postInstant,
      ...(built.pinballMapReviewKeys !== null
        ? { summaryPinballMapReviewKeys: built.pinballMapReviewKeys }
        : {}),
    })
    .where(
      and(
        eq(discordIntegrationConfig.id, "singleton"),
        eq(discordIntegrationConfig.summaryChannelId, config.channelId),
        config.periodEnd === null
          ? isNull(discordIntegrationConfig.summaryPeriodEnd)
          : eq(discordIntegrationConfig.summaryPeriodEnd, config.periodEnd)
      )
    )
    .returning({ id: discordIntegrationConfig.id });
  if (claimed.length === 0) {
    return { outcome: "skipped", reason: "already_sent" };
  }

  const periodStart = period.start.toISOString();
  const periodEnd = period.end.toISOString();
  if (built.messages.length === 0) {
    return { outcome: "quiet", periodStart, periodEnd };
  }

  const sent = await postMessages(botToken, config.channelId, built.messages);
  if (sent.ok) {
    await recordStatus(config.channelId, {
      status: "posting",
      statusDetail: null,
      lastPostAt: new Date(),
    });
    return {
      outcome: "posted",
      periodStart,
      periodEnd,
      messages: built.messages.length,
    };
  }

  const failure = failureStatus(sent);
  await recordStatus(config.channelId, failure);
  return { outcome: "failed", periodStart, periodEnd, status: failure.status };
}

// ─── Send summary now ─────────────────────────────────────────────────

export type SendSummaryNowOutcome =
  | { ok: true; messages: number }
  | { ok: false; reason: "no_channel" }
  | { ok: false; reason: FailedStatus; statusDetail: string };

/**
 * Send summary now (§3.8–§3.10): one interval ending now — 24 hours while the
 * interval is Disabled — posted even when there is nothing to report. Success
 * ends the current period here; a failure changes nothing but the status.
 */
export async function sendActivitySummaryNow(
  opts: { now?: Date } = {}
): Promise<SendSummaryNowOutcome> {
  const now = opts.now ?? new Date();
  const config = await readSummaryConfig();
  if (config === null) return { ok: false, reason: "no_channel" };

  const botToken = await getDiscordBotToken();
  if (!botToken) {
    const statusDetail = "Discord bot token not configured";
    await recordStatus(config.channelId, {
      status: "needs_discord",
      statusDetail,
    });
    return { ok: false, reason: "needs_discord", statusDetail };
  }

  const hours = config.intervalHours ?? DISABLED_SEND_NOW_HOURS;
  const built = await buildSummary({
    period: { start: new Date(now.getTime() - hours * HOUR_MS), end: now },
    events: config.events,
    storedReviewKeys: config.pinballMapReviewKeys,
    trigger: "manual",
  });

  const sent = await postMessages(botToken, config.channelId, built.messages);
  if (sent.ok) {
    await recordStatus(config.channelId, {
      status: "posting",
      statusDetail: null,
      lastPostAt: new Date(),
      periodEnd: now,
      reviewKeys: built.pinballMapReviewKeys,
    });
    return { ok: true, messages: built.messages.length };
  }

  const failure = failureStatus(sent);
  await recordStatus(config.channelId, failure);
  return {
    ok: false,
    reason: failure.status,
    statusDetail: failure.statusDetail,
  };
}
