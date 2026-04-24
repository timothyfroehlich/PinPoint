import { sendEmail } from "~/lib/email/client";
import { log } from "~/lib/logger";
import { isInternalAccount } from "~/lib/auth/internal-accounts";
import { getEmailHtml, getEmailSubject } from "~/lib/notification-formatting";
import type {
  NotificationChannel,
  NotificationPreferencesRow,
  ChannelContext,
  DeliveryResult,
} from "./types";
import type { NotificationType } from "~/lib/notifications/dispatch";

export const emailChannel: NotificationChannel = {
  key: "email",
  shouldDeliver(
    prefs: NotificationPreferencesRow,
    type: NotificationType
  ): boolean {
    if (!prefs.emailEnabled) return false;
    switch (type) {
      case "issue_assigned":
        return prefs.emailNotifyOnAssigned;
      case "issue_status_changed":
        return prefs.emailNotifyOnStatusChange;
      case "new_comment":
        return prefs.emailNotifyOnNewComment;
      case "new_issue":
        return prefs.emailNotifyOnNewIssue || prefs.emailWatchNewIssuesGlobal;
      case "machine_ownership_changed":
        // Critical event — preferences cannot opt out (only main switch can).
        return true;
      case "mentioned":
        return prefs.emailNotifyOnMentioned;
    }
  },
  async deliver(ctx: ChannelContext): Promise<DeliveryResult> {
    if (!ctx.email || isInternalAccount(ctx.email)) {
      return { ok: false, reason: "skipped" };
    }

    try {
      await sendEmail({
        to: ctx.email,
        subject: getEmailSubject(
          ctx.type,
          ctx.issueTitle,
          ctx.machineName,
          ctx.formattedIssueId,
          ctx.newStatus
        ),
        html: getEmailHtml({
          type: ctx.type,
          issueTitle: ctx.issueTitle,
          machineName: ctx.machineName,
          formattedIssueId: ctx.formattedIssueId,
          commentContent: ctx.commentContent,
          newStatus: ctx.newStatus,
          userId: ctx.userId,
          issueDescription: ctx.issueDescription,
        }),
      });
      return { ok: true };
    } catch (err) {
      log.error({ err }, "Failed to send email notification");
      return { ok: false, reason: "transient" };
    }
  },
};
