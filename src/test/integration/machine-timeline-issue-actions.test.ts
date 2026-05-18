/**
 * Integration Test: createIssue — Machine Timeline Duplicate-Write (PP-0x98)
 *
 * Verifies that the issue-create service duplicate-writes an `issue_opened`
 * row into `timeline_events` atomically with the issue insert. The
 * `issue_opened` row lives alongside (NOT instead of) the existing
 * `issueComments` system row.
 *
 * Email-privacy guarantee (AGENTS.md rule 10): `openedByName` is derived
 * from `user_profiles.name` or the freeform `reporterName`, with an
 * "Anonymous" fallback — never the reporter email.
 */

import { describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import {
  authUsers,
  issueComments,
  machines,
  timelineEvents,
  userProfiles,
} from "~/server/db/schema";
import { CLOSED_STATUSES } from "~/lib/issues/status";

// Route the production `db` import to the PGlite worker instance.
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

vi.mock("~/lib/notifications", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("~/lib/logger", () => ({
  log: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("~/lib/observability/report-error", () => ({
  reportError: vi.fn(),
}));

describe("createIssue duplicate-writes to machine timeline (PP-0x98)", () => {
  setupTestDb();

  async function makeUser(
    overrides: {
      firstName?: string;
      lastName?: string;
      role?: "guest" | "member" | "technician" | "admin";
    } = {}
  ) {
    const db = await getTestDb();
    const id = randomUUID();
    await db.insert(authUsers).values({ id, email: `${id}@example.com` });
    const [user] = await db
      .insert(userProfiles)
      .values({
        id,
        email: `${id}@example.com`,
        firstName: overrides.firstName ?? "Test",
        lastName: overrides.lastName ?? "Reporter",
        role: overrides.role ?? "member",
      })
      .returning();
    return user;
  }

  let machineCounter = 0;
  async function makeMachine(ownerId?: string) {
    const db = await getTestDb();
    machineCounter += 1;
    const [machine] = await db
      .insert(machines)
      .values({
        name: "Test Machine",
        initials: `IS${String(machineCounter).padStart(3, "0")}`,
        ownerId,
      })
      .returning();
    return machine;
  }

  it("emits issue_opened to timeline_events when an issue is created", async () => {
    const db = await getTestDb();
    const reporter = await makeUser({
      firstName: "Maria",
      lastName: "Lopez",
    });
    const machine = await makeMachine();

    const { createIssue } = await import("~/services/issues");
    const issue = await createIssue({
      title: "Flipper broken",
      machineInitials: machine.initials,
      severity: "minor",
      priority: "low",
      frequency: "intermittent",
      status: "new",
      reportedBy: reporter.id,
      autoWatchReporter: true,
    });

    const mtRows = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    expect(mtRows).toHaveLength(1);
    const row = mtRows[0];
    expect(row.sourceType).toBe("issue");
    expect(row.tag).toBe("issue");
    expect(row.eventData).toMatchObject({
      kind: "issue_opened",
      issueId: issue.id,
      issueNumber: issue.issueNumber,
      openedByName: "Maria Lopez",
      title: "Flipper broken",
    });
    expect(row.authorId).toBe(reporter.id);

    // The existing issueComments behavior is preserved (no "assigned" comment
    // here because the issue isn't assigned; the assigned-event path is
    // exercised in Task 12 if desired).
    const ic = await db.select().from(issueComments);
    expect(ic).toHaveLength(0);
  });

  it("uses reporterName fallback when reportedBy is not set (public report)", async () => {
    const db = await getTestDb();
    const machine = await makeMachine();

    const { createIssue } = await import("~/services/issues");
    await createIssue({
      title: "Sticky button",
      machineInitials: machine.initials,
      severity: "minor",
      priority: "low",
      frequency: "intermittent",
      status: "new",
      reporterName: "Joe Public",
      autoWatchReporter: false,
    });

    const [row] = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    expect(row.eventData).toMatchObject({
      kind: "issue_opened",
      openedByName: "Joe Public",
    });
    expect(row.authorId).toBeNull();
  });

  it('falls back to "Anonymous" when neither reportedBy nor reporterName is set', async () => {
    const db = await getTestDb();
    const machine = await makeMachine();

    const { createIssue } = await import("~/services/issues");
    await createIssue({
      title: "Bug",
      machineInitials: machine.initials,
      severity: "minor",
      priority: "low",
      frequency: "intermittent",
      status: "new",
      autoWatchReporter: false,
    });

    const [row] = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    expect(row.eventData).toMatchObject({
      kind: "issue_opened",
      openedByName: "Anonymous",
    });
  });
});

describe("updateIssueStatus duplicate-writes to machine timeline (PP-0x98)", () => {
  setupTestDb();

  async function makeUser(
    overrides: { firstName?: string; lastName?: string } = {}
  ) {
    const db = await getTestDb();
    const id = randomUUID();
    await db.insert(authUsers).values({ id, email: `${id}@example.com` });
    const [user] = await db
      .insert(userProfiles)
      .values({
        id,
        email: `${id}@example.com`,
        firstName: overrides.firstName ?? "Test",
        lastName: overrides.lastName ?? "Reporter",
        role: "member",
      })
      .returning();
    return user;
  }

  let machineCounter = 0;
  async function makeMachine() {
    const db = await getTestDb();
    machineCounter += 1;
    const [machine] = await db
      .insert(machines)
      .values({
        name: "Test Machine",
        initials: `US${String(machineCounter).padStart(3, "0")}`,
      })
      .returning();
    return machine;
  }

  async function seedIssue(
    reporter: { id: string },
    machine: { id: string; initials: string }
  ) {
    const { createIssue } = await import("~/services/issues");
    return createIssue({
      title: "x",
      machineInitials: machine.initials,
      severity: "minor",
      priority: "low",
      frequency: "intermittent",
      status: "new",
      reportedBy: reporter.id,
      autoWatchReporter: false,
    });
  }

  async function clearTimelineEventsForMachine(machineId: string) {
    const db = await getTestDb();
    await db
      .delete(timelineEvents)
      .where(eq(timelineEvents.machineId, machineId));
  }

  it("emits issue_closed when status changes to a closed status", async () => {
    const db = await getTestDb();
    const user = await makeUser({ firstName: "Tim", lastName: "Test" });
    const machine = await makeMachine();
    const issue = await seedIssue(user, machine);
    // remove Task 10's issue_opened so we assert cleanly on the status change
    await clearTimelineEventsForMachine(machine.id);

    const { updateIssueStatus } = await import("~/services/issues");
    const closedStatus = CLOSED_STATUSES[0]; // "fixed"
    await updateIssueStatus({
      issueId: issue.id,
      status: closedStatus,
      userId: user.id,
    });

    const rows = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].sourceType).toBe("issue");
    expect(rows[0].tag).toBe("issue");
    expect(rows[0].eventData).toMatchObject({
      kind: "issue_closed",
      issueId: issue.id,
      issueNumber: issue.issueNumber,
      closedByName: "Tim Test",
      title: "x",
    });
    expect(rows[0].authorId).toBe(user.id);
  });

  it("emits issue_status_changed for an intermediate status transition", async () => {
    const db = await getTestDb();
    const user = await makeUser({ firstName: "Sam", lastName: "Smith" });
    const machine = await makeMachine();
    const issue = await seedIssue(user, machine);
    await clearTimelineEventsForMachine(machine.id);

    const { updateIssueStatus } = await import("~/services/issues");
    await updateIssueStatus({
      issueId: issue.id,
      status: "in_progress",
      userId: user.id,
    });

    const rows = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].eventData).toMatchObject({
      kind: "issue_status_changed",
      issueId: issue.id,
      issueNumber: issue.issueNumber,
      from: "new",
      to: "in_progress",
    });
    expect(rows[0].authorId).toBe(user.id);
  });

  it("emits NO event when status didn't change (no-op shortcut)", async () => {
    const db = await getTestDb();
    const user = await makeUser();
    const machine = await makeMachine();
    const issue = await seedIssue(user, machine);
    await clearTimelineEventsForMachine(machine.id);

    const { updateIssueStatus } = await import("~/services/issues");
    await updateIssueStatus({
      issueId: issue.id,
      status: "new",
      userId: user.id,
    });

    const rows = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    expect(rows).toHaveLength(0);
  });
});

describe("assignIssue duplicate-writes to machine timeline (PP-0x98)", () => {
  setupTestDb();

  async function makeUser(
    overrides: { firstName?: string; lastName?: string } = {}
  ) {
    const db = await getTestDb();
    const id = randomUUID();
    await db.insert(authUsers).values({ id, email: `${id}@example.com` });
    const [user] = await db
      .insert(userProfiles)
      .values({
        id,
        email: `${id}@example.com`,
        firstName: overrides.firstName ?? "Test",
        lastName: overrides.lastName ?? "Reporter",
        role: "member",
      })
      .returning();
    return user;
  }

  let machineCounter = 0;
  async function makeMachine() {
    const db = await getTestDb();
    machineCounter += 1;
    const [machine] = await db
      .insert(machines)
      .values({
        name: "Test Machine",
        initials: `AS${String(machineCounter).padStart(3, "0")}`,
      })
      .returning();
    return machine;
  }

  async function seedIssue(
    reporter: { id: string },
    machine: { id: string; initials: string }
  ) {
    const { createIssue } = await import("~/services/issues");
    return createIssue({
      title: "x",
      machineInitials: machine.initials,
      severity: "minor",
      priority: "low",
      frequency: "intermittent",
      status: "new",
      reportedBy: reporter.id,
      autoWatchReporter: false,
    });
  }

  async function clearTimelineEventsForMachine(machineId: string) {
    const db = await getTestDb();
    await db
      .delete(timelineEvents)
      .where(eq(timelineEvents.machineId, machineId));
  }

  it("emits issue_assigned when an issue is assigned to a user", async () => {
    const db = await getTestDb();
    const reporter = await makeUser();
    const assignee = await makeUser({ firstName: "Tim", lastName: "Test" });
    const machine = await makeMachine();
    const issue = await seedIssue(reporter, machine);
    await clearTimelineEventsForMachine(machine.id);

    const { assignIssue } = await import("~/services/issues");
    await assignIssue({
      issueId: issue.id,
      assignedTo: assignee.id,
      actorId: reporter.id,
    });

    const rows = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].sourceType).toBe("issue");
    expect(rows[0].tag).toBe("issue");
    expect(rows[0].eventData).toMatchObject({
      kind: "issue_assigned",
      issueId: issue.id,
      issueNumber: issue.issueNumber,
      assigneeName: "Tim Test",
    });
    expect(rows[0].authorId).toBe(reporter.id);
  });

  it("emits issue_unassigned when the assignee is cleared", async () => {
    const db = await getTestDb();
    const reporter = await makeUser();
    const assignee = await makeUser();
    const machine = await makeMachine();
    const issue = await seedIssue(reporter, machine);

    const { assignIssue } = await import("~/services/issues");
    // First assign
    await assignIssue({
      issueId: issue.id,
      assignedTo: assignee.id,
      actorId: reporter.id,
    });
    // Clear timeline events from both seedIssue and the assign above
    await clearTimelineEventsForMachine(machine.id);
    // Then unassign
    await assignIssue({
      issueId: issue.id,
      assignedTo: null,
      actorId: reporter.id,
    });

    const rows = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].sourceType).toBe("issue");
    expect(rows[0].tag).toBe("issue");
    expect(rows[0].eventData).toMatchObject({
      kind: "issue_unassigned",
      issueId: issue.id,
      issueNumber: issue.issueNumber,
    });
    expect(rows[0].authorId).toBe(reporter.id);
  });

  it("emits NO event when assignment is unchanged (no-op)", async () => {
    const db = await getTestDb();
    const reporter = await makeUser();
    const machine = await makeMachine();
    const issue = await seedIssue(reporter, machine);
    // seedIssue creates with assignedTo: null implicitly
    await clearTimelineEventsForMachine(machine.id);

    const { assignIssue } = await import("~/services/issues");
    // null → null no-op
    await assignIssue({
      issueId: issue.id,
      assignedTo: null,
      actorId: reporter.id,
    });

    const rows = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machine.id));
    expect(rows).toHaveLength(0);
  });
});

