/**
 * Integration Tests for Issue Service Functions
 *
 * Verifies that service layer functions correctly handle the new
 * status overhaul fields, transactions, and timeline events.
 *
 * Wave 3 RECLASS additions (PP-x4li.1.3): migrated all 17 blocks from
 * src/services/issues.test.ts that had real DB-state or notification-dispatch
 * assertions. Notification/timeline mocks are kept so we can assert dispatch
 * arguments; timeline DB writes flow through the PGlite proxy unchanged.
 */

import { describe, it, expect, beforeEach, vi, beforeAll } from "vitest";
import { eq, desc } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { createTestUser } from "~/test/helpers/factories";
import {
  issues,
  issueWatchers,
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
  addIssueComment,
  reassignIssueMachine,
  updateIssueTitle,
} from "~/services/issues";
import { planNotification } from "~/lib/notifications";
import { plainTextToDoc, type ProseMirrorDoc } from "~/lib/tiptap/types";
import { resolveIssueReporter } from "~/lib/issues/utils";

// ---------------------------------------------------------------------------
// External delivery / side-effect boundaries — mocked so we can assert
// dispatch without real email/discord/Vault HTTP round-trips.
// The timeline DB writes (createTimelineEvent, emitIssue*) still flow
// through the PGlite proxy below, so we intentionally do NOT mock
// ~/lib/timeline/events or ~/lib/timeline/issue-timeline-helpers.
// ---------------------------------------------------------------------------
vi.mock("~/lib/notifications", () => ({
  // Services now plan inside the tx and return the plan; the action dispatches
  // post-commit. These tests call the services directly, so they assert the
  // planning payload. planNotification must resolve a DeliveryPlan so the
  // service's `deliveries.push(...plan.deliveries)` works. (PP-2053.3)
  planNotification: vi.fn().mockResolvedValue({ deliveries: [] }),
  getChannels: vi.fn().mockResolvedValue([]),
}));

