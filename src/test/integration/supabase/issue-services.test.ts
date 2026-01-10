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
  updateIssueConsistency,
} from "~/services/issues";

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
        consistency: "intermittent",
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

    const statusEvent = events.find((e) =>
      e.content.includes("Status changed")
    );
    expect(statusEvent).toBeDefined();
    expect(statusEvent?.content).toContain("from New to In Progress");
    expect(statusEvent?.isSystem).toBe(true);
  });

  it("should update severity and create timeline event", async () => {
    const db = await getTestDb();
    const newSeverity = "unplayable";

    await updateIssueSeverity({
      issueId: testIssue.id,
      severity: newSeverity,
    });

    const updated = await db.query.issues.findFirst({
      where: eq(issues.id, testIssue.id),
    });

    expect(updated?.severity).toBe(newSeverity);

    const event = await db.query.issueComments.findFirst({
      where: eq(issueComments.issueId, testIssue.id),
      orderBy: desc(issueComments.createdAt),
    });

    expect(event?.content).toContain("Severity changed");
    expect(event?.content).toContain("from Minor to Unplayable");
  });

  it("should update priority and create timeline event", async () => {
    const db = await getTestDb();
    const newPriority = "high";

    await updateIssuePriority({
      issueId: testIssue.id,
      priority: newPriority,
    });

    const updated = await db.query.issues.findFirst({
      where: eq(issues.id, testIssue.id),
    });

    expect(updated?.priority).toBe(newPriority);

    const event = await db.query.issueComments.findFirst({
      where: eq(issueComments.issueId, testIssue.id),
      orderBy: desc(issueComments.createdAt),
    });

    expect(event?.content).toContain("Priority changed");
    expect(event?.content).toContain("from Low to High");
  });

  it("should update consistency and create timeline event", async () => {
    const db = await getTestDb();
    const newConsistency = "constant";

    await updateIssueConsistency({
      issueId: testIssue.id,
      consistency: newConsistency,
    });

    const updated = await db.query.issues.findFirst({
      where: eq(issues.id, testIssue.id),
    });

    expect(updated?.consistency).toBe(newConsistency);

    const event = await db.query.issueComments.findFirst({
      where: eq(issueComments.issueId, testIssue.id),
      orderBy: desc(issueComments.createdAt),
    });

    expect(event?.content).toContain("Consistency changed");
    expect(event?.content).toContain("from Intermittent to Constant");
  });
});
