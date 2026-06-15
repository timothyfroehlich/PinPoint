import { eq, inArray } from "drizzle-orm";
import { db, type DbTransaction } from "~/server/db";
import {
  notifications,
  notificationPreferences,
  userProfiles,
  issues,
  issueWatchers,
  machines,
  machineWatchers,
} from "~/server/db/schema";
import type { IssueWatcher } from "~/lib/types/database";
import { log } from "~/lib/logger";
import { reportError } from "~/lib/observability/report-error";
import { getChannels } from "./channels/registry";
import type {
  ChannelContext,
  DeliveryChannel,
  DeliveryResult,
  NotificationChannel,
} from "./channels/types";

export type { NotificationChannel };
export { getChannels };

type NotificationPreferences = typeof notificationPreferences.$inferSelect;

export type NotificationType =
  | "issue_assigned"
  | "issue_status_changed"
  | "new_comment"
  | "new_issue"
  | "machine_ownership_changed"
  | "mentioned";

type ResourceType = "issue" | "machine";

/**
 * Narrow a channel to one that performs external delivery. Narrowing the whole
 * object (rather than extracting `channel.deliver` into a local) keeps the
 * method bound to its channel, so the deferred thunk calls it with the right
 * `this` and avoids the unbound-method footgun. (PP-2053.2)
 */
function isDeliveryChannel(
  channel: NotificationChannel
): channel is DeliveryChannel {
  return typeof channel.deliver === "function";
}

/**
 * Output of `planNotification`: the tx-free external deliveries (email, Discord)
 * to run AFTER the DB transaction commits. In-app rows are already written
 * transactionally during planning, so they are not represented here. Pass this
 * to `dispatchNotification` post-commit. (PP-2053.2)
 */
export interface DeliveryPlan {
  deliveries: (() => Promise<DeliveryResult>)[];
}

export interface CreateNotificationProps {
  type: NotificationType;
  resourceId: string;
  resourceType: ResourceType;
  actorId?: string | undefined;
  /**
   * Whether to include the actor in the recipient set (default: true).
   *
   * Two separate layers control actor self-notification:
   * - `includeActor: false` — Business rule override. The actor is structurally
   *   excluded from the recipient set regardless of user preferences. Use for
   *   notifications where the actor is not a valid recipient (e.g., assigner
   *   in issue_assigned, admin performing machine ownership changes).
   * - `suppressOwnActions` (user pref) — The actor can globally opt out of
   *   receiving notifications for their own actions. Only evaluated when
   *   includeActor is true (default).
   */
  includeActor?: boolean | undefined;
  issueTitle?: string | undefined;
  machineName?: string | undefined;
  formattedIssueId?: string | undefined;
  commentContent?: string | undefined;
  newStatus?: string | undefined;
  issueDescription?: string | undefined;
  additionalRecipientIds?: string[] | undefined;
}

