import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { dispatchNotification, planNotifications } from "~/lib/notifications";
import type {
  ChannelContext,
  DeliveryChannel,
  NotificationPreferencesRow,
} from "~/lib/notifications/channels/types";
import type {
  NotificationType,
  RecipientReason,
} from "~/lib/notifications/events";
import {
  issueWatchers,
  issues,
  machineWatchers,
  machines,
  notificationPreferences,
  userProfiles,
} from "~/server/db/schema";
import {
  createTestIssue,
  createTestMachine,
  createTestUser,
} from "~/test/helpers/factories";
import { asDbOrTx, getTestDb, setupTestDb } from "~/test/setup/pglite";

function discordPreferenceEnabled(
  prefs: NotificationPreferencesRow,
  type: NotificationType,
  reason?: RecipientReason
): boolean {
  if (!prefs.discordEnabled) return false;
  switch (type) {
    case "issue_assigned":
      return prefs.discordNotifyOnAssigned;
    case "mentioned":
      return prefs.discordNotifyOnMentioned;
    case "new_comment":
      return prefs.discordNotifyOnNewComment;
    case "new_issue":
      return reason === "global_watcher"
        ? prefs.discordWatchNewIssuesGlobal
        : prefs.discordNotifyOnNewIssue;
    case "issue_status_changed":
      return prefs.discordNotifyOnStatusChange;
    case "machine_ownership_changed":
      return true;
  }
}

