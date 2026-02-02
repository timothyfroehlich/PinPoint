/**
 * Integration Tests for Database Queries
 *
 * Validates core database operations including insertions, queries,
 * and constraint enforcement using PGlite.
 */

import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { createTestMachine, createTestIssue } from "~/test/helpers/factories";
import {
  machines,
  issues,
  userProfiles,
  notifications,
  notificationPreferences,
} from "~/server/db/schema";

describe("Database Queries (PGlite)", () => {
  setupTestDb();

  describe("Machines", () => {
    it("should insert and query a machine", async () => {
      const db = await getTestDb();
      const testMachine = createTestMachine({ name: "Twilight Zone" });

      await db.insert(machines).values(testMachine);

      const result = await db.query.machines.findFirst({
        where: eq(machines.name, "Twilight Zone"),
      });

      expect(result).toBeDefined();
      expect(result?.name).toBe("Twilight Zone");
    });

    it("should find machine by id", async () => {
      const db = await getTestDb();
      const testMachine = createTestMachine();

      await db.insert(machines).values(testMachine);

      const result = await db.query.machines.findFirst({
        where: eq(machines.id, testMachine.id),
      });

      expect(result).toBeDefined();
      expect(result?.id).toBe(testMachine.id);
    });
  });

  describe("Issues", () => {
    it("should insert issue with machine reference", async () => {
      const db = await getTestDb();

      const testMachine = createTestMachine({ initials: "AFM" });
      await db.insert(machines).values(testMachine);

      const testIssue = createTestIssue(testMachine.initials, {
        title: "Broken flipper",
        issueNumber: 1,
        severity: "unplayable",
      });
      await db.insert(issues).values(testIssue);

      // Query with relation
      const result = await db.query.issues.findFirst({
        where: eq(issues.id, testIssue.id),
        with: {
          machine: true,
        },
      });

      expect(result).toBeDefined();
      expect(result?.title).toBe("Broken flipper");
      expect(result?.machine.name).toBe(testMachine.name);
    });

    it("should enforce machine_initials NOT NULL constraint", async () => {
      const db = await getTestDb();

      const testIssue = createTestIssue("", {
        title: "Orphan Issue",
      });
      // @ts-expect-error - Testing constraint violation
      testIssue.machineInitials = null;

      await expect(db.insert(issues).values(testIssue)).rejects.toThrow();
    });

    it("should cascade delete issues when machine is deleted", async () => {
      const db = await getTestDb();

      const testMachine = createTestMachine({ initials: "TZ" });
      await db.insert(machines).values(testMachine);

      const testIssue = createTestIssue(testMachine.initials, {
        issueNumber: 1,
      });
      await db.insert(issues).values(testIssue);

      // Verify issue exists
      const beforeDelete = await db.query.issues.findMany();
      expect(beforeDelete).toHaveLength(1);

      // Delete machine
      await db.delete(machines).where(eq(machines.id, testMachine.id));

      // Verify issue is gone
      const afterDelete = await db.query.issues.findMany();
      expect(afterDelete).toHaveLength(0);
    });
  });

  describe("User Profiles", () => {
    it("should insert and query user profile", async () => {
      const db = await getTestDb();

      const testUser = {
        id: "00000000-0000-0000-0000-000000000001",
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        role: "member" as const,
      };

      await db.insert(userProfiles).values(testUser);

      const result = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, testUser.id),
      });

      expect(result).toBeDefined();
      expect(result?.name).toBe("Test User"); // Generated column
    });

    it("should link user to reported issues", async () => {
      const db = await getTestDb();

      // Create user
      const testUser = {
        id: "00000000-0000-0000-0000-000000000001",
        email: "reporter@example.com",
        firstName: "Reporter",
        lastName: "Person",
        role: "member" as const,
      };
      await db.insert(userProfiles).values(testUser);

      // Create machine
      const testMachine = createTestMachine({ initials: "MM" });
      await db.insert(machines).values(testMachine);

      // Create issue reported by user
      const testIssue = createTestIssue(testMachine.initials, {
        issueNumber: 1,
        title: "User reported issue",
        reportedBy: testUser.id,
      });
      await db.insert(issues).values(testIssue);

      // Query with relation
      const result = await db.query.issues.findFirst({
        where: eq(issues.id, testIssue.id),
        with: {
          reportedByUser: true,
        },
      });

      expect(result?.reportedByUser?.firstName).toBe("Reporter");
    });
  });

  describe("Notifications", () => {
    it("should create notification when issue is assigned", async () => {
      const db = await getTestDb();

      // Create users
      const assigner = {
        id: "00000000-0000-0000-0000-000000000001",
        email: "assigner@example.com",
        firstName: "Admin",
        lastName: "User",
        role: "admin" as const,
      };
      const assignee = {
        id: "00000000-0000-0000-0000-000000000002",
        email: "assignee@example.com",
        firstName: "Member",
        lastName: "User",
        role: "member" as const,
      };
      await db.insert(userProfiles).values([assigner, assignee]);

      // Create Machine
      const testMachine = createTestMachine({ initials: "TAF" });
      await db.insert(machines).values(testMachine);

      // Create Issue
      const [issue] = await db
        .insert(issues)
        .values(
          createTestIssue(testMachine.initials, {
            issueNumber: 1,
            assignedTo: assignee.id,
            reportedBy: assigner.id,
          })
        )
        .returning();

      // Manual Notification Creation (simulating service logic)
      await db.insert(notifications).values({
        userId: assignee.id,
        type: "issue_assigned",
        resourceId: issue.id,
        resourceType: "issue",
      });

      // Verify notification
      const result = await db.query.notifications.findFirst({
        where: eq(notifications.userId, assignee.id),
      });

      expect(result).toBeDefined();
      expect(result?.type).toBe("issue_assigned");
      expect(result?.resourceId).toBe(issue.id);
    });

    it("should create notification using library function (integration)", async () => {
      const db = await getTestDb();
      const { createNotification } = await import("~/lib/notifications");

      // Create user
      const user = {
        id: "00000000-0000-0000-0000-000000000001",
        email: "test-lib@example.com",
        firstName: "Test",
        lastName: "User",
        role: "member" as const,
      };
      await db.insert(userProfiles).values(user);

      // Set up notification preferences for the user (notifications enabled)
      await db.insert(notificationPreferences).values({
        userId: user.id,
        emailEnabled: true,
        inAppEnabled: true,
        emailWatchNewIssuesGlobal: true, // Watch all new issues
        inAppWatchNewIssuesGlobal: true,
      });

      // Create machine
      const testMachine = createTestMachine({ initials: "TZ" });
      await db.insert(machines).values(testMachine);

      // Create issue
      const [issue] = await db
        .insert(issues)
        .values(
          createTestIssue(testMachine.initials, {
            issueNumber: 1,
            reportedBy: user.id, // Reported by same user, but global watch should still notify?
            // Actually createNotification logic excludes actor unless includeActor is true.
            // In this test call below, actorId is passed as user.id.
            // But wait, if actorId == user.id, they are excluded.
            // Let's make reportedBy someone else to avoid confusion, OR use includeActor: true if that's the intent.
            // The test passes actorId: user.id.
            assignedTo: null,
          })
        )
        .returning();

      // Create notification
      await createNotification(
        {
          type: "new_issue",
          resourceId: issue.id,
          resourceType: "issue",
          actorId: "00000000-0000-0000-0000-000000000002", // Actor is someone else
          includeActor: false, // Exclude actor to test recipient global watch behavior
          issueTitle: "Test Issue",
          machineName: "Test Machine",
          issueContext: {
            assignedToId: null,
          },
        },
        db
      );

      // Verify
      const results = await db.query.notifications.findMany({
        where: eq(notifications.userId, user.id),
      });

      // Should notify user because they are watching global new issues
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe("new_issue");
    });

    it("should delete notification (mark as read behavior)", async () => {
      const db = await getTestDb();

      const user = {
        id: "00000000-0000-0000-0000-000000000001",
        email: "test-del@example.com",
        firstName: "Test",
        lastName: "User",
        role: "member" as const,
      };
      await db.insert(userProfiles).values(user);

      const testMachine = createTestMachine({ initials: "MM" });
      await db.insert(machines).values(testMachine);

      const testIssue = createTestIssue(testMachine.initials, {
        issueNumber: 1,
      });
      await db.insert(issues).values(testIssue);

      // Create notification
      const [notif] = await db
        .insert(notifications)
        .values({
          userId: user.id,
          type: "issue_assigned",
          resourceId: testIssue.id,
          resourceType: "issue",
        })
        .returning();

      // "Mark as read" (delete)
      await db.delete(notifications).where(eq(notifications.id, notif.id));

      // Verify gone
      const result = await db.query.notifications.findFirst({
        where: eq(notifications.id, notif.id),
      });

      expect(result).toBeUndefined();
    });
  });
});
