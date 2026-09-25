import type { NotificationChannel, NotificationPreferencesRow } from "./types";
import type { NotificationType } from "~/lib/notifications/dispatch";

/**
 * In-app is a *transactional* channel: its `notifications` row is written
 * inside the DB transaction by `planNotification` (batched across all
 * recipients), NOT through a post-commit `deliver()`. So it implements only
 * `shouldDeliver`. (PP-2053.2)
 */
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
};
