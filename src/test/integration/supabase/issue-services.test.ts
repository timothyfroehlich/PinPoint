/**
 * Integration Tests for Issue Service Functions
 *
 * Verifies that service layer functions correctly handle the new
 * status overhaul fields, transactions, and timeline events.
 */

import { describe, it, expect, beforeEach, vi, beforeAll } from "vitest";
import { eq, desc } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { createTestUser } from "~/test/helpers/factories";
import {
  issues,
  machines,
  userProfiles,
  issueComments,
} from "~/server/db/schema";
import {
  updateIssueStatus,
  updateIssueSeverity,
  updateIssuePriority,
  updateIssueFrequency,
  createIssue,
  assignIssue,
  updateIssueTitle,
} from "~/services/issues";
import { plainTextToDoc } from "~/lib/tiptap/types";

// Mock the database to use the PGlite instance
vi.mock("~/server/db", () => ({
  db: {
    insert: vi.fn((...args: any[]) =>
      (globalThis as any).testDb.insert(...args)
    ),
    update: vi.fn((...args: any[]) =>
      (globalThis as any).testDb.update(...args)
    ),
    delete: vi.fn((...args: any[]) =>
      (globalThis as any).testDb.delete(...args)
    ),
    select: vi.fn((...args: any[]) =>
      (globalThis as any).testDb.select(...args)
    ),
    query: {
      issues: {
        findFirst: vi.fn((...args: any[]) =>
          (globalThis as any).testDb.query.issues.findFirst(...args)
        ),
        findMany: vi.fn((...args: any[]) =>
          (globalThis as any).testDb.query.issues.findMany(...args)
        ),
      },
      userProfiles: {
        findFirst: vi.fn((...args: any[]) =>
          (globalThis as any).testDb.query.userProfiles.findFirst(...args)
        ),
      },
    },
    transaction: vi.fn((cb: any) => cb((globalThis as any).testDb)),
  },
}));

