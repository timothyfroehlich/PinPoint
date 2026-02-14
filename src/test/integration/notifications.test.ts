import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { createNotification } from "~/lib/notifications";
import { sendEmail } from "~/lib/email/client";
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
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

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

    // Verify email sent
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "watcher@test.com",
      })
    );
  });
});
