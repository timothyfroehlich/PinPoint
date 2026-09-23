import { sendDm } from "~/lib/discord/client";
import type { DiscordConfig } from "~/lib/discord/config";
import { formatDiscordMessage } from "~/lib/discord/messages";
import { getSiteUrl } from "~/lib/url";
import { log } from "~/lib/logger";
import type {
  DeliveryChannel,
  NotificationPreferencesRow,
  ChannelContext,
  DeliveryResult,
} from "./types";
import type { NotificationType } from "~/lib/notifications/dispatch";
import type { RecipientReason } from "~/lib/notifications/events";

/**
 * Build a Discord notification channel bound to a specific config.
 *
 * The config (decrypted bot token, etc.) is captured in the closure once
 * per `getChannels()` call so that fan-out delivery to N recipients makes
 * exactly one Vault round-trip, not N+1.
 */
export function createDiscordChannel(config: DiscordConfig): DeliveryChannel {
  return {
    key: "discord",
    shouldDeliver(
      prefs: NotificationPreferencesRow,
      type: NotificationType,
      recipientReason?: RecipientReason
    ): boolean {
      if (!prefs.discordEnabled) return false;
      switch (type) {
        case "issue_assigned":
          return prefs.discordNotifyOnAssigned;
        case "issue_status_changed":
          return prefs.discordNotifyOnStatusChange;
        case "new_comment":
          return prefs.discordNotifyOnNewComment;
        case "new_issue":
          if (recipientReason === "global_watcher") {
            return prefs.discordWatchNewIssuesGlobal;
          }
          if (recipientReason) return prefs.discordNotifyOnNewIssue;
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

      const siteUrl = getSiteUrl();
      const issueBase = {
        siteUrl,
        resourceType: "issue" as const,
        issueTitle: ctx.issueTitle,
        formattedIssueId: ctx.formattedIssueId,
        machineName: ctx.machineName,
        actorName: ctx.actorName,
        recipientReason: ctx.recipientReason,
      };
      const content = (() => {
        switch (ctx.type) {
          case "new_issue":
            return formatDiscordMessage({
              ...issueBase,
              type: "new_issue",
              severity: ctx.severity,
              frequency: ctx.frequency,
            });
          case "issue_assigned":
            return formatDiscordMessage({
              ...issueBase,
              type: "issue_assigned",
              severity: ctx.severity,
            });
          case "issue_status_changed":
            return formatDiscordMessage({
              ...issueBase,
              type: "issue_status_changed",
              oldStatus: ctx.oldStatus ?? "new",
              newStatus: ctx.newStatus ?? "new",
            });
          case "new_comment":
          case "mentioned":
            return formatDiscordMessage({
              ...issueBase,
              type: ctx.type,
              commentContent: ctx.commentContent,
              commentId: ctx.commentId,
              attachmentCount: ctx.attachmentCount ?? 0,
            });
          case "machine_ownership_changed":
            return formatDiscordMessage({
              type: "machine_ownership_changed",
              siteUrl,
              resourceType: "machine",
              machineName: ctx.machineName,
              machineInitials: ctx.machineInitials,
              ownershipChange: ctx.ownershipChange ?? "added",
            });
        }
      })();

      const result = await sendDm({
        botToken: config.botToken,
        discordUserId: ctx.discordUserId,
        content,
      });

      if (result.ok) return { ok: true };
      if (result.reason === "not_configured") {
        return { ok: false, reason: "skipped" };
      }
      if (result.reason === "blocked") {
        log.warn(
          { userId: ctx.userId, action: "discord.deliver" },
          "Discord DM blocked"
        );
        return { ok: false, reason: "permanent" };
      }
      return { ok: false, reason: "transient" };
    },
  };
}
