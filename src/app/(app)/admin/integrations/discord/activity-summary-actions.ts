"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  checkDiscordChannel,
  fetchDiscordChannelName,
  type DiscordChannelStatus,
} from "~/lib/discord/channel-check";
import {
  DISCORD_MESSAGE_FLAGS,
  postChannelMessage,
} from "~/lib/discord/client";
import { getDiscordBotToken } from "~/lib/discord/config";
import { sanitizeDiscordText } from "~/lib/discord/messages";
import { ACTIVITY_SUMMARY_EVENT_KEYS } from "~/lib/discord/activity-summary/events";
import { log } from "~/lib/logger";
import { reportError } from "~/lib/observability/report-error";
import { getUserAccessLevel } from "~/lib/permissions/access";
import { checkPermission } from "~/lib/permissions/helpers";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { discordIntegrationConfig } from "~/server/db/schema";
import {
  saveActivitySummaryConfigSchema,
  sendActivitySummaryTestSchema,
} from "./schema";

const INTEGRATIONS_PATH = "/admin/integrations";

type IntegrationsAuthorization = { ok: true; userId: string } | { ok: false };

/** The manage-integrations gate (discord-activity-summary §8.1). */
async function authorizeIntegrationsAdmin(): Promise<IntegrationsAuthorization> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const accessLevel = await getUserAccessLevel(user.id);
  if (!checkPermission("admin.integrations.manage", accessLevel)) {
    return { ok: false };
  }
  return { ok: true, userId: user.id };
}

/**
 * The bot token for a channel check or test post. A Vault read failure is
 * reported and treated as "couldn't check" rather than as a missing token, so
 * a transient outage never tells the admin to reconfigure Discord.
 */
async function readBotToken(
  action: string
): Promise<{ ok: true; token: string | null } | { ok: false }> {
  try {
    return { ok: true, token: await getDiscordBotToken() };
  } catch (error) {
    log.warn({ err: error, action }, "Failed to read the Discord bot token");
    return { ok: false };
  }
}

async function readSavedSummaryChannel(): Promise<string | null> {
  const row = await db.query.discordIntegrationConfig.findFirst({
    where: eq(discordIntegrationConfig.id, "singleton"),
    columns: { summaryChannelId: true },
  });
  const trimmed = row?.summaryChannelId?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

// ─── Save ──────────────────────────────────────────────────────────────

export type SaveActivitySummaryConfigResult =
  | { ok: true; status: DiscordChannelStatus; statusDetail: string | null }
  | {
      ok: false;
      reason: "invalid" | "unauthorized" | "server_error";
      message: string;
    };

/**
 * Save the activity summary settings (discord-activity-summary §2). Saves on
 * its own: never reads or writes the bot credentials (§2.5).
 *
 * Every save with a channel checks it against Discord (§2.6), and the settings
 * persist whatever the check finds (CORE-ARCH-012). The check runs before the
 * write and outside any transaction (CORE-ARCH-011). Clearing the channel
 * stores Not configured.
 */
export async function saveActivitySummaryConfigAction(
  input: unknown
): Promise<SaveActivitySummaryConfigResult> {
  try {
    const authorization = await authorizeIntegrationsAdmin();
    if (!authorization.ok) {
      return {
        ok: false,
        reason: "unauthorized",
        message: "You no longer have permission to manage integrations.",
      };
    }

    const parsed = saveActivitySummaryConfigSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        reason: "invalid",
        message:
          parsed.error.issues[0]?.message ??
          "Activity summary settings invalid.",
      };
    }

    const { interval, startHour } = parsed.data;
    const channelId =
      parsed.data.channelId.length > 0 ? parsed.data.channelId : null;
    // Stored in catalog order, without duplicates.
    const chosen = new Set(parsed.data.events);
    const events = ACTIVITY_SUMMARY_EVENT_KEYS.filter((key) => chosen.has(key));

    const existing = await db.query.discordIntegrationConfig.findFirst({
      where: eq(discordIntegrationConfig.id, "singleton"),
      columns: {
        summaryChannelId: true,
        summaryStatus: true,
        summaryStatusDetail: true,
      },
    });
    const previousChannelId = existing?.summaryChannelId ?? null;
    const channelChanged = channelId !== previousChannelId;

    let status: DiscordChannelStatus =
      existing?.summaryStatus ?? "not_configured";
    let statusDetail: string | null = existing?.summaryStatusDetail ?? null;
    if (channelId === null) {
      status = "not_configured";
      statusDetail = null;
    } else {
      const token = await readBotToken("saveActivitySummaryConfigAction");
      if (token.ok) {
        ({ status, statusDetail } = await checkDiscordChannel(
          token.token,
          channelId
        ));
      } else {
        status = "couldnt_check";
        statusDetail = "Couldn't read the saved bot token";
      }
    }

    const now = new Date();
    const fields = {
      summaryChannelId: channelId,
      summaryIntervalHours: interval,
      summaryStartHour: startHour,
      summaryEvents: events,
      summaryStatus: status,
      summaryStatusDetail: statusDetail,
      // The last post belongs to the channel it went to.
      ...(channelChanged ? { summaryLastPostAt: null } : {}),
      updatedAt: now,
      updatedBy: authorization.userId,
    };
    await db
      .insert(discordIntegrationConfig)
      .values({ id: "singleton", ...fields })
      .onConflictDoUpdate({ target: discordIntegrationConfig.id, set: fields });

    revalidatePath(INTEGRATIONS_PATH);
    return { ok: true, status, statusDetail };
  } catch (error) {
    reportError(error, {
      action: "saveActivitySummaryConfigAction",
      bestEffort: false,
    });
    return {
      ok: false,
      reason: "server_error",
      message: "Couldn't save the activity summary settings. Try again.",
    };
  }
}

