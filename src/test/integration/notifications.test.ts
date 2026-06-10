import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import {
  createNotification,
  planNotification,
  dispatchNotification,
  type DeliveryPlan,
} from "~/lib/notifications";
import { sendEmail } from "~/lib/email/client";
import { log } from "~/lib/logger";
import { reportError } from "~/lib/observability/report-error";
import type * as ReportErrorModule from "~/lib/observability/report-error";
import type { DeliveryResult } from "~/lib/notifications/channels/types";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import {
  userProfiles,
  notificationPreferences,
  issueWatchers,
  machines,
  issues,
  notifications,
  machineWatchers,
} from "~/server/db/schema";
import {
  createTestUser,
  createTestMachine,
  createTestIssue,
} from "~/test/helpers/factories";

// Only mock external services (Email)
vi.mock("~/lib/email/client", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("~/lib/logger", () => ({
  log: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Spy on reportError without dropping the module's other exports
// (serverActionError, ReportContext).
vi.mock("~/lib/observability/report-error", async (importOriginal) => {
  const actual = await importOriginal<typeof ReportErrorModule>();
  return { ...actual, reportError: vi.fn() };
});

describe("createNotification (Integration)", () => {
  setupTestDb();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not notify the actor", async () => {
    const db = await getTestDb();

    // Setup: Actor is also a watcher
    const [actor] = await db
      .insert(userProfiles)
      .values(createTestUser())
      .returning();
    const [machine] = await db
      .insert(machines)
      .values(createTestMachine({ initials: "MM" }))
      .returning();
    const [issue] = await db
      .insert(issues)
      .values(createTestIssue(machine.initials, { issueNumber: 1 }))
      .returning();

    await db.insert(issueWatchers).values({
      issueId: issue.id,
      userId: actor.id,
    });

    await createNotification(
      {
        type: "new_comment",
        resourceId: issue.id,
        resourceType: "issue",
        actorId: actor.id,
        includeActor: false, // Explicitly test actor exclusion
        commentContent: "Test comment",
      },
      db
    );

    // Verify no notification created
    const result = await db.query.notifications.findMany();
    expect(result).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("should notify the actor by default", async () => {
    const db = await getTestDb();

    // Setup: Actor is also a watcher
    const [actor] = await db
      .insert(userProfiles)
      .values(createTestUser())
      .returning();
    const [machine] = await db
      .insert(machines)
      .values(createTestMachine({ initials: "DEF" }))
      .returning();
    const [issue] = await db
      .insert(issues)
      .values(createTestIssue(machine.initials, { issueNumber: 1 }))
      .returning();

    await db.insert(issueWatchers).values({
      issueId: issue.id,
      userId: actor.id,
    });

    // Explicitly enable notifications for this event type
    await db.insert(notificationPreferences).values({
      userId: actor.id,
      inAppEnabled: true,
      inAppNotifyOnNewComment: true,
    });
    // Don't specify includeActor - should default to true
    await createNotification(
      {
        type: "new_comment",
        resourceId: issue.id,
        resourceType: "issue",
        actorId: actor.id,
        commentContent: "Test comment",
      },
      db
    );

    // Verify actor receives notification (new default behavior)
    const result = await db.query.notifications.findMany({
      where: eq(notifications.userId, actor.id),
    });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("new_comment");
  });

  it("should respect main switches", async () => {
    const db = await getTestDb();

    const [actor] = await db
      .insert(userProfiles)
      .values(createTestUser())
      .returning();
    const [recipient] = await db
      .insert(userProfiles)
      .values(createTestUser({ email: "user2@test.com" }))
      .returning();
    const [machine] = await db
      .insert(machines)
      .values(createTestMachine({ initials: "AFM" }))
      .returning();
    const [issue] = await db
      .insert(issues)
      .values(createTestIssue(machine.initials, { issueNumber: 1 }))
      .returning();

    // Recipient watching issue
    await db.insert(issueWatchers).values({
      issueId: issue.id,
      userId: recipient.id,
    });

    // Main switches OFF
    await db
      .insert(notificationPreferences)
      .values({
        userId: recipient.id,
        emailEnabled: false,
        inAppEnabled: false,
        emailNotifyOnNewComment: true,
        inAppNotifyOnNewComment: true,
      })
      .onConflictDoUpdate({
        target: notificationPreferences.userId,
        set: {
          emailEnabled: false,
          inAppEnabled: false,
        },
      });

    await createNotification(
      {
        type: "new_comment",
        resourceId: issue.id,
        resourceType: "issue",
        actorId: actor.id,
        includeActor: false, // Exclude actor to test recipient preferences
        commentContent: "Test comment",
      },
      db
    );

    const result = await db.query.notifications.findMany();
    expect(result).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("should respect granular event toggles", async () => {
    const db = await getTestDb();

    const [actor] = await db
      .insert(userProfiles)
      .values(createTestUser())
      .returning();
    const [recipient] = await db
      .insert(userProfiles)
      .values(createTestUser({ email: "watcher@test.com" }))
      .returning();
    const [machine] = await db
      .insert(machines)
      .values(createTestMachine({ initials: "TZ" }))
      .returning();
    const [issue] = await db
      .insert(issues)
      .values(createTestIssue(machine.initials, { issueNumber: 1 }))
      .returning();

    await db.insert(issueWatchers).values({
      issueId: issue.id,
      userId: recipient.id,
    });

    // Granular OFF
    await db
      .insert(notificationPreferences)
      .values({
        userId: recipient.id,
        emailEnabled: true,
        inAppEnabled: true,
        emailNotifyOnNewComment: false,
        inAppNotifyOnNewComment: false,
      })
      .onConflictDoUpdate({
        target: notificationPreferences.userId,
        set: {
          emailNotifyOnNewComment: false,
          inAppNotifyOnNewComment: false,
        },
      });

    await createNotification(
      {
        type: "new_comment",
        resourceId: issue.id,
        resourceType: "issue",
        actorId: actor.id,
        includeActor: false, // Exclude actor to test recipient granular toggles
        commentContent: "Test comment",
      },
      db
    );

    const result = await db.query.notifications.findMany();
    expect(result).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("should send notifications when enabled", async () => {
    const db = await getTestDb();

    const [actor] = await db
      .insert(userProfiles)
      .values(createTestUser())
      .returning();
    const [recipient] = await db
      .insert(userProfiles)
      .values(createTestUser({ email: "user2@test.com" }))
      .returning();
    const [machine] = await db
      .insert(machines)
      .values(createTestMachine({ initials: "NGG" }))
      .returning();
    const [issue] = await db
      .insert(issues)
      .values(createTestIssue(machine.initials, { issueNumber: 1 }))
      .returning();

    await db.insert(issueWatchers).values({
      issueId: issue.id,
      userId: recipient.id,
    });

    // All ON (default, but explicit for clarity)
    await db
      .insert(notificationPreferences)
      .values({
        userId: recipient.id,
        emailEnabled: true,
        inAppEnabled: true,
        emailNotifyOnNewComment: true,
        inAppNotifyOnNewComment: true,
      })
      .onConflictDoUpdate({
        target: notificationPreferences.userId,
        set: {
          emailEnabled: true,
          inAppEnabled: true,
        },
      });

    await createNotification(
      {
        type: "new_comment",
        resourceId: issue.id,
        resourceType: "issue",
        actorId: actor.id,
        commentContent: "Test comment",
      },
      db
    );

    // Verify in-app insert
    const notificationsList = await db.query.notifications.findMany({
      where: eq(notifications.userId, recipient.id),
    });
    expect(notificationsList).toHaveLength(1);
    expect(notificationsList[0].type).toBe("new_comment");

    // Verify email sent
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user2@test.com",
      })
    );
  });

  it("issue_assigned should only notify the assignee, not all watchers", async () => {
    const db = await getTestDb();

    const [actor] = await db
      .insert(userProfiles)
      .values(createTestUser())
      .returning();
    const [assignee] = await db
      .insert(userProfiles)
      .values(createTestUser({ email: "assignee@test.com" }))
      .returning();
    const [watcher] = await db
      .insert(userProfiles)
      .values(createTestUser({ email: "watcher@test.com" }))
      .returning();
    const [machine] = await db
      .insert(machines)
      .values(createTestMachine({ initials: "ASN" }))
      .returning();
    const [issue] = await db
      .insert(issues)
      .values(createTestIssue(machine.initials, { issueNumber: 1 }))
      .returning();

    // Both assignee and watcher are watching this issue
    await db.insert(issueWatchers).values([
      { issueId: issue.id, userId: assignee.id },
      { issueId: issue.id, userId: watcher.id },
    ]);

    await createNotification(
      {
        type: "issue_assigned",
        resourceId: issue.id,
        resourceType: "issue",
        actorId: actor.id,
        includeActor: false,
        additionalRecipientIds: [assignee.id],
        issueTitle: "Test Issue",
        machineName: machine.name,
      },
      db
    );

    // Only the assignee should be notified, not the watcher
    const allNotifications = await db.query.notifications.findMany();
    expect(allNotifications).toHaveLength(1);
    expect(allNotifications[0].userId).toBe(assignee.id);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "assignee@test.com" })
    );
  });

  it("self-assignment should not send any email (actor excluded)", async () => {
    const db = await getTestDb();

    const [actor] = await db
      .insert(userProfiles)
      .values(createTestUser())
      .returning();
    const [machine] = await db
      .insert(machines)
      .values(createTestMachine({ initials: "SLF" }))
      .returning();
    const [issue] = await db
      .insert(issues)
      .values(createTestIssue(machine.initials, { issueNumber: 1 }))
      .returning();

    // Actor watches the issue
    await db.insert(issueWatchers).values({
      issueId: issue.id,
      userId: actor.id,
    });

    // Self-assignment: actor assigns to themselves
    await createNotification(
      {
        type: "issue_assigned",
        resourceId: issue.id,
        resourceType: "issue",
        actorId: actor.id,
        includeActor: false,
        additionalRecipientIds: [actor.id],
        issueTitle: "Test Issue",
        machineName: machine.name,
      },
      db
    );

    // No notifications — actor is the only recipient and is excluded
    const allNotifications = await db.query.notifications.findMany();
    expect(allNotifications).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("should skip actor when suppressOwnActions is enabled", async () => {
    const db = await getTestDb();

    const [actor] = await db
      .insert(userProfiles)
      .values(createTestUser())
      .returning();
    const [machine] = await db
      .insert(machines)
      .values(createTestMachine({ initials: "SUP" }))
      .returning();
    const [issue] = await db
      .insert(issues)
      .values(createTestIssue(machine.initials, { issueNumber: 1 }))
      .returning();

    // Actor watches the issue
    await db.insert(issueWatchers).values({
      issueId: issue.id,
      userId: actor.id,
    });

    // Set suppressOwnActions = true
    await db.insert(notificationPreferences).values({
      userId: actor.id,
      emailEnabled: true,
      inAppEnabled: true,
      suppressOwnActions: true,
      emailNotifyOnNewComment: true,
      inAppNotifyOnNewComment: true,
    });

    // Actor comments on issue they're watching — with includeActor: true (default)
    await createNotification(
      {
        type: "new_comment",
        resourceId: issue.id,
        resourceType: "issue",
        actorId: actor.id,
        includeActor: true,
        commentContent: "Test comment",
      },
      db
    );

    // No notifications should be created — actor is suppressed
    const result = await db.query.notifications.findMany();
    expect(result).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("should NOT skip actor when suppressOwnActions is disabled", async () => {
    const db = await getTestDb();

    const [actor] = await db
      .insert(userProfiles)
      .values(createTestUser())
      .returning();
    const [machine] = await db
      .insert(machines)
      .values(createTestMachine({ initials: "NOSUP" }))
      .returning();
    const [issue] = await db
      .insert(issues)
      .values(createTestIssue(machine.initials, { issueNumber: 1 }))
      .returning();

    await db.insert(issueWatchers).values({
      issueId: issue.id,
      userId: actor.id,
    });

    // suppressOwnActions = false (default)
    await db.insert(notificationPreferences).values({
      userId: actor.id,
      emailEnabled: true,
      inAppEnabled: true,
      suppressOwnActions: false,
      emailNotifyOnNewComment: true,
      inAppNotifyOnNewComment: true,
    });

    await createNotification(
      {
        type: "new_comment",
        resourceId: issue.id,
        resourceType: "issue",
        actorId: actor.id,
        includeActor: true,
        commentContent: "Test comment",
      },
      db
    );

    // Actor should receive notification since suppressOwnActions is false
    const result = await db.query.notifications.findMany({
      where: eq(notifications.userId, actor.id),
    });
    expect(result).toHaveLength(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("should notify machine watchers on new issue", async () => {
    const db = await getTestDb();

    const [recipient] = await db
      .insert(userProfiles)
      .values(createTestUser({ email: "watcher@test.com" }))
      .returning();
    const [machine] = await db
      .insert(machines)
      .values(createTestMachine({ initials: "WATCH" }))
      .returning();

    // Add as watcher
    await db.insert(machineWatchers).values({
      machineId: machine.id,
      userId: recipient.id,
      watchMode: "notify",
    });

    // Explicitly enable notifications for new issue events
    await db.insert(notificationPreferences).values({
      userId: recipient.id,
      emailEnabled: true,
      inAppEnabled: true,
      emailNotifyOnNewIssue: true,
      inAppNotifyOnNewIssue: true,
    });
    const [issue] = await db
      .insert(issues)
      .values(createTestIssue(machine.initials, { issueNumber: 1 }))
      .returning();

    await createNotification(
      {
        type: "new_issue",
        resourceId: issue.id,
        resourceType: "issue",
        issueTitle: "New Machine Issue",
        machineName: machine.name,
      },
      db
    );

    // Verify in-app insert
    const notificationsList = await db.query.notifications.findMany({
      where: eq(notifications.userId, recipient.id),
    });
    expect(notificationsList).toHaveLength(1);
    expect(notificationsList[0].type).toBe("new_issue");

    // Verify email sent, with the formatted issue id (WATCH-01) derived inside
    // planNotification from the issue row — pins the single-query derivation
    // (PP-2053.2 review: the redundant second issues query was removed).
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "watcher@test.com",
        subject: expect.stringContaining("WATCH-01"),
      })
    );
  });

  it("should notify machine owner on new issue even if not in machine_watchers", async () => {
    const db = await getTestDb();

    const [owner] = await db
      .insert(userProfiles)
      .values(createTestUser({ email: "owner@test.com" }))
      .returning();
    const [machine] = await db
      .insert(machines)
      .values(createTestMachine({ initials: "OWNB", ownerId: owner.id }))
      .returning();

    await db.insert(notificationPreferences).values({
      userId: owner.id,
      emailEnabled: true,
      inAppEnabled: true,
      emailNotifyOnNewIssue: true,
      inAppNotifyOnNewIssue: true,
    });

    const [issue] = await db
      .insert(issues)
      .values(createTestIssue(machine.initials, { issueNumber: 1 }))
      .returning();

    await createNotification(
      {
        type: "new_issue",
        resourceId: issue.id,
        resourceType: "issue",
        issueTitle: issue.title,
        machineName: machine.name,
      },
      db
    );

    const notificationsList = await db.query.notifications.findMany({
      where: eq(notifications.userId, owner.id),
    });
    expect(notificationsList).toHaveLength(1);
    expect(notificationsList[0].type).toBe("new_issue");

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "owner@test.com" })
    );
  });

  it("should always notify for machine_ownership_changed even with granular toggles off", async () => {
    const db = await getTestDb();

    const [actor] = await db
      .insert(userProfiles)
      .values(createTestUser())
      .returning();
    const [recipient] = await db
      .insert(userProfiles)
      .values(createTestUser({ email: "new-owner@test.com" }))
      .returning();
    const [machine] = await db
      .insert(machines)
      .values(createTestMachine({ initials: "OWN" }))
      .returning();

    // Granular ownership toggle OFF, but main switches ON
    await db.insert(notificationPreferences).values({
      userId: recipient.id,
      emailEnabled: true,
      inAppEnabled: true,
    });

    await createNotification(
      {
        type: "machine_ownership_changed",
        resourceId: machine.id,
        resourceType: "machine",
        actorId: actor.id,
        machineName: machine.name,
        newStatus: "added",
        additionalRecipientIds: [recipient.id],
      },
      db
    );

    // Should still notify because ownership changes bypass granular toggles
    const result = await db.query.notifications.findMany({
      where: eq(notifications.userId, recipient.id),
    });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("machine_ownership_changed");

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "new-owner@test.com",
        subject: expect.stringContaining("Ownership Update"),
      })
    );
  });

  it("machine_ownership_changed with includeActor: false should not notify the admin who made the change", async () => {
    const db = await getTestDb();

    const [admin] = await db
      .insert(userProfiles)
      .values(createTestUser({ email: "admin-owner@test.com" }))
      .returning();
    const [newOwner] = await db
      .insert(userProfiles)
      .values(createTestUser({ email: "new-owner-excl@test.com" }))
      .returning();
    const [machine] = await db
      .insert(machines)
      .values(createTestMachine({ initials: "EX" }))
      .returning();

    await db.insert(notificationPreferences).values({
      userId: admin.id,
      emailEnabled: true,
      inAppEnabled: true,
    });
    await db.insert(notificationPreferences).values({
      userId: newOwner.id,
      emailEnabled: true,
      inAppEnabled: true,
    });

    await createNotification(
      {
        type: "machine_ownership_changed",
        resourceId: machine.id,
        resourceType: "machine",
        actorId: admin.id,
        includeActor: false,
        machineName: machine.name,
        newStatus: "added",
        additionalRecipientIds: [newOwner.id],
      },
      db
    );

    // Only the new owner should be notified, not the admin
    const result = await db.query.notifications.findMany();
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe(newOwner.id);
  });

  // PP-cfs: "mentioned" is excluded from the watcher fan-out and delivered
  // only via additionalRecipientIds. These tests are the integration-layer
  // replacement for the notification-bell check that was removed from
  // e2e/full/rich-text.spec.ts to fix a cross-session timing flake.
  describe("mentioned", () => {
    it("delivers in-app notification to mentioned users, excluding the actor", async () => {
      const db = await getTestDb();

      const [actor] = await db
        .insert(userProfiles)
        .values(createTestUser({ email: "mention-actor@test.com" }))
        .returning();
      const [mentioned] = await db
        .insert(userProfiles)
        .values(createTestUser({ email: "mention-recipient@test.com" }))
        .returning();
      const [machine] = await db
        .insert(machines)
        .values(createTestMachine({ initials: "MN" }))
        .returning();
      const [issue] = await db
        .insert(issues)
        .values(createTestIssue(machine.initials, { issueNumber: 1 }))
        .returning();

      // Include the actor in additionalRecipientIds so that includeActor: false
      // is exercised — without this, the actor was never a candidate and the
      // exclusion branch was effectively untested.
      await createNotification(
        {
          type: "mentioned",
          resourceId: issue.id,
          resourceType: "issue",
          actorId: actor.id,
          includeActor: false,
          additionalRecipientIds: [actor.id, mentioned.id],
          issueTitle: "Test issue",
          machineName: machine.name,
          formattedIssueId: "MN-01",
        },
        db
      );

      const result = await db.query.notifications.findMany();
      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(mentioned.id);
      expect(result[0].userId).not.toBe(actor.id);
      expect(result[0].type).toBe("mentioned");
      expect(result[0].resourceId).toBe(issue.id);
    });

    it("skips in-app delivery when inAppNotifyOnMentioned is false but still sends email", async () => {
      const db = await getTestDb();

      const [actor] = await db
        .insert(userProfiles)
        .values(createTestUser({ email: "mention-actor2@test.com" }))
        .returning();
      const [mentioned] = await db
        .insert(userProfiles)
        .values(createTestUser({ email: "mention-pref@test.com" }))
        .returning();
      const [machine] = await db
        .insert(machines)
        .values(createTestMachine({ initials: "MP" }))
        .returning();
      const [issue] = await db
        .insert(issues)
        .values(createTestIssue(machine.initials, { issueNumber: 1 }))
        .returning();

      await db.insert(notificationPreferences).values({
        userId: mentioned.id,
        inAppEnabled: true,
        inAppNotifyOnMentioned: false,
        emailEnabled: true,
        emailNotifyOnMentioned: true,
      });

      await createNotification(
        {
          type: "mentioned",
          resourceId: issue.id,
          resourceType: "issue",
          actorId: actor.id,
          includeActor: false,
          additionalRecipientIds: [mentioned.id],
          issueTitle: "Test issue",
          machineName: machine.name,
          formattedIssueId: "MP-01",
        },
        db
      );

      const inApp = await db.query.notifications.findMany();
      expect(inApp).toHaveLength(0);
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: "mention-pref@test.com" })
      );
    });
  });

  // PP-2053.2: the Doodle Bug regression guard. The original failure was that
  // the confirmation email fired from *inside* the issue-creation transaction,
  // so a recipient could be emailed about an issue whose INSERT later rolled
  // back (or whose function was SIGKILLed mid-commit). The fix splits the work:
  // planNotification does only transactional DB writes (in-app rows) and
  // returns the external sends UNRUN; dispatchNotification runs them later,
  // after the caller's transaction has committed. These tests pin that the
  // external side effect cannot escape planning.
  describe("two-phase separation (planNotification / dispatchNotification)", () => {
    it("planNotification writes the in-app row but does NOT send email until dispatch", async () => {
      const db = await getTestDb();

      const [actor] = await db
        .insert(userProfiles)
        .values(createTestUser())
        .returning();
      const [recipient] = await db
        .insert(userProfiles)
        .values(createTestUser({ email: "two-phase@test.com" }))
        .returning();
      const [machine] = await db
        .insert(machines)
        .values(createTestMachine({ initials: "TWO" }))
        .returning();
      const [issue] = await db
        .insert(issues)
        .values(createTestIssue(machine.initials, { issueNumber: 1 }))
        .returning();

      await db.insert(issueWatchers).values({
        issueId: issue.id,
        userId: recipient.id,
      });
      await db.insert(notificationPreferences).values({
        userId: recipient.id,
        emailEnabled: true,
        inAppEnabled: true,
        emailNotifyOnNewComment: true,
        inAppNotifyOnNewComment: true,
      });

      const plan = await planNotification(
        {
          type: "new_comment",
          resourceId: issue.id,
          resourceType: "issue",
          actorId: actor.id,
          includeActor: false,
          commentContent: "Test comment",
        },
        db
      );

      // The transactional write happened during planning...
      const afterPlan = await db.query.notifications.findMany({
        where: eq(notifications.userId, recipient.id),
      });
      expect(afterPlan).toHaveLength(1);
      // ...but the external email is still pending, captured as an unrun thunk.
      expect(sendEmail).not.toHaveBeenCalled();
      expect(plan.deliveries.length).toBeGreaterThan(0);

      // Only the explicit post-commit dispatch sends it.
      await dispatchNotification(plan);
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: "two-phase@test.com" })
      );
    });

    it("a plan that is never dispatched sends no email (the rolled-back-commit case)", async () => {
      const db = await getTestDb();

      const [actor] = await db
        .insert(userProfiles)
        .values(createTestUser())
        .returning();
      const [recipient] = await db
        .insert(userProfiles)
        .values(createTestUser({ email: "never-dispatch@test.com" }))
        .returning();
      const [machine] = await db
        .insert(machines)
        .values(createTestMachine({ initials: "NVR" }))
        .returning();
      const [issue] = await db
        .insert(issues)
        .values(createTestIssue(machine.initials, { issueNumber: 1 }))
        .returning();

      await db.insert(issueWatchers).values({
        issueId: issue.id,
        userId: recipient.id,
      });
      await db.insert(notificationPreferences).values({
        userId: recipient.id,
        emailEnabled: true,
        inAppEnabled: true,
        emailNotifyOnNewComment: true,
        inAppNotifyOnNewComment: true,
      });

      // Plan, then deliberately drop the plan — emulating a caller whose
      // transaction rolled back, so it never reaches dispatchNotification.
      await planNotification(
        {
          type: "new_comment",
          resourceId: issue.id,
          resourceType: "issue",
          actorId: actor.id,
          includeActor: false,
          commentContent: "Test comment",
        },
        db
      );

      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("dispatchNotification on an empty plan is a no-op", async () => {
      await dispatchNotification({ deliveries: [] });
      expect(sendEmail).not.toHaveBeenCalled();
    });
  });

  // PP-2053.2 review: the dispatcher must never let a failed external send
  // surface as a primary-action error (the issue is already saved), and a
  // fulfilled-but-failed send must still be observable — it was silently
  // dropped before, the exact gap this epic exists to close. These exercise
  // dispatchNotification directly with hand-built delivery thunks (no DB).
  describe("dispatchNotification failure handling", () => {
    it("swallows a rejecting delivery, reports it, and still runs siblings", async () => {
      const sibling = vi.fn(
        (): Promise<DeliveryResult> => Promise.resolve({ ok: true })
      );
      const plan: DeliveryPlan = {
        deliveries: [() => Promise.reject(new Error("boom")), sibling],
      };

      // Must not throw — a failed send cannot fail the already-committed action.
      await expect(dispatchNotification(plan)).resolves.toBeUndefined();
      // A rejection is treated as a bug and reported...
      expect(reportError).toHaveBeenCalledTimes(1);
      // ...and the sibling delivery still ran despite the earlier rejection.
      expect(sibling).toHaveBeenCalledTimes(1);
    });

    it("logs fulfilled permanent/transient failures but stays quiet on skipped/ok", async () => {
      const plan: DeliveryPlan = {
        deliveries: [
          (): Promise<DeliveryResult> =>
            Promise.resolve({ ok: false, reason: "permanent" }),
          (): Promise<DeliveryResult> =>
            Promise.resolve({ ok: false, reason: "transient" }),
          (): Promise<DeliveryResult> =>
            Promise.resolve({ ok: false, reason: "skipped" }),
          (): Promise<DeliveryResult> => Promise.resolve({ ok: true }),
        ],
      };

      await dispatchNotification(plan);

      // permanent + transient are real failures worth surfacing; skipped
      // (no Discord id / not configured) and ok are expected, so stay silent.
      expect(log.warn).toHaveBeenCalledTimes(2);
      // A returned {ok:false} is an expected outcome, not a thrown bug.
      expect(reportError).not.toHaveBeenCalled();
    });
  });
});
