import { notifications } from "~/server/db/schema";
import type {
  NotificationChannel,
  NotificationPreferencesRow,
  ChannelContext,
  DeliveryResult,
} from "./types";
import type { NotificationType } from "~/lib/notifications/dispatch";

export const inAppChannel: NotificationChannel = {
  key: "in_app",
  shouldDeliver(
    prefs: NotificationPreferencesRow,
    type: NotificationType
  ): boolean {
    if (!prefs.inAppEnabled) return false;
    switch (type) {
      case "issue_assigned":
        return prefs.inAppNotifyOnAssigned;
      case "issue_status_changed":
        return prefs.inAppNotifyOnStatusChange;
      case "new_comment":
        return prefs.inAppNotifyOnNewComment;
      case "new_issue":
        return prefs.inAppNotifyOnNewIssue || prefs.inAppWatchNewIssuesGlobal;
      case "machine_ownership_changed":
        return true;
      case "mentioned":
        return prefs.inAppNotifyOnMentioned;
    }
  },
  async deliver(ctx: ChannelContext): Promise<DeliveryResult> {
    await ctx.tx.insert(notifications).values({
      userId: ctx.userId,
      type: ctx.type,
      resourceId: ctx.resourceId,
      resourceType: ctx.resourceType,
    });
    return { ok: true };
  },
};
