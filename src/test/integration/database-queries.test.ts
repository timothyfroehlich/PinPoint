/**
 * Integration Test: Database Queries with PGlite
 *
 * Demonstrates how to write integration tests using worker-scoped PGlite.
 * These tests verify database operations without requiring a real Supabase instance.
 */

import { randomUUID } from "node:crypto";
import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import {
  machines,
  issues,
  userProfiles,
  notifications,
  notificationPreferences,
  issueWatchers,
} from "~/server/db/schema";
import {
  createTestMachine,
  createTestIssue,
  createTestUser,
} from "~/test/helpers/factories";
import { createNotification } from "~/lib/notifications";

describe("Database Queries (PGlite)", () => {
  // Set up worker-scoped PGlite and auto-cleanup after each test
  setupTestDb();

  describe("Machines", () => {
    it("should insert and query a machine", async () => {
      const db = await getTestDb();
      const testMachine = createTestMachine({ name: "Attack from Mars" });

      // Insert
      await db.insert(machines).values(testMachine);

      // Query
      const result = await db.select().from(machines);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Attack from Mars");
    });

    it("should find machine by id", async () => {
      const db = await getTestDb();
      const machineId = randomUUID();
      const testMachine = createTestMachine({
        id: machineId,
        name: "Medieval Madness",
      });

      await db.insert(machines).values(testMachine);

      const result = await db.query.machines.findFirst({
        where: eq(machines.id, machineId),
      });

      expect(result).toBeDefined();

      expect(result?.name).toBe("Medieval Madness");
    });
  });

  describe("Issues", () => {
    it("should insert issue with machine reference", async () => {
      const db = await getTestDb();

      // Create machine first
      const testMachine = createTestMachine({ name: "Twilight Zone" });
      const [machine] = await db
        .insert(machines)
        .values(testMachine)
        .returning();

      // Create issue for that machine
      const testIssue = createTestIssue(machine.id, {
        title: "Broken flipper",
        severity: "unplayable",
      });
      await db.insert(issues).values(testIssue);

      // Query with relation

      const result = await db.query.issues.findFirst({
        where: eq(issues.machineId, machine.id),
        with: {
          machine: true,
        },
      });

      expect(result).toBeDefined();

      expect(result?.title).toBe("Broken flipper");

      expect(result?.severity).toBe("unplayable");

      expect(result?.machine.name).toBe("Twilight Zone");
    });

    it("should enforce machine_id NOT NULL constraint", async () => {
      const db = await getTestDb();

      // Attempt to insert issue without machineId (should fail)
      await expect(
        db.insert(issues).values({
          // @ts-expect-error - Testing constraint violation
          machineId: null,
          title: "Test",
          status: "new",
          severity: "minor",
        })
      ).rejects.toThrow();
    });

    it("should cascade delete issues when machine is deleted", async () => {
      const db = await getTestDb();

      // Create machine with issue
      const testMachine = createTestMachine();
      const [machine] = await db
        .insert(machines)
        .values(testMachine)
        .returning();

      const testIssue = createTestIssue(machine.id);
      await db.insert(issues).values(testIssue);

      // Verify issue exists
      const beforeDelete = await db.select().from(issues);
      expect(beforeDelete).toHaveLength(1);

      // Delete machine
      await db.delete(machines).where(eq(machines.id, machine.id));

      // Verify issue was cascade deleted
      const afterDelete = await db.select().from(issues);
      expect(afterDelete).toHaveLength(0);
    });
  });

  describe("User Profiles", () => {
    it("should insert and query user profile", async () => {
      const db = await getTestDb();
      const testUser = createTestUser({
        firstName: "John",
        lastName: "Doe",
        role: "member",
      });

      await db.insert(userProfiles).values(testUser);

      const result = await db.select().from(userProfiles);

      expect(result).toHaveLength(1);
      expect(result[0].firstName).toBe("John");
      expect(result[0].lastName).toBe("Doe");
      expect(result[0].name).toBe("John Doe");
      expect(result[0].role).toBe("member");
    });

    it("should link user to reported issues", async () => {
      const db = await getTestDb();

      // Create user
      const testUser = createTestUser({
        firstName: "Reporter",
        lastName: "User",
      });
      const [user] = await db.insert(userProfiles).values(testUser).returning();

      // Create machine
      const testMachine = createTestMachine();
      const [machine] = await db
        .insert(machines)
        .values(testMachine)
        .returning();

      // Create issue reported by user
      const testIssue = createTestIssue(machine.id, {
        title: "User reported issue",
        reportedBy: user.id,
      });
      await db.insert(issues).values(testIssue);

      // Query with relation

      const result = await db.query.issues.findFirst({
        where: eq(issues.reportedBy, user.id),
        with: {
          reportedByUser: true,
        },
      });

      expect(result).toBeDefined();

      expect(result?.reportedByUser?.name).toBe("Reporter User");
    });
  });

  describe("Notifications", () => {
    it("should create notification when issue is assigned", async () => {
      const db = await getTestDb();

      // Setup: Machine, Reporter, Assignee
      const [machine] = await db
        .insert(machines)
        .values(createTestMachine())
        .returning();
      const [reporter] = await db
        .insert(userProfiles)
        .values(createTestUser({ firstName: "Reporter" }))
        .returning();
      const [assignee] = await db
        .insert(userProfiles)
        .values(createTestUser({ firstName: "Assignee" }))
        .returning();

      // Create Issue
      const [issue] = await db
        .insert(issues)
        .values(
          createTestIssue(machine.id, {
            reportedBy: reporter.id,
            assignedTo: assignee.id,
          })
        )
        .returning();

      // Note: The actual notification creation happens in the Server Action, not the DB layer directly.
      // However, we can verify that if we manually call the notification logic (or simulate it), it inserts correctly.
      // Since this is a DB query test, we'll verify the schema supports the insert.

      // Simulate notification insert
      await db.insert(notifications).values({
        userId: assignee.id,
        type: "issue_assigned",
        resourceId: issue.id,
        resourceType: "issue",
      });

      const userNotifications = await db.query.notifications.findMany({
        where: eq(notifications.userId, assignee.id),
      });

      expect(userNotifications).toHaveLength(1);
      expect(userNotifications[0].type).toBe("issue_assigned");
      expect(userNotifications[0].readAt).toBeNull();
    });

    it("should create notification using library function (integration)", async () => {
      const db = await getTestDb();

      // Setup: Machine, Reporter, Assignee
      const [machine] = await db
        .insert(machines)
        .values(createTestMachine())
        .returning();
      const [reporter] = await db
        .insert(userProfiles)
        .values(createTestUser({ firstName: "Reporter" }))
        .returning();
      const [assignee] = await db
        .insert(userProfiles)
        .values(createTestUser({ firstName: "Assignee" }))
        .returning();

      // Ensure assignee has preferences (usually handled by triggers, but we need to be sure in test env)
      // The trigger might not run in PGlite if not set up, but our seed data logic usually handles it.
      // Let's manually insert preferences to be safe and isolate the test.
      await db
        .insert(notificationPreferences)
        .values({
          userId: assignee.id,
          inAppEnabled: true,
          inAppNotifyOnAssigned: true,
        })
        .onConflictDoNothing();

      // Create Issue
      const [issue] = await db
        .insert(issues)
        .values(
          createTestIssue(machine.id, {
            reportedBy: reporter.id,
            assignedTo: assignee.id,
          })
        )
        .returning();

      // Add assignee as watcher (simulating assignIssueAction behavior)
      await db.insert(issueWatchers).values({
        issueId: issue.id,
        userId: assignee.id,
      });

      // Call the actual library function with the test DB
      await createNotification(
        {
          type: "issue_assigned",
          resourceId: issue.id,
          resourceType: "issue",
          actorId: reporter.id,
          issueTitle: issue.title,
          machineName: machine.name,
        },
        db
      );

      // Verify notification was created
      const userNotifications = await db.query.notifications.findMany({
        where: eq(notifications.userId, assignee.id),
      });

      expect(userNotifications).toHaveLength(1);
      expect(userNotifications[0].type).toBe("issue_assigned");
      expect(userNotifications[0].resourceId).toBe(issue.id);
    });
    it("should delete notification (mark as read behavior)", async () => {
      const db = await getTestDb();

      // Setup data
      const [testUser] = await db
        .insert(userProfiles)
        .values(createTestUser())
        .returning();
      const [machine] = await db
        .insert(machines)
        .values(createTestMachine())
        .returning();
      const [testIssue] = await db
        .insert(issues)
        .values(createTestIssue(machine.id))
        .returning();

      // 1. Create a notification
      const [notification] = await db
        .insert(notifications)
        .values({
          userId: testUser.id,
          type: "issue_assigned",
          resourceId: testIssue.id,
          resourceType: "issue",
        })
        .returning();

      expect(notification).toBeDefined();

      // 2. Delete it (simulating markAsReadAction)
      await db
        .delete(notifications)
        .where(eq(notifications.id, notification.id));

      // 3. Verify it's gone
      const found = await db.query.notifications.findFirst({
        where: eq(notifications.id, notification.id),
      });

      expect(found).toBeUndefined();
    });
  });
});
