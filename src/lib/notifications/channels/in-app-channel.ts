import {
  IN_APP_PREFERENCE_COLUMNS,
  shouldDeliverForChannel,
} from "./should-deliver";
import type { NotificationChannel, NotificationPreferencesRow } from "./types";
import type {
  NotificationType,
  RecipientReason,
} from "~/lib/notifications/events";

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
    type: NotificationType,
    recipientReason?: RecipientReason
  ): boolean {
    return shouldDeliverForChannel(
      IN_APP_PREFERENCE_COLUMNS,
      prefs,
      type,
      recipientReason
    );
  },
};
