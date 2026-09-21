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
import type {
  NotificationEvent,
  NotificationType,
  RecipientReason,
} from "~/lib/notifications/events";
import { getChannels } from "./channels/registry";
import type {
  ChannelContext,
  DeliveryChannel,
  DeliveryResult,
  NotificationChannel,
} from "./channels/types";

export type { NotificationChannel };
export { getChannels };
export type { NotificationEvent, NotificationType, RecipientReason };

type NotificationPreferences = typeof notificationPreferences.$inferSelect;

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

/** @deprecated Prefer the explicit NotificationEvent name. */
export type CreateNotificationProps = NotificationEvent;

interface DiscordCandidate {
  userId: string;
  type: NotificationType;
  order: number;
  deliver: () => Promise<DeliveryResult>;
}

const DISCORD_EVENT_PRIORITY: Record<NotificationType, number> = {
  issue_assigned: 3,
  mentioned: 2,
  issue_status_changed: 1,
  new_comment: 1,
  new_issue: 1,
  machine_ownership_changed: 1,
};

const RECIPIENT_REASON_PRIORITY: Record<RecipientReason, number> = {
  assignee: 9,
  mentioned: 8,
  machine_owner: 7,
  ownership_added: 7,
  ownership_removed: 7,
  machine_watcher: 6,
  issue_watcher: 5,
  global_watcher: 4,
  actor: 1,
};

function directRecipientReason(event: NotificationEvent): RecipientReason {
  switch (event.type) {
    case "issue_assigned":
      return "assignee";
    case "mentioned":
      return "mentioned";
    case "machine_ownership_changed":
      return event.ownershipChange === "added"
        ? "ownership_added"
        : "ownership_removed";
    case "new_issue":
    case "new_comment":
    case "issue_status_changed":
      return "issue_watcher";
  }
}

function sortReasons(reasons: Set<RecipientReason>): RecipientReason[] {
  return [...reasons].sort(
    (left, right) =>
      RECIPIENT_REASON_PRIORITY[right] - RECIPIENT_REASON_PRIORITY[left]
  );
}

