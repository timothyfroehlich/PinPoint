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
        commentContent: "Test comment",
      },
      db
    );

    // Verify no notification created
    const result = await db.query.notifications.findMany();
    expect(result).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("should respect main switches", async () => {
    const db = await getTestDb();

    const [actor] = await db
      .insert(userProfiles)
      .values(createTestUser())
      .returning();
    const [recipient] = await db
      .insert(userProfiles)
      .values(createTestUser())
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
      .values(createTestUser())
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
      .values(createTestUser())
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

    // Mock auth.users email
    await db.execute(
      `INSERT INTO auth.users (id, email) VALUES ('${recipient.id}', 'user2@test.com')`
    );

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

  it("should notify machine watchers on new issue", async () => {
    const db = await getTestDb();

    const [recipient] = await db
      .insert(userProfiles)
      .values(createTestUser())
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

    // Mock auth.users email
    await db.execute(
      `INSERT INTO auth.users (id, email) VALUES ('${recipient.id}', 'watcher@test.com')`
    );

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
