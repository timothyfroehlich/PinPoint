import type {
  NotificationType,
  RecipientReason,
} from "~/lib/notifications/events";
import type { NotificationPreferencesRow } from "./types";

/** Keys of the preferences row whose value is a boolean toggle. */
type BooleanPreferenceKey = {
  [
    K in keyof NotificationPreferencesRow
  ]: NotificationPreferencesRow[K] extends boolean ? K : never;
}[keyof NotificationPreferencesRow];

/**
 * Which preference column a channel reads for each rule: its main switch plus
 * its per-event toggles. Every channel applies identical logic to its own
 * column family, so this map is the only thing that differs between channels.
 * Values are typed as boolean-valued columns of the preferences row, so a
 * renamed or dropped column is a compile error here.
 */
export interface ChannelPreferenceColumns {
  readonly enabled: BooleanPreferenceKey;
  readonly assigned: BooleanPreferenceKey;
  readonly statusChange: BooleanPreferenceKey;
  readonly newComment: BooleanPreferenceKey;
  readonly newIssue: BooleanPreferenceKey;
  readonly watchNewIssuesGlobal: BooleanPreferenceKey;
  readonly mentioned: BooleanPreferenceKey;
  readonly pinballMapComment: BooleanPreferenceKey;
}

export const EMAIL_PREFERENCE_COLUMNS = {
  enabled: "emailEnabled",
  assigned: "emailNotifyOnAssigned",
  statusChange: "emailNotifyOnStatusChange",
  newComment: "emailNotifyOnNewComment",
  newIssue: "emailNotifyOnNewIssue",
  watchNewIssuesGlobal: "emailWatchNewIssuesGlobal",
  mentioned: "emailNotifyOnMentioned",
  pinballMapComment: "emailNotifyOnPinballMapComment",
} as const satisfies ChannelPreferenceColumns;

export const IN_APP_PREFERENCE_COLUMNS = {
  enabled: "inAppEnabled",
  assigned: "inAppNotifyOnAssigned",
  statusChange: "inAppNotifyOnStatusChange",
  newComment: "inAppNotifyOnNewComment",
  newIssue: "inAppNotifyOnNewIssue",
  watchNewIssuesGlobal: "inAppWatchNewIssuesGlobal",
  mentioned: "inAppNotifyOnMentioned",
  pinballMapComment: "inAppNotifyOnPinballMapComment",
} as const satisfies ChannelPreferenceColumns;

export const DISCORD_PREFERENCE_COLUMNS = {
  enabled: "discordEnabled",
  assigned: "discordNotifyOnAssigned",
  statusChange: "discordNotifyOnStatusChange",
  newComment: "discordNotifyOnNewComment",
  newIssue: "discordNotifyOnNewIssue",
  watchNewIssuesGlobal: "discordWatchNewIssuesGlobal",
  mentioned: "discordNotifyOnMentioned",
  pinballMapComment: "discordNotifyOnPinballMapComment",
} as const satisfies ChannelPreferenceColumns;

/**
 * One implementation of the per-channel notification preference rules,
 * shared by the email, in-app, and Discord channels.
 *
 * - The channel's main switch gates everything.
 * - `machine_ownership_changed` is a critical event: only the main switch can
 *   opt out of it, no per-event column exists or is consulted.
 * - `new_issue` for a global watcher reads the global-watch column; for any
 *   other recipient reason it reads the owner column; with no reason (a
 *   caller that cannot tell) either column grants delivery.
 *
 * Pure: no I/O, never throws.
 */
export function shouldDeliverForChannel(
  columns: ChannelPreferenceColumns,
  prefs: NotificationPreferencesRow,
  type: NotificationType,
  recipientReason?: RecipientReason
): boolean {
  const column = (rule: keyof ChannelPreferenceColumns): boolean =>
    prefs[columns[rule]];

  if (!column("enabled")) return false;
  switch (type) {
    case "issue_assigned":
      return column("assigned");
    case "issue_status_changed":
      return column("statusChange");
    case "new_comment":
      return column("newComment");
    case "new_issue":
      if (recipientReason === "global_watcher") {
        return column("watchNewIssuesGlobal");
      }
      if (recipientReason) return column("newIssue");
      return column("newIssue") || column("watchNewIssuesGlobal");
    case "machine_ownership_changed":
      return true;
    case "mentioned":
      return column("mentioned");
    case "pinballmap_comment":
      return column("pinballMapComment");
  }
}
