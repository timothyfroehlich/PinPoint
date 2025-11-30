/**
 * Integration Tests for Issues System
 *
 * Tests issue CRUD operations and timeline events with PGlite.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { createTestUser } from "~/test/helpers/factories";
import {
  issues,
  machines,
  userProfiles,
  issueComments,
} from "~/server/db/schema";

describe("Issues CRUD Operations (PGlite)", () => {
  // Set up worker-scoped PGlite and auto-cleanup after each test
  setupTestDb();

  let testMachine: { id: string; name: string };
  let testUser: { id: string; name: string };

  beforeEach(async () => {
    const db = await getTestDb();

    // Create test machine
    const [machine] = await db
      .insert(machines)
      .values({ name: "Test Machine" })
      .returning();
    testMachine = machine;

    // Create test user
    const [user] = await db
      .insert(userProfiles)
      .values(
        createTestUser({
          id: "00000000-0000-0000-0000-000000000001",
          role: "member",
        })
      )
      .returning();
    testUser = user;
  });

  describe("Issue Creation", () => {
    it("should create an issue with valid data", async () => {
      const db = await getTestDb();

      const [issue] = await db
        .insert(issues)
        .values({
          title: "Test Issue",
          description: "Test description",
          machineId: testMachine.id,
          severity: "playable",
          reportedBy: testUser.id,
          status: "new",
        })
        .returning();

      expect(issue).toBeDefined();
      expect(issue.title).toBe("Test Issue");
      expect(issue.description).toBe("Test description");
      expect(issue.machineId).toBe(testMachine.id);
      expect(issue.severity).toBe("playable");
      expect(issue.status).toBe("new");
      expect(issue.reportedBy).toBe(testUser.id);
    });

    it("should enforce machine requirement (NOT NULL constraint)", async () => {
      const db = await getTestDb();

      // Attempt to create issue without machineId should fail
      await expect(
        db.insert(issues).values({
          title: "Test Issue",
          // @ts-expect-error - Testing validation
          machineId: null,
          severity: "minor",
          reportedBy: testUser.id,
        })
      ).rejects.toThrow();
    });

    it("should default status to 'new' if not provided", async () => {
      const db = await getTestDb();

      const [issue] = await db
        .insert(issues)
        .values({
          title: "Test Issue",
          machineId: testMachine.id,
          severity: "minor",
          reportedBy: testUser.id,
        })
        .returning();

      expect(issue.status).toBe("new");
    });

    it("should default severity to 'playable' if not provided", async () => {
      const db = await getTestDb();

      const [issue] = await db
        .insert(issues)
        .values({
          title: "Test Issue",
          machineId: testMachine.id,
          reportedBy: testUser.id,
        })
        .returning();

      expect(issue.severity).toBe("playable");
    });
  });

  describe("Issue Queries", () => {
    beforeEach(async () => {
      const db = await getTestDb();

      // Create multiple issues for testing queries
      await db.insert(issues).values([
        {
          title: "Issue 1",
          machineId: testMachine.id,
          severity: "unplayable",
          status: "new",
          reportedBy: testUser.id,
        },
        {
          title: "Issue 2",
          machineId: testMachine.id,
          severity: "playable",
          status: "in_progress",
          reportedBy: testUser.id,
        },
        {
          title: "Issue 3",
          machineId: testMachine.id,
          severity: "minor",
          status: "resolved",
          reportedBy: testUser.id,
        },
      ]);
    });

    it("should query all issues for a machine", async () => {
      const db = await getTestDb();

      const machineIssues = await db.query.issues.findMany({
        where: eq(issues.machineId, testMachine.id),
      });

      expect(machineIssues).toHaveLength(3);
    });

    it("should filter issues by status", async () => {
      const db = await getTestDb();

      const newIssues = await db.query.issues.findMany({
        where: eq(issues.status, "new"),
      });

      expect(newIssues).toHaveLength(1);
      expect(newIssues[0]?.title).toBe("Issue 1");
    });

    it("should filter issues by severity", async () => {
      const db = await getTestDb();

      const unplayableIssues = await db.query.issues.findMany({
        where: eq(issues.severity, "unplayable"),
      });

      expect(unplayableIssues).toHaveLength(1);
      expect(unplayableIssues[0]?.title).toBe("Issue 1");
    });

    it("should query issue with relations", async () => {
      const db = await getTestDb();

      const issue = await db.query.issues.findFirst({
        where: eq(issues.title, "Issue 1"),
        with: {
          machine: true,
          reportedByUser: true,
        },
      });

      expect(issue).toBeDefined();
      expect(issue!.machine.name).toBe("Test Machine");
      expect(issue!.reportedByUser!.name).toBe("Test User");
    });
  });

  describe("Issue Updates", () => {
    let testIssue: { id: string; status: string; severity: string };

    beforeEach(async () => {
      const db = await getTestDb();

      const [issue] = await db
        .insert(issues)
        .values({
          title: "Test Issue",
          machineId: testMachine.id,
          severity: "playable",
          status: "new",
          reportedBy: testUser.id,
        })
        .returning();
      testIssue = issue;
    });

    it("should update issue status", async () => {
      const db = await getTestDb();

      await db
        .update(issues)
        .set({ status: "in_progress" })
        .where(eq(issues.id, testIssue.id));

      const updated = await db.query.issues.findFirst({
        where: eq(issues.id, testIssue.id),
      });

      expect(updated?.status).toBe("in_progress");
    });

    it("should update issue severity", async () => {
      const db = await getTestDb();

      await db
        .update(issues)
        .set({ severity: "unplayable" })
        .where(eq(issues.id, testIssue.id));

      const updated = await db.query.issues.findFirst({
        where: eq(issues.id, testIssue.id),
      });

      expect(updated?.severity).toBe("unplayable");
    });

    it("should set resolvedAt when status is resolved", async () => {
      const db = await getTestDb();

      const resolvedDate = new Date();
      await db
        .update(issues)
        .set({ status: "resolved", resolvedAt: resolvedDate })
        .where(eq(issues.id, testIssue.id));

      const updated = await db.query.issues.findFirst({
        where: eq(issues.id, testIssue.id),
      });

      expect(updated?.status).toBe("resolved");
      expect(updated?.resolvedAt).toBeDefined();
    });

    it("should assign issue to user", async () => {
      const db = await getTestDb();

      await db
        .update(issues)
        .set({ assignedTo: testUser.id })
        .where(eq(issues.id, testIssue.id));

      const updated = await db.query.issues.findFirst({
        where: eq(issues.id, testIssue.id),
        with: {
          assignedToUser: true,
        },
      });

      expect(updated?.assignedTo).toBe(testUser.id);
      expect(updated?.assignedToUser?.name).toBe("Test User");
    });
  });

  describe("Timeline Events", () => {
    let testIssue: { id: string };

    beforeEach(async () => {
      const db = await getTestDb();

      const [issue] = await db
        .insert(issues)
        .values({
          title: "Test Issue",
          machineId: testMachine.id,
          severity: "playable",
          reportedBy: testUser.id,
        })
        .returning();
      testIssue = issue;
    });

    it("should create system timeline event", async () => {
      const db = await getTestDb();

      const [event] = await db
        .insert(issueComments)
        .values({
          issueId: testIssue.id,
          content: "Issue created",
          isSystem: true,
          authorId: null,
        })
        .returning();

      expect(event).toBeDefined();
      expect(event.content).toBe("Issue created");
      expect(event.isSystem).toBe(true);
      expect(event.authorId).toBeNull();
    });

    it("should query timeline events with comments", async () => {
      const db = await getTestDb();

      // Create system event
      await db.insert(issueComments).values({
        issueId: testIssue.id,
        content: "Status changed from new to in_progress",
        isSystem: true,
      });

      // Create regular comment (for future feature)
      await db.insert(issueComments).values({
        issueId: testIssue.id,
        content: "This is a comment",
        isSystem: false,
        authorId: testUser.id,
      });

      const timeline = await db.query.issueComments.findMany({
        where: eq(issueComments.issueId, testIssue.id),
        with: {
          author: true,
        },
      });

      expect(timeline).toHaveLength(2);

      const systemEvent = timeline.find((t) => t.isSystem);
      const userComment = timeline.find((t) => !t.isSystem);

      expect(systemEvent?.content).toBe(
        "Status changed from new to in_progress"
      );
      expect(systemEvent?.authorId).toBeNull();
      expect(userComment?.author?.name).toBe("Test User");
    });

    it("should order timeline events chronologically", async () => {
      const db = await getTestDb();

      // Create multiple events
      const now = Date.now();
      await db.insert(issueComments).values([
        {
          issueId: testIssue.id,
          content: "Issue created",
          isSystem: true,
          createdAt: new Date(now - 3_000),
        },
        {
          issueId: testIssue.id,
          content: "Status changed",
          isSystem: true,
          createdAt: new Date(now - 2_000),
        },
        {
          issueId: testIssue.id,
          content: "Severity changed",
          isSystem: true,
          createdAt: new Date(now - 1_000),
        },
      ]);

      const timeline = await db.query.issueComments.findMany({
        where: eq(issueComments.issueId, testIssue.id),
        orderBy: (comments, { desc }) => [desc(comments.createdAt)],
      });

      expect(timeline).toHaveLength(3);
      // Most recent first when using desc
      expect(timeline[0]?.content).toBe("Severity changed");
    });
  });

  describe("Anonymous Issue Reporting", () => {
    it("should create an issue with null reporter", async () => {
      const db = await getTestDb();

      const [issue] = await db
        .insert(issues)
        .values({
          title: "Public Issue",
          machineId: testMachine.id,
          severity: "minor",
          reportedBy: null,
        })
        .returning();

      expect(issue).toBeDefined();
      expect(issue.reportedBy).toBeNull();
    });

    it("should include anonymous issues in member issue lists", async () => {
      const db = await getTestDb();

      await db.insert(issues).values([
        {
          title: "Member Issue",
          machineId: testMachine.id,
          severity: "playable",
          reportedBy: testUser.id,
        },
        {
          title: "Anonymous Issue",
          machineId: testMachine.id,
          severity: "unplayable",
          reportedBy: null,
        },
      ]);

      const results = await db.query.issues.findMany({
        where: eq(issues.machineId, testMachine.id),
        with: {
          reportedByUser: {
            columns: { id: true, name: true },
          },
        },
      });

      const anonymous = results.find(
        (issue) => issue.title === "Anonymous Issue"
      );
      const memberIssue = results.find(
        (issue) => issue.title === "Member Issue"
      );

      expect(anonymous).toBeDefined();
      expect(anonymous?.reportedBy).toBeNull();
      expect(anonymous?.reportedByUser).toBeNull();
      expect(memberIssue?.reportedByUser?.name).toBe("Test User");
    });
  });

  describe("Cascade Deletion", () => {
    it("should delete issues when machine is deleted", async () => {
      const db = await getTestDb();

      // Create issue
      await db.insert(issues).values({
        title: "Test Issue",
        machineId: testMachine.id,
        severity: "minor",
        reportedBy: testUser.id,
      });

      // Delete machine
      await db.delete(machines).where(eq(machines.id, testMachine.id));

      // Check that issue was also deleted (cascade)
      const remainingIssues = await db.query.issues.findMany({
        where: eq(issues.machineId, testMachine.id),
      });

      expect(remainingIssues).toHaveLength(0);
    });

    it("should delete timeline events when issue is deleted", async () => {
      const db = await getTestDb();

      // Create issue
      const [issue] = await db
        .insert(issues)
        .values({
          title: "Test Issue",
          machineId: testMachine.id,
          severity: "minor",
          reportedBy: testUser.id,
        })
        .returning();

      // Create timeline event
      await db.insert(issueComments).values({
        issueId: issue.id,
        content: "Issue created",
        isSystem: true,
      });

      // Delete issue
      await db.delete(issues).where(eq(issues.id, issue.id));

      // Check that timeline event was also deleted (cascade)
      const remainingComments = await db.query.issueComments.findMany({
        where: eq(issueComments.issueId, issue.id),
      });

      expect(remainingComments).toHaveLength(0);
    });
  });
});
