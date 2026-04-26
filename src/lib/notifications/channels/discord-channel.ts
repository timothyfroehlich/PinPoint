import { sendDm } from "~/lib/discord/client";
import { getDiscordConfig } from "~/lib/discord/config";
import { formatDiscordMessage } from "~/lib/discord/messages";
import { getSiteUrl } from "~/lib/url";
import { log } from "~/lib/logger";
import type {
  NotificationChannel,
  NotificationPreferencesRow,
  ChannelContext,
  DeliveryResult,
} from "./types";
import type { NotificationType } from "~/lib/notifications/dispatch";

export const discordChannel: NotificationChannel = {
  key: "discord",
  shouldDeliver(
    prefs: NotificationPreferencesRow,
    type: NotificationType
  ): boolean {
    if (!prefs.discordEnabled) return false;
    if (prefs.discordDmBlockedAt) return false;
    switch (type) {
      case "issue_assigned":
        return prefs.discordNotifyOnAssigned;
      case "issue_status_changed":
        return prefs.discordNotifyOnStatusChange;
      case "new_comment":
        return prefs.discordNotifyOnNewComment;
      case "new_issue":
        return (
          prefs.discordNotifyOnNewIssue || prefs.discordWatchNewIssuesGlobal
        );
      case "machine_ownership_changed":
        // Parity with email: critical event — preference cannot opt out
        // (only the main discordEnabled switch can).
        return true;
      case "mentioned":
        return prefs.discordNotifyOnMentioned;
    }
  },
  async deliver(ctx: ChannelContext): Promise<DeliveryResult> {
    if (!ctx.discordUserId) return { ok: false, reason: "skipped" };

    const config = await getDiscordConfig();
    if (!config) return { ok: false, reason: "skipped" };

    const content = formatDiscordMessage({
      type: ctx.type,
      siteUrl: getSiteUrl(),
      resourceType: ctx.resourceType,
      resourceId: ctx.resourceId,
      issueTitle: ctx.issueTitle,
      formattedIssueId: ctx.formattedIssueId,
      machineName: ctx.machineName,
      newStatus: ctx.newStatus,
      commentContent: ctx.commentContent,
    });

    const result = await sendDm({
      botToken: config.botToken,
      discordUserId: ctx.discordUserId,
      content,
    });

    if (result.ok) return { ok: true };
    if (result.reason === "blocked") {
      // PR 5 will react to this and emit system_discord_dm_blocked.
      log.warn(
        { userId: ctx.userId, action: "discord.deliver" },
        "Discord DM blocked"
      );
      return { ok: false, reason: "permanent" };
    }
    if (result.reason === "not_configured") {
      return { ok: false, reason: "skipped" };
    }
    return { ok: false, reason: "transient" };
  },
};