describe("Issue Service Functions (Integration)", () => {
  setupTestDb();

  let testMachine: any;
  let testUser: any;
  let testIssue: any;

  beforeAll(async () => {
    (globalThis as any).testDb = await getTestDb();
  });

  beforeEach(async () => {
    const db = await getTestDb();

    // Create test user (admin for permissions if needed, though services don't check permissions)
    const [user] = await db
      .insert(userProfiles)
      .values(
        createTestUser({
          id: "00000000-0000-0000-0000-000000000001",
          role: "admin",
        })
      )
      .returning();
    testUser = user;

    // Create test machine
    const [machine] = await db
      .insert(machines)
      .values({
        name: "Service Test Machine",
        initials: "STM",
        ownerId: testUser.id,
        nextIssueNumber: 2,
      })
      .returning();
    testMachine = machine;

    // Create a base issue
    const [issue] = await db
      .insert(issues)
      .values({
        title: "Service Test Issue",
        machineInitials: testMachine.initials,
        issueNumber: 1,
        severity: "minor",
        priority: "low",
        frequency: "intermittent",
        status: "new",
        reportedBy: testUser.id,
      })
      .returning();
    testIssue = issue;
  });

  it("should update status and create timeline event", async () => {
    const db = await getTestDb();
    const newStatus = "in_progress";

    await updateIssueStatus({
      issueId: testIssue.id,
      status: newStatus,
      userId: testUser.id,
    });

    const updated = await db.query.issues.findFirst({
      where: eq(issues.id, testIssue.id),
    });

    expect(updated?.status).toBe(newStatus);

    // Verify timeline event
    const events = await db.query.issueComments.findMany({
      where: eq(issueComments.issueId, testIssue.id),
      orderBy: desc(issueComments.createdAt),
    });

    const statusEvent = events.find(
      (e) => e.isSystem && e.eventData?.type === "status_changed"
    );
    expect(statusEvent).toBeDefined();
    expect(statusEvent?.eventData).toEqual({
      type: "status_changed",
      from: "new",
      to: "in_progress",
    });
    expect(statusEvent?.authorId).toBe(testUser.id);
  });

  it("should update severity and create timeline event", async () => {
    const db = await getTestDb();
    const newSeverity = "unplayable";

    await updateIssueSeverity({
      issueId: testIssue.id,
      severity: newSeverity,
      userId: testUser.id,
    });

    const updated = await db.query.issues.findFirst({
      where: eq(issues.id, testIssue.id),
    });

    expect(updated?.severity).toBe(newSeverity);

    const event = await db.query.issueComments.findFirst({
      where: eq(issueComments.issueId, testIssue.id),
      orderBy: desc(issueComments.createdAt),
    });

    expect(event?.eventData).toEqual({
      type: "severity_changed",
      from: "minor",
      to: "unplayable",
    });
    expect(event?.authorId).toBe(testUser.id);
  });

  it("should update priority and create timeline event", async () => {
    const db = await getTestDb();
    const newPriority = "high";

    await updateIssuePriority({
      issueId: testIssue.id,
      priority: newPriority,
      userId: testUser.id,
    });

    const updated = await db.query.issues.findFirst({
      where: eq(issues.id, testIssue.id),
    });

    expect(updated?.priority).toBe(newPriority);

    const event = await db.query.issueComments.findFirst({
      where: eq(issueComments.issueId, testIssue.id),
      orderBy: desc(issueComments.createdAt),
    });

    expect(event?.eventData).toEqual({
      type: "priority_changed",
      from: "low",
      to: "high",
    });
    expect(event?.authorId).toBe(testUser.id);
  });

  it("should update frequency and create timeline event", async () => {
    const db = await getTestDb();
    const newFrequency = "constant";

    await updateIssueFrequency({
      issueId: testIssue.id,
      frequency: newFrequency,
      userId: testUser.id,
    });

    const updated = await db.query.issues.findFirst({
      where: eq(issues.id, testIssue.id),
    });

    expect(updated?.frequency).toBe(newFrequency);

    const event = await db.query.issueComments.findFirst({
      where: eq(issueComments.issueId, testIssue.id),
      orderBy: desc(issueComments.createdAt),
    });

    expect(event?.eventData).toEqual({
      type: "frequency_changed",
      from: "intermittent",
      to: "constant",
    });
    expect(event?.authorId).toBe(testUser.id);
  });

  describe("createIssue with reporter variations", () => {
    it("should create an issue with guest reporter info", async () => {
      const db = await getTestDb();

      const guestInfo = {
        title: "Guest Issue",
        description: plainTextToDoc("Guest reported this"),
        machineInitials: testMachine.initials,
        severity: "minor" as const,
        reporterName: "Guest User",
        reporterEmail: "guest@example.com",
      };

      const issue = await createIssue(guestInfo);

      expect(issue.reporterName).toBe(guestInfo.reporterName);
      expect(issue.reporterEmail).toBe(guestInfo.reporterEmail);
      expect(issue.reportedBy).toBeNull();

      // Verify no initial timeline event is created
      const events = await db.query.issueComments.findMany({
        where: eq(issueComments.issueId, issue.id),
        orderBy: desc(issueComments.createdAt),
      });

      const systemEvents = events.filter((e) => e.isSystem);
      expect(systemEvents).toHaveLength(0);
    });

    it("should create an anonymous issue", async () => {
      const db = await getTestDb();

      const anonInfo = {
        title: "Anon Issue",
        description: plainTextToDoc("Anon reported this"),
        machineInitials: testMachine.initials,
        severity: "major" as const,
      };

      const issue = await createIssue(anonInfo);

      expect(issue.reporterName).toBeNull();
      expect(issue.reporterEmail).toBeNull();
      expect(issue.reportedBy).toBeNull();

      // Verify no initial timeline event is created
      const events = await db.query.issueComments.findMany({
        where: eq(issueComments.issueId, issue.id),
        orderBy: desc(issueComments.createdAt),
      });

      const systemEvents = events.filter((e) => e.isSystem);
      expect(systemEvents).toHaveLength(0);
    });

    it("should create a member issue", async () => {
      const db = await getTestDb();

      const memberInfo = {
        title: "Member Issue",
        machineInitials: testMachine.initials,
        severity: "unplayable" as const,
        reportedBy: testUser.id,
      };

      const issue = await createIssue(memberInfo);

      expect(issue.reportedBy).toBe(testUser.id);
      expect(issue.reporterName).toBeNull();
      expect(issue.reporterEmail).toBeNull();

      // Verify no initial timeline event is created
      const events = await db.query.issueComments.findMany({
        where: eq(issueComments.issueId, issue.id),
        orderBy: desc(issueComments.createdAt),
      });

      const systemEvents = events.filter((e) => e.isSystem);
      expect(systemEvents).toHaveLength(0);
    });
  });

  describe("assignIssue", () => {
    let testUser2: any;

    beforeEach(async () => {
      const db = await getTestDb();
      const [user2] = await db
        .insert(userProfiles)
        .values(
          createTestUser({
            id: "00000000-0000-0000-0000-000000000002",
            role: "member",
            firstName: "Second",
            lastName: "User",
          })
        )
        .returning();
      testUser2 = user2;
    });

    it("should create assigned timeline event with actorId", async () => {
      const db = await getTestDb();

      await assignIssue({
        issueId: testIssue.id,
        assignedTo: testUser2.id,
        actorId: testUser.id,
      });

      const updated = await db.query.issues.findFirst({
        where: eq(issues.id, testIssue.id),
      });
      expect(updated?.assignedTo).toBe(testUser2.id);

      const events = await db.query.issueComments.findMany({
        where: eq(issueComments.issueId, testIssue.id),
        orderBy: desc(issueComments.createdAt),
      });

      const assignEvent = events.find(
        (e) => e.isSystem && e.eventData?.type === "assigned"
      );
      expect(assignEvent).toBeDefined();
      expect(assignEvent?.eventData).toEqual({
        type: "assigned",
        assigneeName: "Second User",
      });
      expect(assignEvent?.authorId).toBe(testUser.id);
    });

    it("should create unassigned timeline event", async () => {
      const db = await getTestDb();

      // First assign
      await db
        .update(issues)
        .set({ assignedTo: testUser2.id })
        .where(eq(issues.id, testIssue.id));

      // Then unassign
      await assignIssue({
        issueId: testIssue.id,
        assignedTo: null,
        actorId: testUser.id,
      });

      const updated = await db.query.issues.findFirst({
        where: eq(issues.id, testIssue.id),
      });
      expect(updated?.assignedTo).toBeNull();

      const events = await db.query.issueComments.findMany({
        where: eq(issueComments.issueId, testIssue.id),
        orderBy: desc(issueComments.createdAt),
      });

      const unassignEvent = events.find(
        (e) => e.isSystem && e.eventData?.type === "unassigned"
      );
      expect(unassignEvent).toBeDefined();
      expect(unassignEvent?.eventData).toEqual({ type: "unassigned" });
      expect(unassignEvent?.authorId).toBe(testUser.id);
    });

    it("should no-op when assignment unchanged", async () => {
      const db = await getTestDb();

      // Assign first
      await assignIssue({
        issueId: testIssue.id,
        assignedTo: testUser2.id,
        actorId: testUser.id,
      });

      // Count events after first assign
      const eventsAfterFirst = await db.query.issueComments.findMany({
        where: eq(issueComments.issueId, testIssue.id),
      });
      const countAfterFirst = eventsAfterFirst.length;

      // Assign same user again
      await assignIssue({
        issueId: testIssue.id,
        assignedTo: testUser2.id,
        actorId: testUser.id,
      });

      // Should not create a new event
      const eventsAfterSecond = await db.query.issueComments.findMany({
        where: eq(issueComments.issueId, testIssue.id),
      });
      expect(eventsAfterSecond.length).toBe(countAfterFirst);
    });
  });

  describe("updateIssueTitle", () => {
    it("should update title and create timeline event", async () => {
      const db = await getTestDb();
      const newTitle = "Updated Title";

      await updateIssueTitle({
        issueId: testIssue.id,
        title: newTitle,
        userId: testUser.id,
      });

      const updated = await db.query.issues.findFirst({
        where: eq(issues.id, testIssue.id),
      });
      expect(updated?.title).toBe(newTitle);

      const events = await db.query.issueComments.findMany({
        where: eq(issueComments.issueId, testIssue.id),
        orderBy: desc(issueComments.createdAt),
      });

      const titleEvent = events.find(
        (e) => e.isSystem && e.eventData?.type === "title_changed"
      );
      expect(titleEvent).toBeDefined();
      expect(titleEvent?.eventData).toEqual({
        type: "title_changed",
        from: "Service Test Issue",
        to: newTitle,
      });
      expect(titleEvent?.authorId).toBe(testUser.id);
    });

    it("should no-op when title unchanged", async () => {
      const db = await getTestDb();

      const result = await updateIssueTitle({
        issueId: testIssue.id,
        title: "Service Test Issue",
        userId: testUser.id,
      });

      expect(result.oldTitle).toBe(result.newTitle);

      const events = await db.query.issueComments.findMany({
        where: eq(issueComments.issueId, testIssue.id),
      });

      const systemEvents = events.filter((e) => e.isSystem);
      expect(systemEvents).toHaveLength(0);
    });
  });
});