describe("Discord product-action batching", () => {
  setupTestDb();
  const discordDeliver = vi.fn((_ctx: ChannelContext) =>
    Promise.resolve({ ok: true as const })
  );
  const emailDeliver = vi.fn((_ctx: ChannelContext) =>
    Promise.resolve({ ok: true as const })
  );
  const discordChannel: DeliveryChannel = {
    key: "discord",
    shouldDeliver: discordPreferenceEnabled,
    deliver: discordDeliver,
  };
  const emailChannel: DeliveryChannel = {
    key: "email",
    shouldDeliver: () => true,
    deliver: emailDeliver,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prefers a mention DM while preserving both email candidates", async () => {
    const db = await getTestDb();
    const [actor] = await db
      .insert(userProfiles)
      .values(createTestUser())
      .returning();
    const [recipient] = await db
      .insert(userProfiles)
      .values(
        createTestUser({
          email: "mentioned@example.com",
          discordUserId: "discord-mentioned",
        })
      )
      .returning();
    const [machine] = await db
      .insert(machines)
      .values(createTestMachine({ initials: "BAT" }))
      .returning();
    const [issue] = await db
      .insert(issues)
      .values(createTestIssue(machine.initials))
      .returning();
    await db.insert(issueWatchers).values({
      issueId: issue.id,
      userId: recipient.id,
    });
    await db.insert(notificationPreferences).values({
      userId: recipient.id,
      discordNotifyOnNewComment: true,
      discordNotifyOnMentioned: true,
    });

    const shared = {
      resourceId: issue.id,
      resourceType: "issue" as const,
      actorId: actor.id,
      issueTitle: issue.title,
      machineName: machine.name,
      formattedIssueId: "BAT-01",
      commentContent: "Please take a look",
      commentId: "comment-1",
      attachmentCount: 0,
      eventId: "comment-1",
    };
    const plan = await planNotifications(
      [
        { ...shared, type: "new_comment" },
        {
          ...shared,
          type: "mentioned",
          includeActor: false,
          additionalRecipientIds: [recipient.id],
        },
      ],
      asDbOrTx(db),
      [emailChannel, discordChannel]
    );
    await dispatchNotification(plan);

    expect(discordDeliver).toHaveBeenCalledTimes(1);
    expect(discordDeliver.mock.calls[0]?.[0].type).toBe("mentioned");
    // Email behavior is intentionally unchanged: the watcher receives comment
    // and mention emails, and the actor receives their comment email because
    // this fixture has the existing suppress-own-actions default (off).
    expect(emailDeliver).toHaveBeenCalledTimes(3);
  });

  it("falls back to the watched-comment DM when mentions are disabled", async () => {
    const db = await getTestDb();
    const [actor] = await db
      .insert(userProfiles)
      .values(createTestUser())
      .returning();
    const [recipient] = await db
      .insert(userProfiles)
      .values(
        createTestUser({
          email: "fallback@example.com",
          discordUserId: "discord-fallback",
        })
      )
      .returning();
    const [machine] = await db
      .insert(machines)
      .values(createTestMachine({ initials: "FBK" }))
      .returning();
    const [issue] = await db
      .insert(issues)
      .values(createTestIssue(machine.initials))
      .returning();
    await db.insert(issueWatchers).values({
      issueId: issue.id,
      userId: recipient.id,
    });
    await db.insert(notificationPreferences).values({
      userId: recipient.id,
      discordNotifyOnNewComment: true,
      discordNotifyOnMentioned: false,
    });

    const shared = {
      resourceId: issue.id,
      resourceType: "issue" as const,
      actorId: actor.id,
      commentContent: "Fallback please",
      commentId: "comment-2",
      attachmentCount: 0,
      eventId: "comment-2",
    };
    const plan = await planNotifications(
      [
        { ...shared, type: "new_comment" },
        {
          ...shared,
          type: "mentioned",
          includeActor: false,
          additionalRecipientIds: [recipient.id],
        },
      ],
      asDbOrTx(db),
      [discordChannel]
    );
    await dispatchNotification(plan);

    expect(discordDeliver).toHaveBeenCalledTimes(1);
    expect(discordDeliver.mock.calls[0]?.[0].type).toBe("new_comment");
  });

  it("prefers initial assignment over a new-issue DM", async () => {
    const db = await getTestDb();
    const [recipient] = await db
      .insert(userProfiles)
      .values(
        createTestUser({
          email: "assigned@example.com",
          discordUserId: "discord-assigned",
        })
      )
      .returning();
    const [machine] = await db
      .insert(machines)
      .values(createTestMachine({ initials: "ASN", ownerId: recipient.id }))
      .returning();
    const [issue] = await db
      .insert(issues)
      .values(createTestIssue(machine.initials, { assignedTo: recipient.id }))
      .returning();
    await db.insert(notificationPreferences).values({ userId: recipient.id });

    const plan = await planNotifications(
      [
        {
          type: "new_issue",
          resourceId: issue.id,
          eventId: issue.id,
          resourceType: "issue",
        },
        {
          type: "issue_assigned",
          resourceId: issue.id,
          eventId: issue.id,
          resourceType: "issue",
          includeActor: false,
          additionalRecipientIds: [recipient.id],
          channelKeys: ["discord"],
        },
      ],
      asDbOrTx(db),
      [discordChannel]
    );
    await dispatchNotification(plan);

    expect(discordDeliver).toHaveBeenCalledTimes(1);
    expect(discordDeliver.mock.calls[0]?.[0].type).toBe("issue_assigned");
    const prefs = await db.query.notificationPreferences.findFirst({
      where: eq(notificationPreferences.userId, recipient.id),
    });
    expect(prefs?.discordNotifyOnAssigned).toBe(true);
  });

  it("falls back to the new-issue DM when assignment DMs are disabled", async () => {
    const db = await getTestDb();
    const [recipient] = await db
      .insert(userProfiles)
      .values(
        createTestUser({
          email: "assignment-fallback@example.com",
          discordUserId: "discord-assignment-fallback",
        })
      )
      .returning();
    const [machine] = await db
      .insert(machines)
      .values(createTestMachine({ initials: "AFB", ownerId: recipient.id }))
      .returning();
    const [issue] = await db
      .insert(issues)
      .values(createTestIssue(machine.initials, { assignedTo: recipient.id }))
      .returning();
    await db.insert(notificationPreferences).values({
      userId: recipient.id,
      discordNotifyOnAssigned: false,
      discordNotifyOnNewIssue: true,
    });

    const plan = await planNotifications(
      [
        {
          type: "new_issue",
          resourceId: issue.id,
          eventId: issue.id,
          resourceType: "issue",
        },
        {
          type: "issue_assigned",
          resourceId: issue.id,
          eventId: issue.id,
          resourceType: "issue",
          includeActor: false,
          additionalRecipientIds: [recipient.id],
          channelKeys: ["discord"],
        },
      ],
      asDbOrTx(db),
      [discordChannel]
    );
    await dispatchNotification(plan);

    expect(discordDeliver).toHaveBeenCalledOnce();
    expect(discordDeliver.mock.calls[0]?.[0].type).toBe("new_issue");
  });

  it("records owner, watcher, and global provenance independently", async () => {
    const db = await getTestDb();
    const [owner, watcher, globalWatcher] = await db
      .insert(userProfiles)
      .values([
        createTestUser({
          email: "owner-provenance@example.com",
          discordUserId: "discord-owner-provenance",
        }),
        createTestUser({
          email: "watcher-provenance@example.com",
          discordUserId: "discord-watcher-provenance",
        }),
        createTestUser({
          email: "global-provenance@example.com",
          discordUserId: "discord-global-provenance",
        }),
      ])
      .returning();
    const [machine] = await db
      .insert(machines)
      .values(createTestMachine({ initials: "PRV", ownerId: owner.id }))
      .returning();
    const [issue] = await db
      .insert(issues)
      .values(createTestIssue(machine.initials))
      .returning();
    await db.insert(machineWatchers).values({
      machineId: machine.id,
      userId: watcher.id,
      watchMode: "notify",
    });
    await db.insert(notificationPreferences).values([
      {
        userId: owner.id,
        discordNotifyOnNewIssue: true,
        discordWatchNewIssuesGlobal: false,
      },
      {
        userId: watcher.id,
        discordNotifyOnNewIssue: true,
        discordWatchNewIssuesGlobal: false,
      },
      {
        userId: globalWatcher.id,
        discordNotifyOnNewIssue: false,
        discordWatchNewIssuesGlobal: true,
      },
    ]);

    const plan = await planNotifications(
      [
        {
          type: "new_issue",
          resourceId: issue.id,
          resourceType: "issue",
          eventId: issue.id,
        },
      ],
      asDbOrTx(db),
      [discordChannel]
    );
    await dispatchNotification(plan);

    const reasons = new Map(
      discordDeliver.mock.calls.map(([ctx]) => [
        ctx.userId,
        ctx.recipientReason,
      ])
    );
    expect(reasons).toEqual(
      new Map([
        [owner.id, "machine_owner"],
        [watcher.id, "machine_watcher"],
        [globalWatcher.id, "global_watcher"],
      ])
    );
  });

  it("suppresses every candidate caused by the recipient's own action", async () => {
    const db = await getTestDb();
    const [actor] = await db
      .insert(userProfiles)
      .values(
        createTestUser({
          email: "own-action@example.com",
          discordUserId: "discord-own-action",
        })
      )
      .returning();
    const [machine] = await db
      .insert(machines)
      .values(createTestMachine({ initials: "OWN" }))
      .returning();
    const [issue] = await db
      .insert(issues)
      .values(createTestIssue(machine.initials))
      .returning();
    await db
      .insert(issueWatchers)
      .values({ issueId: issue.id, userId: actor.id });
    await db.insert(notificationPreferences).values({
      userId: actor.id,
      suppressOwnActions: true,
      discordNotifyOnNewComment: true,
      discordNotifyOnMentioned: true,
    });

    const shared = {
      resourceId: issue.id,
      eventId: issue.id,
      resourceType: "issue" as const,
      actorId: actor.id,
      commentContent: "I mentioned myself",
      commentId: "comment-own",
      attachmentCount: 0,
    };
    const plan = await planNotifications(
      [
        { ...shared, type: "new_comment" },
        {
          ...shared,
          type: "mentioned",
          additionalRecipientIds: [actor.id],
        },
      ],
      asDbOrTx(db),
      [discordChannel]
    );
    await dispatchNotification(plan);

    expect(discordDeliver).not.toHaveBeenCalled();
  });
});