describe("reassignIssueMachine duplicate-writes dual rows (PP-0x98)", () => {
  setupTestDb();

  async function makeUser(
    overrides: { firstName?: string; lastName?: string } = {}
  ) {
    const db = await getTestDb();
    const id = randomUUID();
    await db.insert(authUsers).values({ id, email: `${id}@example.com` });
    const [user] = await db
      .insert(userProfiles)
      .values({
        id,
        email: `${id}@example.com`,
        firstName: overrides.firstName ?? "Test",
        lastName: overrides.lastName ?? "Reporter",
        role: "member",
      })
      .returning();
    return user;
  }

  let machineCounter = 0;
  async function makeMachine() {
    const db = await getTestDb();
    machineCounter += 1;
    const [machine] = await db
      .insert(machines)
      .values({
        name: `Test Machine ${String(machineCounter)}`,
        initials: `RS${String(machineCounter).padStart(3, "0")}`,
      })
      .returning();
    return machine;
  }

  async function seedIssue(
    reporter: { id: string },
    machine: { id: string; initials: string }
  ) {
    const { createIssue } = await import("~/services/issues");
    return createIssue({
      title: "x",
      machineInitials: machine.initials,
      severity: "minor",
      priority: "low",
      frequency: "intermittent",
      status: "new",
      reportedBy: reporter.id,
      autoWatchReporter: false,
    });
  }

  async function clearTimelineEventsForMachine(machineId: string) {
    const db = await getTestDb();
    await db
      .delete(timelineEvents)
      .where(eq(timelineEvents.machineId, machineId));
  }

  it("emits issue_reassigned_out on source AND issue_reassigned_in on destination", async () => {
    const db = await getTestDb();
    const reporter = await makeUser();
    const source = await makeMachine();
    const dest = await makeMachine();
    const issue = await seedIssue(reporter, source);
    const sourceIssueNumber = issue.issueNumber;
    await clearTimelineEventsForMachine(source.id);
    await clearTimelineEventsForMachine(dest.id);

    const { reassignIssueMachine } = await import("~/services/issues");
    await reassignIssueMachine({
      issueId: issue.id,
      newMachineInitials: dest.initials,
      userId: reporter.id,
    });

    const sourceRows = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, source.id));
    const destRows = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, dest.id));

    expect(sourceRows).toHaveLength(1);
    expect(destRows).toHaveLength(1);

    expect(sourceRows[0].sourceType).toBe("issue");
    expect(sourceRows[0].tag).toBe("issue");
    expect(sourceRows[0].eventData).toMatchObject({
      kind: "issue_reassigned_out",
      issueId: issue.id,
      issueNumber: sourceIssueNumber,
      toMachineId: dest.id,
      toMachineName: dest.name,
    });

    expect(destRows[0].sourceType).toBe("issue");
    expect(destRows[0].tag).toBe("issue");
    expect(destRows[0].eventData).toMatchObject({
      kind: "issue_reassigned_in",
      issueId: issue.id,
      // issueNumber on destination is the NEW number (1, since it's the dest's first issue)
      fromMachineId: source.id,
      fromMachineName: source.name,
    });

    // Both events share the same createdAt (same transaction → Postgres now() is constant in a tx)
    expect(sourceRows[0].createdAt.getTime()).toBe(
      destRows[0].createdAt.getTime()
    );
  });

  it("uses the NEW issue number for the destination row, OLD for the source row", async () => {
    const db = await getTestDb();
    const reporter = await makeUser();
    const source = await makeMachine();
    const dest = await makeMachine();
    // Seed two issues on dest first so the next reservation lands at issueNumber=3
    await seedIssue(reporter, dest);
    await seedIssue(reporter, dest);
    const issue = await seedIssue(reporter, source);
    const sourceIssueNumber = issue.issueNumber; // 1 on source
    await clearTimelineEventsForMachine(source.id);
    await clearTimelineEventsForMachine(dest.id);

    const { reassignIssueMachine } = await import("~/services/issues");
    await reassignIssueMachine({
      issueId: issue.id,
      newMachineInitials: dest.initials,
      userId: reporter.id,
    });

    const sourceRows = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, source.id));
    const destRows = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, dest.id));

    expect(sourceRows[0].eventData).toMatchObject({
      kind: "issue_reassigned_out",
      issueNumber: sourceIssueNumber, // OLD number (was 1 on source)
    });
    expect(destRows[0].eventData).toMatchObject({
      kind: "issue_reassigned_in",
      issueNumber: 3, // NEW number (third issue on dest)
    });
  });
});