export async function planNotification(
  {
    type,
    resourceId,
    resourceType,
    actorId,
    includeActor = true,
    issueTitle,
    machineName,
    formattedIssueId,
    commentContent,
    newStatus,
    issueDescription,
    additionalRecipientIds,
  }: CreateNotificationProps,
  tx: DbTransaction = db,
  preResolvedChannels?: readonly NotificationChannel[]
): Promise<DeliveryPlan> {
  log.debug(
    { type, resourceId, actorId, action: "planNotification" },
    "Planning notification"
  );

  // 1. Determine recipients
  const recipientIds = new Set<string>();

  const addRecipients = (...ids: (string | null | undefined)[]): void => {
    ids.forEach((id) => {
      if (id) recipientIds.add(id);
    });
  };

  addRecipients(...(additionalRecipientIds ?? []));

  let resolvedIssueTitle = issueTitle;
  let resolvedMachineName = machineName;
  let resolvedFormattedIssueId = formattedIssueId;

  if (type === "new_issue") {
    let machineId: string | null;
    let machineOwnerId: string | null;

    if (resourceType === "issue") {
      const issue = await tx.query.issues.findFirst({
        where: eq(issues.id, resourceId),
        with: { machine: true },
      });
      machineId = issue?.machine.id ?? null;
      machineOwnerId = issue?.machine.ownerId ?? null;
      resolvedIssueTitle = resolvedIssueTitle ?? issue?.title;
      resolvedMachineName = resolvedMachineName ?? issue?.machine.name;
      // Derive the formatted id from the SAME row we just fetched — the query
      // above selects all issue columns, so a second findFirst for
      // issueNumber/machineInitials is redundant round-trip inside the
      // transaction window. (PP-2053.2 review)
      if (!resolvedFormattedIssueId && issue) {
        resolvedFormattedIssueId = `${issue.machineInitials}-${String(issue.issueNumber).padStart(2, "0")}`;
      }
    } else {
      const machine = await tx.query.machines.findFirst({
        where: eq(machines.id, resourceId),
        columns: { id: true, name: true, ownerId: true },
      });
      machineId = machine?.id ?? null;
      machineOwnerId = machine?.ownerId ?? null;
      resolvedMachineName = resolvedMachineName ?? machine?.name;
    }

    const globalSubscribers = await tx.query.notificationPreferences.findMany({
      where: (prefs, { or, eq }) =>
        or(
          eq(prefs.emailWatchNewIssuesGlobal, true),
          eq(prefs.inAppWatchNewIssuesGlobal, true),
          eq(prefs.discordWatchNewIssuesGlobal, true)
        ),
    });

    addRecipients(...globalSubscribers.map((p) => p.userId));

    // Owners always get new_issue (per-user prefs still gate delivery);
    // toggleMachineWatcher can remove them from machine_watchers.
    addRecipients(machineOwnerId);

    if (machineId) {
      const watchersList = await tx.query.machineWatchers.findMany({
        where: eq(machineWatchers.machineId, machineId),
      });

      addRecipients(...watchersList.map((w) => w.userId));

      if (resourceType === "issue") {
        const fullSubscribers = watchersList.filter(
          (w) => w.watchMode === "subscribe"
        );

        if (fullSubscribers.length > 0) {
          await tx
            .insert(issueWatchers)
            .values(
              fullSubscribers.map((w) => ({
                issueId: resourceId,
                userId: w.userId,
              }))
            )
            .onConflictDoNothing();
        }
      }
    }
  } else if (
    resourceType === "issue" &&
    type !== "issue_assigned" &&
    type !== "mentioned"
  ) {
    const watchers = await tx.query.issueWatchers.findMany({
      where: eq(issueWatchers.issueId, resourceId),
    });

    addRecipients(...watchers.map((w: IssueWatcher) => w.userId));
  }

  if (includeActor && actorId) {
    recipientIds.add(actorId);
  }
  if (actorId && !includeActor) {
    recipientIds.delete(actorId);
  }

  if (recipientIds.size === 0) return { deliveries: [] };

  // 2. Fetch preferences
  const preferences = await tx.query.notificationPreferences.findMany({
    where: inArray(notificationPreferences.userId, [...recipientIds]),
  });
  const prefsMap = new Map(preferences.map((p) => [p.userId, p]));

  // 3. Fetch emails (avoid N+1)
  const users = await tx
    .select({
      id: userProfiles.id,
      email: userProfiles.email,
      discordUserId: userProfiles.discordUserId,
    })
    .from(userProfiles)
    .where(inArray(userProfiles.id, [...recipientIds]));
  const emailMap = new Map(users.map((u) => [u.id, u.email]));
  const discordUserIdMap = new Map(users.map((u) => [u.id, u.discordUserId]));

  // 4. Fan-out per recipient using the channel registry.
  //    See src/lib/notifications/channels/registry.ts.
  //    Callers that open a DB transaction SHOULD resolve channels before
  //    entering the transaction and pass them in as `preResolvedChannels` to
  //    avoid an HTTP round-trip (Supabase Vault RPC) inside the transaction
  //    window, which inflates connection-hold time on the pool.
  const channels = preResolvedChannels ?? (await getChannels());

  // Rows for batched in-app insert (preserves historical single-INSERT).
  const notificationsToInsert: {
    userId: string;
    type: NotificationType;
    resourceId: string;
    resourceType: ResourceType;
  }[] = [];

  // Email dispatch is concurrent via Promise.allSettled so one slow/failed
  // email doesn't block others (spec: "Promise.allSettled concurrent dispatch
  // preserved").
  const deferredDeliveries: (() => Promise<DeliveryResult>)[] = [];

  for (const userId of recipientIds) {
    const prefs =
      (prefsMap.get(userId) as NotificationPreferences | undefined) ??
      buildDefaultPrefs(userId);

    // Cross-channel pre-dispatch rule: skip own actions entirely.
    // (Spec decision: suppressOwnActions stays at the top of the recipient
    // loop — it is NOT per-channel.)
    if (actorId && userId === actorId && prefs.suppressOwnActions) {
      continue;
    }

    const ctx: ChannelContext = {
      userId,
      type,
      resourceId,
      resourceType,
      email: emailMap.get(userId) ?? null,
      discordUserId: discordUserIdMap.get(userId) ?? null,
      issueTitle: resolvedIssueTitle,
      machineName: resolvedMachineName,
      formattedIssueId: resolvedFormattedIssueId,
      commentContent,
      newStatus,
      issueDescription,
    };

    for (const channel of channels) {
      if (!channel.shouldDeliver(prefs, type)) continue;

      if (channel.key === "in_app") {
        // Batched insert — collect, don't deliver individually.
        notificationsToInsert.push({
          userId,
          type,
          resourceId,
          resourceType,
        });
      } else if (isDeliveryChannel(channel)) {
        // External channel (email/Discord): captured as a thunk and run only
        // in dispatchNotification, AFTER the transaction commits — never
        // holding the connection open across an HTTP call. (PP-2053.2)
        deferredDeliveries.push(() => channel.deliver(ctx));
      } else {
        // A channel that wants delivery (shouldDeliver true) but is neither the
        // transactional in_app channel nor an external DeliveryChannel can't be
        // routed. Today this is unreachable (registry = in_app/email/discord),
        // but fail loud rather than silently drop a recipient if that changes.
        log.warn(
          { channelKey: channel.key, action: "planNotification" },
          "Channel wants delivery but has no delivery path; skipping"
        );
      }
    }
  }

  if (notificationsToInsert.length > 0) {
    log.debug(
      { count: notificationsToInsert.length, action: "planNotification" },
      "Inserting notifications"
    );
    await tx.insert(notifications).values(notificationsToInsert);
  }

  // In-app rows are now written inside the caller's transaction. The external
  // deliveries are returned UNRUN so the caller dispatches them AFTER commit
  // (see dispatchNotification) — the fix for the silent Doodle Bug, where the
  // email ran inside the transaction and was sent even though it rolled back.
  // (PP-2053.2)
  return { deliveries: deferredDeliveries };
}

