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
 * Per-recipient delivery context for an external channel (email, Discord).
 *
 * Deliberately carries NO database handle: external delivery is a post-commit
 * side effect (see `dispatchNotification`), so it must never hold a transaction
 * open across a slow HTTP call. The transactional in-app write happens earlier,
 * inside `planNotification`, not through a channel `deliver()`. (PP-2053.2)
 */
export interface ChannelContext {
  userId: string;
  type: NotificationType;
  resourceId: string;
  resourceType: "issue" | "machine";
  // Recipient profile data
  email: string | null;
  discordUserId: string | null;
  // Resolved at the top of planNotification before the fan-out
  issueTitle?: string | undefined;
  machineName?: string | undefined;
  formattedIssueId?: string | undefined;
  commentContent?: string | undefined;
  newStatus?: string | undefined;
  issueDescription?: string | undefined;
  /**
   * Stable per-event identifier that discriminates distinct occurrences of the
   * same notification type on the same resource for the same recipient.
   *
   * Without it, two different comments on the same issue produce the same
   * email idempotency key and Resend silently drops the second email (PP-pfyf).
   *
   * Pass the comment UUID for new_comment / mentioned events. For event types
   * that are structurally unique per resource-state transition (new_issue,
   * issue_status_changed, issue_assigned, machine_ownership_changed) this field
   * is absent and the key remains discriminated by resourceId alone, which is
   * correct for those cases.
   */
  eventId?: string | undefined;
}

/**
 * Delivery result — discriminated so later PRs (specifically PR 5's
 * Discord failure detection) can react to specific failure kinds
 * without catching exceptions.
 */
export type DeliveryResult =
  { ok: true } | { ok: false; reason: "transient" | "permanent" | "skipped" };

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
   * Perform the actual external delivery (email/Discord HTTP). Run AFTER the
   * DB transaction commits, concurrently with other channels under
   * Promise.allSettled; errors are caught and logged by the dispatcher.
   *
   * Optional: transactional channels (in_app) omit it — their row is written
   * inside `planNotification`, not delivered post-commit. (PP-2053.2)
   */
  deliver?(ctx: ChannelContext): Promise<DeliveryResult>;
}

/**
 * A channel that performs external delivery (email, Discord). Distinguished
 * from the transactional in-app channel by a *required* `deliver` — these are
 * the channels run post-commit by `dispatchNotification`. (PP-2053.2)
 */
export interface DeliveryChannel extends NotificationChannel {
  deliver(ctx: ChannelContext): Promise<DeliveryResult>;
}