async function planNotificationCandidate(
  event: NotificationEvent,
  tx: DbTransaction = db,
  preResolvedChannels?: readonly NotificationChannel[],
  discordCandidates?: DiscordCandidate[]
): Promise<DeliveryPlan> {
  const { type, resourceId, resourceType, actorId, eventId } = event;
  const includeActor = event.includeActor ?? true;
  const issueTitle =
    event.resourceType === "issue" ? event.issueTitle : undefined;
  const machineName = event.machineName;
  const machineInitials =
    event.resourceType === "machine" ? event.machineInitials : undefined;
  const formattedIssueId =
    event.resourceType === "issue" ? event.formattedIssueId : undefined;
  const commentContent =
    event.type === "new_comment" || event.type === "mentioned"
      ? event.commentContent
      : undefined;
  const issueDescription =
    event.type === "new_issue" || event.type === "issue_assigned"
      ? event.issueDescription
      : undefined;
  log.debug(
    { type, resourceId, actorId, action: "planNotification" },
    "Planning notification"
  );

  // 1. Determine recipients
  const recipientIds = new Set<string>();
  const recipientReasons = new Map<string, Set<RecipientReason>>();

  const addRecipients = (
    reason: RecipientReason,
    ...ids: (string | null | undefined)[]
  ): void => {
    ids.forEach((id) => {
      if (!id) return;
      recipientIds.add(id);
      const reasons = recipientReasons.get(id);
      if (reasons) reasons.add(reason);
      else recipientReasons.set(id, new Set([reason]));
    });
  };

  addRecipients(
    directRecipientReason(event),
    ...(event.additionalRecipientIds ?? [])
  );

  let resolvedIssueTitle = issueTitle;
  let resolvedMachineName = machineName;
  let resolvedMachineInitials = machineInitials;
  let resolvedFormattedIssueId = formattedIssueId;

  if (type === "new_issue") {
    const issue = await tx.query.issues.findFirst({
      where: eq(issues.id, resourceId),
      with: { machine: true },
    });
    const machineId = issue?.machine.id ?? null;
    const machineOwnerId = issue?.machine.ownerId ?? null;
    resolvedIssueTitle = resolvedIssueTitle ?? issue?.title;
    resolvedMachineName = resolvedMachineName ?? issue?.machine.name;
    // Derive the formatted id from the SAME row we just fetched — the query
    // above selects all issue columns, so a second findFirst for
    // issueNumber/machineInitials is redundant round-trip inside the
    // transaction window. (PP-2053.2 review)
    if (!resolvedFormattedIssueId && issue) {
      resolvedFormattedIssueId = `${issue.machineInitials}-${String(issue.issueNumber).padStart(2, "0")}`;
    }

    const globalSubscribers = await tx.query.notificationPreferences.findMany({
      where: (prefs, { or, eq }) =>
        or(
          eq(prefs.emailWatchNewIssuesGlobal, true),
          eq(prefs.inAppWatchNewIssuesGlobal, true),
          eq(prefs.discordWatchNewIssuesGlobal, true)
        ),
    });

    addRecipients("global_watcher", ...globalSubscribers.map((p) => p.userId));

    // Owners always get new_issue (per-user prefs still gate delivery);
    // toggleMachineWatcher can remove them from machine_watchers.
    addRecipients("machine_owner", machineOwnerId);

    if (machineId) {
      const watchersList = await tx.query.machineWatchers.findMany({
        where: eq(machineWatchers.machineId, machineId),
      });

      addRecipients("machine_watcher", ...watchersList.map((w) => w.userId));

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
  } else if (
    resourceType === "issue" &&
    type !== "issue_assigned" &&
    type !== "mentioned"
  ) {
    const watchers = await tx.query.issueWatchers.findMany({
      where: eq(issueWatchers.issueId, resourceId),
    });

    addRecipients(
      "issue_watcher",
      ...watchers.map((w: IssueWatcher) => w.userId)
    );
  }

  if (includeActor && actorId) {
    addRecipients("actor", actorId);
  }
  if (actorId && !includeActor) {
    recipientIds.delete(actorId);
    recipientReasons.delete(actorId);
  }

  if (recipientIds.size === 0) return { deliveries: [] };

  // Notification links are built from initials + issue number, never from
  // `resourceId` — no route addresses a resource by id (PP-gzq2). Every current
  // caller passes what its link needs; these are the backstops, so a caller that
  // forgets degrades to a list page rather than an unusable link. Placed after
  // the empty-recipient early return so they cost nothing when nobody is being
  // notified, and guarded so they cost nothing when the caller did pass them.
  if (resourceType === "machine" && !resolvedMachineInitials) {
    const machine = await tx.query.machines.findFirst({
      where: eq(machines.id, resourceId),
      columns: { initials: true },
    });
    resolvedMachineInitials = machine?.initials;
  }
  if (resourceType === "issue" && !resolvedFormattedIssueId) {
    const issue = await tx.query.issues.findFirst({
      where: eq(issues.id, resourceId),
      columns: { machineInitials: true, issueNumber: true },
    });
    if (issue) {
      resolvedFormattedIssueId = `${issue.machineInitials}-${String(issue.issueNumber).padStart(2, "0")}`;
    }
  }

  // 2. Fetch preferences
  const preferences = await tx.query.notificationPreferences.findMany({
    where: inArray(notificationPreferences.userId, [...recipientIds]),
  });
  const prefsMap = new Map(preferences.map((p) => [p.userId, p]));

  // 3. Fetch recipient and actor profiles (avoid N+1).
  const profileIds = new Set(recipientIds);
  if (actorId) profileIds.add(actorId);
  const users = await tx
    .select({
      id: userProfiles.id,
      email: userProfiles.email,
      name: userProfiles.name,
      discordUserId: userProfiles.discordUserId,
    })
    .from(userProfiles)
    .where(inArray(userProfiles.id, [...profileIds]));
  const emailMap = new Map(users.map((u) => [u.id, u.email]));
  const nameMap = new Map(users.map((u) => [u.id, u.name]));
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
    resourceType: "issue" | "machine";
  }[] = [];

  // Email dispatch is concurrent via Promise.allSettled so one slow/failed
  // email doesn't block others (spec: "Promise.allSettled concurrent dispatch
  // preserved").
  const deferredDeliveries: (() => Promise<DeliveryResult>)[] = [];

  for (const userId of recipientIds) {
    const prefs = prefsMap.get(userId) ?? buildDefaultPrefs(userId);

    // Cross-channel pre-dispatch rule: skip own actions entirely.
    // (Spec decision: suppressOwnActions stays at the top of the recipient
    // loop — it is NOT per-channel.)
    if (actorId && userId === actorId && prefs.suppressOwnActions) {
      continue;
    }

    for (const channel of channels) {
      if (event.channelKeys && !event.channelKeys.includes(channel.key)) {
        continue;
      }
      const recipientReason = sortReasons(
        recipientReasons.get(userId) ?? new Set<RecipientReason>()
      ).find((reason) => channel.shouldDeliver(prefs, type, reason));
      if (!recipientReason) continue;

      const ctx: ChannelContext = {
        userId,
        type,
        resourceId,
        resourceType,
        email: emailMap.get(userId) ?? null,
        discordUserId: discordUserIdMap.get(userId) ?? null,
        issueTitle: resolvedIssueTitle,
        machineName: resolvedMachineName,
        machineInitials: resolvedMachineInitials,
        formattedIssueId: resolvedFormattedIssueId,
        commentContent,
        ...(event.type === "new_comment" || event.type === "mentioned"
          ? {
              commentId: event.commentId,
              attachmentCount: event.attachmentCount,
            }
          : {}),
        ...(event.type === "issue_status_changed"
          ? { oldStatus: event.oldStatus, newStatus: event.newStatus }
          : {}),
        ...(event.type === "new_issue" || event.type === "issue_assigned"
          ? { severity: event.severity }
          : {}),
        ...(event.type === "new_issue" ? { frequency: event.frequency } : {}),
        ...(event.type === "machine_ownership_changed"
          ? { ownershipChange: event.ownershipChange }
          : {}),
        actorName:
          event.actorName ?? (actorId ? nameMap.get(actorId) : undefined),
        recipientReason,
        issueDescription,
        eventId,
      };

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
        const deliver = (): Promise<DeliveryResult> => channel.deliver(ctx);
        if (channel.key === "discord" && discordCandidates) {
          discordCandidates.push({
            userId,
            type,
            order: discordCandidates.length,
            deliver,
          });
        } else {
          deferredDeliveries.push(deliver);
        }
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

export async function planNotification(
  event: NotificationEvent,
  tx: DbTransaction = db,
  preResolvedChannels?: readonly NotificationChannel[]
): Promise<DeliveryPlan> {
  return planNotificationCandidate(event, tx, preResolvedChannels);
}

/**
 * Plan all candidates caused by one product action. The candidates are planned
 * independently for email and in-app delivery, preserving their existing
 * behavior. Eligible Discord candidates are collected and reduced to one per
 * recipient only after preferences have been evaluated, so disabling a mention
 * correctly falls back to a watched-comment DM.
 */
export async function planNotifications(
  events: readonly NotificationEvent[],
  tx: DbTransaction = db,
  preResolvedChannels?: readonly NotificationChannel[]
): Promise<DeliveryPlan> {
  const deliveries: DeliveryPlan["deliveries"] = [];
  const discordCandidates: DiscordCandidate[] = [];

  for (const event of events) {
    const plan = await planNotificationCandidate(
      event,
      tx,
      preResolvedChannels,
      discordCandidates
    );
    deliveries.push(...plan.deliveries);
  }

  const selected = new Map<string, DiscordCandidate>();
  for (const candidate of discordCandidates) {
    const current = selected.get(candidate.userId);
    if (
      !current ||
      DISCORD_EVENT_PRIORITY[candidate.type] >
        DISCORD_EVENT_PRIORITY[current.type]
    ) {
      selected.set(candidate.userId, candidate);
    }
  }
  deliveries.push(
    ...[...selected.values()]
      .sort((left, right) => left.order - right.order)
      .map((candidate) => candidate.deliver)
  );
  return { deliveries };
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
    discordOnboardedAt: null,
    discordNoticeVersion: 0,
  };
}
