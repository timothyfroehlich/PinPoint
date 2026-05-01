import type { DbTransaction } from "~/server/db";
import type { notificationPreferences } from "~/server/db/schema";
import type { NotificationType } from "~/lib/notifications/dispatch";

/**
 * Preferences row shape — matches Drizzle's inferred select type for
 * `notificationPreferences`. Kept as a type alias so channels don't
 * need to import the Drizzle table.
 */
export type NotificationPreferencesRow =
  typeof notificationPreferences.$inferSelect;

/**
 * Per-notification context assembled by the dispatcher and passed to
 * every channel. Channels read only the fields they need.
 */
export interface ChannelContext {
  userId: string;
  type: NotificationType;
  resourceId: string;
  resourceType: "issue" | "machine";
  // Recipient profile data
  email: string | null;
  discordUserId: string | null;
  // Resolved at the top of createNotification before the fan-out
  issueTitle?: string | undefined;
  machineName?: string | undefined;
  formattedIssueId?: string | undefined;
  commentContent?: string | undefined;
  newStatus?: string | undefined;
  issueDescription?: string | undefined;
  // The Drizzle transaction/db handle for channels that write to the DB
  // (in-app channel inserts a `notifications` row).
  tx: DbTransaction;
}

/**
 * Delivery result — discriminated so later PRs (specifically PR 5's
 * Discord failure detection) can react to specific failure kinds
 * without catching exceptions.
 */
export type DeliveryResult =
  | { ok: true }
  | { ok: false; reason: "transient" | "permanent" | "skipped" };

/**
 * The channel contract. Channels are plain objects (decision #1) —
 * no classes, no DI framework. Closures over transport deps are
 * created inside each channel module.
 */
export interface NotificationChannel {
  /** Stable identifier used for logging and (in PR 4) telemetry. */
  readonly key: "email" | "in_app" | "discord";
  /**
   * Pure predicate over preferences + event type.
   * Returns true if this channel wants to deliver for this recipient.
   * MUST NOT perform I/O. MUST NOT throw.
   */
  shouldDeliver(
    prefs: NotificationPreferencesRow,
    type: NotificationType
  ): boolean;
  /**
   * Perform the actual delivery. Called concurrently with other
   * channels under Promise.allSettled. Errors are caught and logged
   * by the dispatcher — channels should still handle their own
   * expected failures.
   */
  deliver(ctx: ChannelContext): Promise<DeliveryResult>;
}
