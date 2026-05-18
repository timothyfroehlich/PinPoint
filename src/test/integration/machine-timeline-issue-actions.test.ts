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