vi.mock("~/lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

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
    vi.clearAllMocks();
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

      const { issue } = await createIssue(guestInfo);

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

      const { issue } = await createIssue(anonInfo);

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

      const { issue } = await createIssue(memberInfo);

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

  describe("createIssue idempotency (PP-2053.7)", () => {
    it("dedupes a retried submission: same key twice yields one row, returns the existing issue, no second dispatch", async () => {
      const db = await getTestDb();
      const idempotencyKey = "11111111-1111-4111-8111-111111111111";

      const params = {
        title: "Idempotent Issue",
        description: plainTextToDoc("Submitted once, retried once"),
        machineInitials: testMachine.initials,
        severity: "minor" as const,
        reporterName: "Retry User",
        reporterEmail: "retry@example.com",
        idempotencyKey,
      };

      // First submission creates the row and plans a notification.
      const { issue: first } = await createIssue(params);
      expect(first.idempotencyKey).toBe(idempotencyKey);
      const planCallsAfterFirst = vi.mocked(planNotification).mock.calls.length;
      expect(planCallsAfterFirst).toBeGreaterThan(0);

      // Capture the machine counter after the first insert — a retry must NOT
      // advance it.
      const machineAfterFirst = await db.query.machines.findFirst({
        where: eq(machines.initials, testMachine.initials),
        columns: { nextIssueNumber: true },
      });

      // Retry with the SAME key returns the existing issue.
      const { issue: second, deliveryPlan } = await createIssue(params);
      expect(second.id).toBe(first.id);
      expect(second.issueNumber).toBe(first.issueNumber);

      // No second counter increment.
      const machineAfterSecond = await db.query.machines.findFirst({
        where: eq(machines.initials, testMachine.initials),
        columns: { nextIssueNumber: true },
      });
      expect(machineAfterSecond?.nextIssueNumber).toBe(
        machineAfterFirst?.nextIssueNumber
      );

      // No second notification: planNotification not called again, empty plan.
      expect(vi.mocked(planNotification).mock.calls.length).toBe(
        planCallsAfterFirst
      );
      expect(deliveryPlan.deliveries).toHaveLength(0);

      // Exactly one row carries the key.
      const rows = await db.query.issues.findMany({
        where: eq(issues.idempotencyKey, idempotencyKey),
      });
      expect(rows).toHaveLength(1);
    });

    it("distinct keys create distinct issues", async () => {
      const a = await createIssue({
        title: "Issue A",
        machineInitials: testMachine.initials,
        severity: "minor" as const,
        reporterName: "User A",
        idempotencyKey: "22222222-2222-4222-8222-222222222222",
      });
      const b = await createIssue({
        title: "Issue B",
        machineInitials: testMachine.initials,
        severity: "minor" as const,
        reporterName: "User B",
        idempotencyKey: "33333333-3333-4333-8333-333333333333",
      });
      expect(b.issue.id).not.toBe(a.issue.id);
      expect(b.issue.issueNumber).not.toBe(a.issue.issueNumber);
    });

    it("null key skips dedup: two submissions create two rows", async () => {
      const a = await createIssue({
        title: "No-key A",
        machineInitials: testMachine.initials,
        severity: "minor" as const,
        reporterName: "Anon A",
      });
      const b = await createIssue({
        title: "No-key B",
        machineInitials: testMachine.initials,
        severity: "minor" as const,
        reporterName: "Anon B",
      });
      expect(a.issue.idempotencyKey).toBeNull();
      expect(b.issue.idempotencyKey).toBeNull();
      expect(b.issue.id).not.toBe(a.issue.id);
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

  // -----------------------------------------------------------------------
  // Watch flag default behavior (audit row 7, class-B integration tests)
  //
  // Verifies that createIssue() inserts the reporter into issue_watchers when
  // autoWatchReporter=true (the default), and does NOT insert when
  // autoWatchReporter=false.
  //
  // Bug class B: server action wiring — the form's watchIssue checkbox must
  // actually control the DB write. This layer is cheaper than E2E because it
  // calls createIssue() directly without a browser and asserts the DB state.
  // -----------------------------------------------------------------------
  describe("Watch flag default behavior", () => {
    it("auto-watches the reporter when autoWatchReporter is true (default)", async () => {
      const db = await getTestDb();

      const { issue } = await createIssue({
        title: "Auto-watched issue",
        machineInitials: testMachine.initials,
        severity: "minor" as const,
        reportedBy: testUser.id,
        // autoWatchReporter defaults to true — omitting it exercises the default
      });

      // Verify the reporter was inserted into issue_watchers
      const watchers = await db
        .select()
        .from(issueWatchers)
        .where(eq(issueWatchers.issueId, issue.id));

      expect(watchers).toHaveLength(1);
      expect(watchers[0]?.userId).toBe(testUser.id);
    });

    it("does not auto-watch the reporter when autoWatchReporter is false", async () => {
      const db = await getTestDb();

      const { issue } = await createIssue({
        title: "Unwatched issue",
        machineInitials: testMachine.initials,
        severity: "minor" as const,
        reportedBy: testUser.id,
        autoWatchReporter: false,
      });

      // Verify NO row was inserted into issue_watchers for this issue
      const watchers = await db
        .select()
        .from(issueWatchers)
        .where(eq(issueWatchers.issueId, issue.id));

      expect(watchers).toHaveLength(0);
    });

    it("does not insert a watcher row when there is no authenticated reporter", async () => {
      const db = await getTestDb();

      // Guest/anonymous report — reportedBy is null, so the watcher insert
      // is skipped regardless of the autoWatchReporter flag.
      const { issue } = await createIssue({
        title: "Anonymous issue",
        machineInitials: testMachine.initials,
        severity: "minor" as const,
        reportedBy: null,
        autoWatchReporter: true,
      });

      const watchers = await db
        .select()
        .from(issueWatchers)
        .where(eq(issueWatchers.issueId, issue.id));

      expect(watchers).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Rule #12 regression guard (audit row 11, class-E integration test)
  //
  // Verifies that when an issue record has reporterEmail set (email-only
  // public reporter) and is fetched via the DB query path used by the issue
  // detail page, resolveIssueReporter() returns "Anonymous" — not the email.
  // This confirms that reporterEmail is NOT part of the IssueReporterInfo
  // interface and therefore can never leak into any rendered display field.
  //
  // If someone adds reporterEmail to IssueReporterInfo or to the query
  // column selection, this test will fail before it reaches production.
  // -----------------------------------------------------------------------
  describe("reporter email privacy (Rule #12)", () => {
    it("resolveIssueReporter returns Anonymous for email-only guest, never the email", async () => {
      const db = await getTestDb();

      // Insert an issue whose only reporter identifier is reporterEmail (the
      // "email-only guest" case: public reporter submitted an email address but
      // no name, and was never linked to a user profile).
      const [emailOnlyIssue] = await db
        .insert(issues)
        .values({
          machineInitials: testMachine.initials,
          issueNumber: 99,
          title: "Email-only guest issue",
          severity: "minor" as const,
          reportedBy: null,
          reporterName: null,
          reporterEmail: "display@bug.com",
        })
        .returning();

      // Fetch the issue matching the root columns selection behavior of the issue detail page
      // (no columns restriction under issues, but with related tables restricted).
      const fetched = await db.query.issues.findFirst({
        where: eq(issues.id, emailOnlyIssue.id),
        with: {
          reportedByUser: { columns: { id: true, name: true } },
          invitedReporter: { columns: { id: true, name: true } },
        },
      });

      if (!fetched) throw new Error("Expected issue to exist");

      // Verify that reporterEmail is actually retrieved by the query.
      expect(fetched.reporterEmail).toBe("display@bug.com");

      // Pass the fetched issue directly to resolveIssueReporter to mirror how the page
      // invokes it. This ensures that any accidental access to reporterEmail (which is
      // now retrieved by the query) will be caught.
      const reporter = resolveIssueReporter(fetched);

      expect(reporter.name).toBe("Anonymous");
      expect(reporter.name).not.toContain("display@bug.com");
    });
  });

  // =========================================================================
  // Wave 3 RECLASS blocks (PP-x4li.1.3)
  //
  // Migrated from src/services/issues.test.ts. Each block drives the real
  // service against PGlite. ~/lib/notifications and ~/lib/logger are mocked
  // (external delivery boundaries); timeline DB writes are NOT mocked — they
  // flow through the same globalThis.testDb proxy used by the service.
  // =========================================================================

  // -----------------------------------------------------------------------
  // assignIssue — notification dispatch (blocks 1–2 from source)
  // -----------------------------------------------------------------------
  describe("assignIssue notification dispatch", () => {
    let testUser2: any;

    beforeEach(async () => {
      const db = await getTestDb();
      const [user2] = await db
        .insert(userProfiles)
        .values(
          createTestUser({
            id: "00000000-0000-0000-0000-000000000002",
            role: "member",
            firstName: "New",
            lastName: "Assignee",
          })
        )
        .returning();
      testUser2 = user2;
    });

    it("notifies the assignee when assigning (block 1)", async () => {
      await assignIssue({
        issueId: testIssue.id,
        assignedTo: testUser2.id,
        actorId: testUser.id,
      });

      const mockFn = planNotification as ReturnType<typeof vi.fn>;
      expect(mockFn).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "issue_assigned",
          resourceId: testIssue.id,
          resourceType: "issue",
          actorId: testUser.id,
          includeActor: false,
          additionalRecipientIds: [testUser2.id],
          issueTitle: testIssue.title,
          machineName: testMachine.name,
          formattedIssueId: `${testMachine.initials}-01`,
        }),
        expect.anything(),
        expect.anything()
      );
    });

    it("passes issue description to notification when present (block 2)", async () => {
      const db = await getTestDb();
      const description: ProseMirrorDoc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Left flipper is stuck" }],
          },
        ],
      };

      // Update the issue to have a description
      await db
        .update(issues)
        .set({ description })
        .where(eq(issues.id, testIssue.id));

      await assignIssue({
        issueId: testIssue.id,
        assignedTo: testUser2.id,
        actorId: testUser.id,
      });

      const mockFn = planNotification as ReturnType<typeof vi.fn>;
      expect(mockFn).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "issue_assigned",
          issueDescription: "Left flipper is stuck",
        }),
        expect.anything(),
        expect.anything()
      );
    });
  });

  // -----------------------------------------------------------------------
  // createIssue — notification dispatch (blocks 3, 5, 6 from source)
  //
  // Block 3 (auto-watches + notification): the watcher DB assertion is already
  //   covered by "Watch flag default behavior" — here we assert the notification.
  // Block 4 (insert count): pure mock-count assertion with no integration value
  //   because the watcher DB state is already tested above → DROPPED.
  // -----------------------------------------------------------------------
  describe("createIssue notification dispatch", () => {
    it("sends a new_issue notification to machine owner (block 3)", async () => {
      const { issue } = await createIssue({
        title: "New Notification Issue",
        machineInitials: testMachine.initials,
        severity: "minor" as const,
        reportedBy: testUser.id,
      });

      const mockFn = planNotification as ReturnType<typeof vi.fn>;
      expect(mockFn).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "new_issue",
          resourceId: issue.id,
          resourceType: "issue",
          actorId: testUser.id,
          issueTitle: "New Notification Issue",
          machineName: testMachine.name,
        }),
        expect.anything(),
        expect.anything()
      );
    });

    it("extracts mention IDs from description and dispatches a mentioned notification (block 5)", async () => {
      const description: ProseMirrorDoc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Hey " },
              {
                type: "mention",
                attrs: { id: testUser.id, label: "Test User" },
              },
            ],
          },
        ],
      };

      const { issue } = await createIssue({
        title: "Issue with Mentions",
        description,
        machineInitials: testMachine.initials,
        severity: "minor" as const,
        reportedBy: testUser.id,
      });

      const mockFn = planNotification as ReturnType<typeof vi.fn>;
      const mentionCalls = mockFn.mock.calls.filter(
        ([payload]: [{ type?: string }]) => payload.type === "mentioned"
      );
      expect(mentionCalls).toHaveLength(1);
      expect(mentionCalls[0]?.[0]).toEqual(
        expect.objectContaining({
          type: "mentioned",
          resourceId: issue.id,
          resourceType: "issue",
          actorId: testUser.id,
          includeActor: false,
          additionalRecipientIds: [testUser.id],
        })
      );
    });

    it("does not dispatch a mentioned notification when description has no mentions (block 6)", async () => {
      const description: ProseMirrorDoc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "No mentions here" }],
          },
        ],
      };

      await createIssue({
        title: "Plain Issue",
        description,
        machineInitials: testMachine.initials,
        severity: "minor" as const,
        reportedBy: testUser.id,
      });

      const mockFn = planNotification as ReturnType<typeof vi.fn>;
      const mentionCalls = mockFn.mock.calls.filter(
        ([payload]: [{ type?: string }]) => payload.type === "mentioned"
      );
      expect(mentionCalls).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // addIssueComment — notification dispatch + DB state (block 7 from source)
  // -----------------------------------------------------------------------
  describe("addIssueComment notification dispatch", () => {
    it("notifies participants and auto-watches the commenter (block 7)", async () => {
      const db = await getTestDb();
      const content: ProseMirrorDoc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "My comment" }],
          },
        ],
      };

      const { comment } = await addIssueComment({
        issueId: testIssue.id,
        content,
        userId: testUser.id,
      });

      // Verify the comment was persisted
      expect(comment.id).toBeDefined();

      // Verify the commenter was auto-watched
      const watchers = await db
        .select()
        .from(issueWatchers)
        .where(eq(issueWatchers.issueId, testIssue.id));
      expect(watchers.some((w) => w.userId === testUser.id)).toBe(true);

      // Verify notification dispatch
      const mockFn = planNotification as ReturnType<typeof vi.fn>;
      expect(mockFn).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "new_comment",
          resourceId: testIssue.id,
          resourceType: "issue",
          actorId: testUser.id,
          issueTitle: testIssue.title,
          machineName: testMachine.name,
          commentContent: "My comment",
        }),
        expect.anything(),
        expect.anything()
      );
    });
  });

  // -----------------------------------------------------------------------
  // updateIssueStatus — closedAt + notification (block 8 from source)
  // no-op guard (block 9 from source)
  //
  // Block 8: The target already tests status DB change + timeline event above.
  // Here we add the notification dispatch assertion and the closedAt DB check
  // that the unit test verified via mock call inspection.
  // -----------------------------------------------------------------------
  describe("updateIssueStatus — notification and closedAt", () => {
    it("sends issue_status_changed notification and sets closedAt when closing (block 8)", async () => {
      const db = await getTestDb();

      await updateIssueStatus({
        issueId: testIssue.id,
        status: "fixed",
        userId: testUser.id,
      });

      // Verify closedAt is set in DB
      const updated = await db.query.issues.findFirst({
        where: eq(issues.id, testIssue.id),
      });
      expect(updated?.closedAt).not.toBeNull();
      expect(updated?.status).toBe("fixed");

      // Verify notification dispatch
      const mockFn = planNotification as ReturnType<typeof vi.fn>;
      expect(mockFn).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "issue_status_changed",
          newStatus: "fixed",
          resourceId: testIssue.id,
        }),
        expect.anything(),
        expect.anything()
      );
    });

    it("skips update when status has not changed (no-op) (block 9)", async () => {
      const db = await getTestDb();

      // Issue starts at "new" (from beforeEach). Call with same status.
      const result = await updateIssueStatus({
        issueId: testIssue.id,
        status: "new",
        userId: testUser.id,
      });

      expect(result).toEqual({
        issueId: testIssue.id,
        oldStatus: "new",
        newStatus: "new",
        deliveryPlan: { deliveries: [] },
      });

      // Verify no timeline event was created
      const events = await db.query.issueComments.findMany({
        where: eq(issueComments.issueId, testIssue.id),
      });
      expect(events.filter((e) => e.isSystem)).toHaveLength(0);

      // Verify no notification dispatched
      const mockFn = planNotification as ReturnType<typeof vi.fn>;
      expect(mockFn).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // updateIssueSeverity — no-op guard (block 10 from source)
  // (The "changes severity" integration case is already above.)
  // -----------------------------------------------------------------------
  describe("updateIssueSeverity — no-op guard", () => {
    it("skips update when severity has not changed (no-op) (block 10)", async () => {
      const db = await getTestDb();

      // Issue starts at severity "minor" (from beforeEach).
      const result = await updateIssueSeverity({
        issueId: testIssue.id,
        severity: "minor",
        userId: testUser.id,
      });

      expect(result).toEqual({
        issueId: testIssue.id,
        oldSeverity: "minor",
        newSeverity: "minor",
      });

      // Verify no timeline event was created
      const events = await db.query.issueComments.findMany({
        where: eq(issueComments.issueId, testIssue.id),
      });
      expect(events.filter((e) => e.isSystem)).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // updateIssuePriority — no-op guard (block 11 from source)
  // -----------------------------------------------------------------------
  describe("updateIssuePriority — no-op guard", () => {
    it("skips update when priority has not changed (no-op) (block 11)", async () => {
      const db = await getTestDb();

      // Issue starts at priority "low" (from beforeEach).
      const result = await updateIssuePriority({
        issueId: testIssue.id,
        priority: "low",
        userId: testUser.id,
      });

      expect(result).toEqual({
        issueId: testIssue.id,
        oldPriority: "low",
        newPriority: "low",
      });

      // Verify no timeline event was created
      const events = await db.query.issueComments.findMany({
        where: eq(issueComments.issueId, testIssue.id),
      });
      expect(events.filter((e) => e.isSystem)).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // updateIssueFrequency — no-op guard (block 12 from source)
  // -----------------------------------------------------------------------
  describe("updateIssueFrequency — no-op guard", () => {
    it("skips update when frequency has not changed (no-op) (block 12)", async () => {
      const db = await getTestDb();

      // Issue starts at frequency "intermittent" (from beforeEach).
      const result = await updateIssueFrequency({
        issueId: testIssue.id,
        frequency: "intermittent",
        userId: testUser.id,
      });

      expect(result).toEqual({
        issueId: testIssue.id,
        oldFrequency: "intermittent",
        newFrequency: "intermittent",
      });

      // Verify no timeline event was created
      const events = await db.query.issueComments.findMany({
        where: eq(issueComments.issueId, testIssue.id),
      });
      expect(events.filter((e) => e.isSystem)).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // assignIssue no-op (block 13 from source)
  //
  // The target already has "should no-op when assignment unchanged" in the
  // existing "assignIssue" describe above (verifies event count stays same).
  // That test sufficiently covers the no-op DB behavior. Block 13 used mocks
  // to assert mockDb.update/createTimelineEvent/createNotification were NOT
  // called — equivalent coverage is provided by the event-count assertion
  // and the mockFn check in the status no-op tests above.
  // Disposition: SUPERSEDED — dropped to avoid duplicate coverage.
  // -----------------------------------------------------------------------

  // -----------------------------------------------------------------------
  // reassignIssueMachine — all 4 blocks (blocks 14–17 from source)
  // -----------------------------------------------------------------------
  describe("reassignIssueMachine", () => {
    let destMachine: any;

    beforeEach(async () => {
      const db = await getTestDb();
      // Create a second machine as the reassignment destination
      const [machine2] = await db
        .insert(machines)
        .values({
          name: "Kiss Pro",
          initials: "KP",
          ownerId: testUser.id,
          nextIssueNumber: 12,
        })
        .returning();
      destMachine = machine2;
    });

    it("reserves a fresh number on the destination, updates the issue, and creates a timeline event (block 14)", async () => {
      const db = await getTestDb();

      const result = await reassignIssueMachine({
        issueId: testIssue.id,
        newMachineInitials: destMachine.initials,
        userId: testUser.id,
      });

      // Return value carries both ends of the reassignment
      expect(result).toEqual({
        issueId: testIssue.id,
        fromInitials: testMachine.initials,
        fromIssueNumber: 1,
        fromMachineName: testMachine.name,
        toInitials: destMachine.initials,
        toIssueNumber: 12, // nextIssueNumber was 12, so reserved = 12
        toMachineName: destMachine.name,
      });

      // Verify the issue row was updated in the DB
      const updated = await db.query.issues.findFirst({
        where: eq(issues.id, testIssue.id),
      });
      expect(updated?.machineInitials).toBe(destMachine.initials);
      expect(updated?.issueNumber).toBe(12);

      // Verify the destination machine's counter was incremented
      const destUpdated = await db.query.machines.findFirst({
        where: eq(machines.initials, destMachine.initials),
      });
      expect(destUpdated?.nextIssueNumber).toBe(13);

      // Verify a machine_reassigned timeline event was created on the issue
      const events = await db.query.issueComments.findMany({
        where: eq(issueComments.issueId, testIssue.id),
        orderBy: desc(issueComments.createdAt),
      });
      const reassignEvent = events.find(
        (e) =>
          e.isSystem &&
          (e.eventData as { type?: string }).type === "machine_reassigned"
      );
      expect(reassignEvent).toBeDefined();
      expect(reassignEvent?.eventData).toEqual(
        expect.objectContaining({
          type: "machine_reassigned",
          fromInitials: testMachine.initials,
          fromIssueNumber: 1,
          toInitials: destMachine.initials,
          toIssueNumber: 12,
        })
      );
    });

    it("throws when destination machine matches the current one (block 15)", async () => {
      await expect(
        reassignIssueMachine({
          issueId: testIssue.id,
          newMachineInitials: testMachine.initials,
          userId: testUser.id,
        })
      ).rejects.toThrow("already on that machine");

      // Verify no DB change occurred
      const db = await getTestDb();
      const unchanged = await db.query.issues.findFirst({
        where: eq(issues.id, testIssue.id),
      });
      expect(unchanged?.machineInitials).toBe(testMachine.initials);
      expect(unchanged?.issueNumber).toBe(1);
    });

    it("throws when destination machine does not exist (block 16)", async () => {
      await expect(
        reassignIssueMachine({
          issueId: testIssue.id,
          newMachineInitials: "DOES-NOT-EXIST",
          userId: testUser.id,
        })
      ).rejects.toThrow("Machine not found");
    });

    it("throws when issue does not exist (block 17)", async () => {
      await expect(
        reassignIssueMachine({
          issueId: "00000000-0000-0000-0000-000000000000",
          newMachineInitials: destMachine.initials,
          userId: testUser.id,
        })
      ).rejects.toThrow("Issue not found");
    });
  });
});