/**
 * Run the external deliveries (email/Discord) produced by `planNotification`.
 * Call this AFTER the DB transaction has committed — never inside it. Failures
 * are best-effort: the issue is already durably saved, so a send that fails
 * must not surface as a primary-action error. (PP-2053.2)
 */
export async function dispatchNotification(plan: DeliveryPlan): Promise<void> {
  if (plan.deliveries.length === 0) return;
  const results = await Promise.allSettled(plan.deliveries.map((fn) => fn()));
  for (const r of results) {
    if (r.status === "rejected") {
      // Channel.deliver() is expected to catch its own errors and return
      // {ok:false}. A rejection here means a bug — report it.
      reportError(r.reason, {
        bestEffort: true,
        action: "notifications.dispatch.fanout",
      });
    } else if (!r.value.ok && r.value.reason !== "skipped") {
      // A fulfilled-but-failed send (bounced email, blocked Discord DM). These
      // are caught inside the channel and returned as {ok:false}, so they never
      // reject — without this branch they'd vanish silently, exactly the
      // observability gap this epic exists to close. "skipped" (no Discord id /
      // not configured) is expected and intentionally not logged. (PP-2053.2)
      log.warn(
        { reason: r.value.reason, action: "notifications.dispatch.fanout" },
        "Notification delivery failed"
      );
    }
  }
}

/**
 * One-shot convenience: plan against the default DB handle, then immediately
 * dispatch. Intended for post-commit call sites — there is no active transaction
 * at the call point and no need to pass a specific DB handle.
 *
 * The former `tx` and `preResolvedChannels` parameters have been removed
 * (PP-lbqh / CORE-ARCH-011). The `tx` parameter was a latent footgun: a caller
 * passing a live transaction would have dispatched email / Discord BEFORE commit,
 * re-introducing the Doodle Bug (PP-2053). Call sites that need to query from a
 * specific DB handle (e.g. integration tests using PGlite, or the two-phase
 * plan/dispatch split) should call `planNotification(props, db)` directly and
 * then `dispatchNotification(plan)` after the transaction resolves.
 */
export async function createNotification(
  props: CreateNotificationProps
): Promise<void> {
  const plan = await planNotification(props);
  await dispatchNotification(plan);
}

/**
 * Fallback prefs used within this module when a user has no row in
 * notification_preferences.
 */
function buildDefaultPrefs(userId: string): NotificationPreferences {
  return {
    userId,
    emailEnabled: true,
    inAppEnabled: true,
    suppressOwnActions: false,
    emailNotifyOnAssigned: true,
    inAppNotifyOnAssigned: true,
    emailNotifyOnStatusChange: false,
    inAppNotifyOnStatusChange: false,
    emailNotifyOnNewComment: false,
    inAppNotifyOnNewComment: false,
    emailNotifyOnMentioned: true,
    inAppNotifyOnMentioned: true,
    emailNotifyOnNewIssue: true,
    inAppNotifyOnNewIssue: false,
    emailWatchNewIssuesGlobal: false,
    inAppWatchNewIssuesGlobal: false,
    discordEnabled: true,
    discordNotifyOnAssigned: true,
    discordNotifyOnStatusChange: false,
    discordNotifyOnNewComment: false,
    discordNotifyOnMentioned: true,
    discordNotifyOnNewIssue: true,
    discordWatchNewIssuesGlobal: false,
    discordDmBlockedAt: null,
  };
}