// ─── Test message ──────────────────────────────────────────────────────

export type SendActivitySummaryTestResult =
  | { ok: true; channelName?: string }
  | {
      ok: false;
      reason:
        | "invalid"
        | "needs_discord"
        | "cant_post"
        | "couldnt_check"
        | "unauthorized"
        | "server_error";
      message: string;
    };

function testMessage(channelName: string | undefined): string {
  return channelName
    ? `[PinPoint] Test message: The activity summary will post to #${sanitizeDiscordText(channelName)}.`
    : "[PinPoint] Test message: The activity summary will post to this channel.";
}

/**
 * Post a test line to a summary channel (discord-activity-summary §2.6,
 * region alerts §2.4). Only a test of the SAVED channel moves its stored
 * status; testing an unsaved edit says nothing about the channel summaries
 * post to.
 */
export async function sendActivitySummaryTestAction(
  rawChannelId: unknown
): Promise<SendActivitySummaryTestResult> {
  try {
    const authorization = await authorizeIntegrationsAdmin();
    if (!authorization.ok) {
      return {
        ok: false,
        reason: "unauthorized",
        message: "You no longer have permission to manage integrations.",
      };
    }

    const parsed = sendActivitySummaryTestSchema.safeParse(rawChannelId);
    if (!parsed.success) {
      return {
        ok: false,
        reason: "invalid",
        message: "Enter a numeric Discord channel ID.",
      };
    }
    const channelId = parsed.data;
    const testsSavedChannel = (await readSavedSummaryChannel()) === channelId;

    const recordStatus = async (
      status: DiscordChannelStatus,
      statusDetail: string | null,
      lastPostAt?: Date
    ): Promise<void> => {
      if (!testsSavedChannel) return;
      await db
        .update(discordIntegrationConfig)
        .set({
          summaryStatus: status,
          summaryStatusDetail: statusDetail,
          ...(lastPostAt ? { summaryLastPostAt: lastPostAt } : {}),
          updatedAt: new Date(),
          updatedBy: authorization.userId,
        })
        .where(eq(discordIntegrationConfig.id, "singleton"));
      revalidatePath(INTEGRATIONS_PATH);
    };

    const token = await readBotToken("sendActivitySummaryTestAction");
    if (!token.ok) {
      return {
        ok: false,
        reason: "couldnt_check",
        message: "Couldn't read the saved bot token.",
      };
    }
    if (!token.token) {
      await recordStatus("needs_discord", "Discord bot token not configured");
      return {
        ok: false,
        reason: "needs_discord",
        message: "Discord bot token is not configured.",
      };
    }

    const channelName = await fetchDiscordChannelName(token.token, channelId);
    const sent = await postChannelMessage({
      botToken: token.token,
      channelId,
      content: testMessage(channelName),
      flags: DISCORD_MESSAGE_FLAGS.SUPPRESS_EMBEDS,
    });

    if (sent.ok) {
      await recordStatus("posting", "Test message delivered", new Date());
      return channelName !== undefined
        ? { ok: true, channelName }
        : { ok: true };
    }

    const status = sent.reason === "blocked" ? "cant_post" : "couldnt_check";
    const statusDetail =
      sent.reason === "blocked"
        ? "Channel unreachable or bot missing permissions"
        : "Discord was unreachable";
    await recordStatus(status, statusDetail);
    return { ok: false, reason: status, message: statusDetail };
  } catch (error) {
    reportError(error, {
      action: "sendActivitySummaryTestAction",
      bestEffort: false,
    });
    return {
      ok: false,
      reason: "server_error",
      message: "Failed to send test message.",
    };
  }
}

// ─── Send summary now ──────────────────────────────────────────────────

export type SendActivitySummaryNowResult =
  | { ok: true }
  | { ok: false; reason: "unauthorized" | "unavailable"; message: string };

/** Send summary now (discord-activity-summary §3.8–§3.10). */
export async function sendActivitySummaryNowAction(): Promise<SendActivitySummaryNowResult> {
  const authorization = await authorizeIntegrationsAdmin();
  if (!authorization.ok) {
    return {
      ok: false,
      reason: "unauthorized",
      message: "You no longer have permission to manage integrations.",
    };
  }
  // PP-ogup scheduling phase: build and post the summary for the interval
  // ending now, and end the current period on success.
  return {
    ok: false,
    reason: "unavailable",
    message: "Send summary now is not available yet.",
  };
}
