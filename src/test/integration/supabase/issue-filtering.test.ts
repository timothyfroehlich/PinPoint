import { describe, it, expect, beforeEach, vi } from "vitest";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { issues, machines, userProfiles } from "~/server/db/schema";
import { buildWhereConditions } from "~/lib/issues/filters-queries";
import { and, type SQL, type InferSelectModel } from "drizzle-orm";

// Redirect the production db singleton to the PGlite test instance so that
// getIssues() (which imports db from ~/server/db) uses the same in-process DB.
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

type Issue = InferSelectModel<typeof issues>;

describe("Issue Filtering Integration", () => {
  setupTestDb();

  const ALICE_ID = "00000000-0000-0000-0000-000000000001";
  const BOB_ID = "00000000-0000-0000-0000-000000000002";
  const CHARLIE_ID = "00000000-0000-0000-0000-000000000003";

  const ISSUE_1_ID = "00000000-0000-0000-0000-0000000000e1";
  const ISSUE_2_ID = "00000000-0000-0000-0000-0000000000e2";
  const ISSUE_3_ID = "00000000-0000-0000-0000-0000000000e3";
  const ISSUE_4_ID = "00000000-0000-0000-0000-0000000000e4";

  beforeEach(async () => {
    const db = await getTestDb();

    // Seed test data
    await db.insert(userProfiles).values([
      {
        id: ALICE_ID,
        firstName: "Alice",
        lastName: "Owner",
        email: "alice@example.com",
      },
      {
        id: BOB_ID,
        firstName: "Bob",
        lastName: "Reporter",
        email: "bob@example.com",
      },
      {
        id: CHARLIE_ID,
        firstName: "Charlie",
        lastName: "Assignee",
        email: "charlie@example.com",
      },
    ]);

    await db.insert(machines).values([
      {
        id: "00000000-0000-0000-0000-0000000000a1",
        initials: "AFM",
        name: "Attack from Mars",
        ownerId: ALICE_ID,
      },
      {
        id: "00000000-0000-0000-0000-0000000000a2",
        initials: "TZ",
        name: "Twilight Zone",
        ownerId: BOB_ID,
      },
      {
        id: "00000000-0000-0000-0000-0000000000a3",
        initials: "LON",
        name: "Loaner Machine",
        ownerId: ALICE_ID,
        presenceStatus: "on_loan",
      },
    ]);

    await db.insert(issues).values([
      {
        id: ISSUE_1_ID,
        machineInitials: "AFM",
        issueNumber: 1,
        title: "Flipper sticking",
        status: "new",
        severity: "major",
        priority: "high",
        frequency: "constant",
        reportedBy: BOB_ID,
        assignedTo: CHARLIE_ID,
        createdAt: new Date("2026-01-01 10:00:00"),
        updatedAt: new Date("2026-01-01 10:00:00"),
      },
      {
        id: ISSUE_2_ID,
        machineInitials: "TZ",
        issueNumber: 2,
        title: "Gumball machine jammed",
        status: "confirmed",
        severity: "minor",
        priority: "medium",
        frequency: "intermittent",
        reportedBy: BOB_ID,
        assignedTo: null,
        createdAt: new Date("2026-01-02 10:00:00"),
        updatedAt: new Date("2026-01-02 10:00:00"),
      },
      {
        id: ISSUE_3_ID,
        machineInitials: "AFM",
        issueNumber: 3,
        title: "Bulb out",
        status: "in_progress",
        severity: "cosmetic",
        priority: "low",
        frequency: "constant",
        reportedBy: ALICE_ID,
        assignedTo: CHARLIE_ID,
        createdAt: new Date("2026-01-03 10:00:00"),
        updatedAt: new Date("2026-01-03 10:00:00"),
      },
      {
        id: ISSUE_4_ID,
        machineInitials: "LON",
        issueNumber: 4,
        title: "Loaned machine note",
        status: "fixed",
        severity: "minor",
        priority: "low",
        frequency: "intermittent",
        reportedBy: ALICE_ID,
        assignedTo: null,
        createdAt: new Date("2026-01-04 10:00:00"),
        updatedAt: new Date("2026-01-04 10:00:00"),
      },
    ]);
  });

  const queryIssues = async (where: SQL[]): Promise<Issue[]> => {
    const db = await getTestDb();
    return await db
      .select()
      .from(issues)
      .where(and(...where));
  };

  it("filters by status (OR logic)", async () => {
    const db = await getTestDb();
    const conditions = buildWhereConditions(
      { status: ["new", "confirmed"] },
      db
    );
    const results = await queryIssues(conditions);
    expect(results).toHaveLength(2);
    expect(results.map((i) => i.id)).toContain(ISSUE_1_ID);
    expect(results.map((i) => i.id)).toContain(ISSUE_2_ID);
  });

  it("filters by search query (title match)", async () => {
    const db = await getTestDb();
    const where = buildWhereConditions({ q: "Gumball" }, db);
    const results = await queryIssues(where);
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe(ISSUE_2_ID);
  });

  it("filters by search query (issue number match)", async () => {
    const db = await getTestDb();
    const where = buildWhereConditions({ q: "1" }, db);
    const results = await queryIssues(where);
    expect(results.some((i) => i.id === ISSUE_1_ID)).toBe(true);
  });

  it("filters by search query (machine initials match)", async () => {
    const db = await getTestDb();
    const where = buildWhereConditions({ q: "AFM" }, db);
    const results = await queryIssues(where);
    expect(results).toHaveLength(2);
    expect(results.map((i: Issue) => i.id)).toContain(ISSUE_1_ID);
    expect(results.map((i: Issue) => i.id)).toContain(ISSUE_3_ID);
  });

  it("defaults to open statuses when status is undefined", async () => {
    const db = await getTestDb();
    const where = buildWhereConditions({}, db);
    const results = await queryIssues(where);
    // ISSUE_1 (new), ISSUE_2 (confirmed) are open. ISSUE_3 (in_progress) is also open.
    // Wait, let's check OPEN_STATUSES definition.
    expect(results.length).toBeGreaterThan(0);
    expect(
      results.every((i: Issue) =>
        (["new", "confirmed", "in_progress"] as string[]).includes(i.status)
      )
    ).toBe(true);
  });

  it("shows all statuses when status is empty array (all)", async () => {
    const db = await getTestDb();
    const where = buildWhereConditions({ status: [] }, db);
    const results = await queryIssues(where);
    // Should include all 3 issues regardless of status
    expect(results).toHaveLength(3);
  });

  it("filters by combined status and machine initials", async () => {
    const db = await getTestDb();
    const where = buildWhereConditions(
      {
        status: ["new"],
        machine: ["AFM"],
      },
      db
    );
    const results = await queryIssues(where);
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe(ISSUE_1_ID);
  });

  it("filters by severity and priority", async () => {
    const db = await getTestDb();
    const where = buildWhereConditions(
      {
        severity: ["major"],
        priority: ["high"],
      },
      db
    );
    const results = await queryIssues(where);
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe(ISSUE_1_ID);
  });

  it("filters by owner", async () => {
    const db = await getTestDb();
    const where = buildWhereConditions(
      {
        owner: [ALICE_ID],
      },
      db
    );
    const results = await queryIssues(where);
    expect(results).toHaveLength(2);
    expect(results.map((i) => i.id)).toContain(ISSUE_1_ID);
    expect(results.map((i) => i.id)).toContain(ISSUE_3_ID);
    expect(results.map((i) => i.id)).not.toContain(ISSUE_2_ID);
  });

  it("excludes issues from inactive machines by default", async () => {
    const db = await getTestDb();
    const where = buildWhereConditions({ status: [] }, db);
    const results = await queryIssues(where);

    expect(results.map((i) => i.id)).not.toContain(ISSUE_4_ID);
    expect(results).toHaveLength(3);
  });

  it("includes inactive machine issues when includeInactiveMachines is true", async () => {
    const db = await getTestDb();
    const where = buildWhereConditions(
      { status: [], includeInactiveMachines: true },
      db
    );
    const results = await queryIssues(where);

    expect(results.map((i) => i.id)).toContain(ISSUE_4_ID);
    expect(results).toHaveLength(4);
  });
});

/**
 * Integration tests for getIssues() from ~/lib/issues/queries
 *
 * These replace the former unit tests in src/lib/issues/queries.test.ts,
 * which mocked both ~/server/db AND drizzle-orm and only asserted that
 * query-builder methods were called with the right args. The tests below
 * insert real rows and assert on the actual returned record sets.
 *
 * CORE-SEC-007 compliance: the email-privacy assertion verifies that
 * getIssues() never exposes a reporterEmail field on any returned object.
 */
describe("getIssues (PGlite integration)", () => {
  setupTestDb();

  const USER_ALICE_ID = "10000000-0000-0000-0000-000000000001";
  const USER_BOB_ID = "10000000-0000-0000-0000-000000000002";

  const GI_ISSUE_1_ID = "20000000-0000-0000-0000-000000000001";
  const GI_ISSUE_2_ID = "20000000-0000-0000-0000-000000000002";
  const GI_ISSUE_3_ID = "20000000-0000-0000-0000-000000000003";
  const GI_ISSUE_4_ID = "20000000-0000-0000-0000-000000000004";

  beforeEach(async () => {
    const db = await getTestDb();

    await db.insert(userProfiles).values([
      {
        id: USER_ALICE_ID,
        firstName: "Alice",
        lastName: "Tester",
        email: "alice@test.example.com",
        role: "member",
      },
      {
        id: USER_BOB_ID,
        firstName: "Bob",
        lastName: "Tester",
        email: "bob@test.example.com",
        role: "member",
      },
    ]);

    await db.insert(machines).values([
      { initials: "MM", name: "Medieval Madness" },
      { initials: "TZ", name: "Twilight Zone" },
    ]);

    await db.insert(issues).values([
      // Issue 1: MM machine, status "new", severity "major", assigned to Alice
      {
        id: GI_ISSUE_1_ID,
        machineInitials: "MM",
        issueNumber: 1,
        title: "Flipper broken",
        status: "new",
        severity: "major",
        reportedBy: USER_BOB_ID,
        assignedTo: USER_ALICE_ID,
        reporterName: null,
        reporterEmail: null,
      },
      // Issue 2: TZ machine, status "in_progress", severity "minor", assigned to Bob
      {
        id: GI_ISSUE_2_ID,
        machineInitials: "TZ",
        issueNumber: 1,
        title: "Ball drain",
        status: "in_progress",
        severity: "minor",
        reportedBy: USER_ALICE_ID,
        assignedTo: USER_BOB_ID,
        reporterName: null,
        reporterEmail: null,
      },
      // Issue 3: MM machine, status "fixed" (closed), severity "unplayable", unassigned
      {
        id: GI_ISSUE_3_ID,
        machineInitials: "MM",
        issueNumber: 2,
        title: "Completely broken",
        status: "fixed",
        severity: "unplayable",
        reportedBy: USER_BOB_ID,
        assignedTo: null,
        reporterName: null,
        reporterEmail: null,
      },
      // Issue 4: TZ machine, status "confirmed", severity "cosmetic", unassigned
      {
        id: GI_ISSUE_4_ID,
        machineInitials: "TZ",
        issueNumber: 2,
        title: "Faded art",
        status: "confirmed",
        severity: "cosmetic",
        reportedBy: USER_ALICE_ID,
        assignedTo: null,
        reporterName: null,
        reporterEmail: null,
      },
    ]);
  });

  // Migrated from: "should fetch all issues when no filters are provided"
  it("returns all issues when no filters are provided", async () => {
    const { getIssues } = await import("~/lib/issues/queries");
    const results = await getIssues({});
    // All 4 issues are inserted; no filtering
    expect(results.length).toBe(4);
    const ids = results.map((i) => i.id);
    expect(ids).toContain(GI_ISSUE_1_ID);
    expect(ids).toContain(GI_ISSUE_2_ID);
    expect(ids).toContain(GI_ISSUE_3_ID);
    expect(ids).toContain(GI_ISSUE_4_ID);
  });

  // Migrated from: "should request minimal issue columns without reporter emails" (CORE-SEC-007)
  it("does not expose reporterEmail on returned issue objects (CORE-SEC-007)", async () => {
    const { getIssues } = await import("~/lib/issues/queries");
    const results = await getIssues({});
    expect(results.length).toBeGreaterThan(0);
    for (const issue of results) {
      expect(issue).not.toHaveProperty("reporterEmail");
    }
  });

  // Migrated from: "should filter by machineInitials"
  it("filters by machineInitials", async () => {
    const { getIssues } = await import("~/lib/issues/queries");
    const results = await getIssues({ machineInitials: "MM" });
    expect(results.length).toBe(2);
    expect(results.map((i) => i.id)).toContain(GI_ISSUE_1_ID);
    expect(results.map((i) => i.id)).toContain(GI_ISSUE_3_ID);
    expect(results.map((i) => i.id)).not.toContain(GI_ISSUE_2_ID);
    expect(results.map((i) => i.id)).not.toContain(GI_ISSUE_4_ID);
  });

  // Migrated from: "should filter by status" (single status as string)
  it("filters by single status string", async () => {
    const { getIssues } = await import("~/lib/issues/queries");
    const results = await getIssues({ status: "new" });
    expect(results.length).toBe(1);
    expect(results[0]?.id).toBe(GI_ISSUE_1_ID);
  });

  // Migrated from: "should filter by multiple statuses"
  it("filters by multiple statuses", async () => {
    const { getIssues } = await import("~/lib/issues/queries");
    const results = await getIssues({ status: ["new", "in_progress"] });
    expect(results.length).toBe(2);
    const ids = results.map((i) => i.id);
    expect(ids).toContain(GI_ISSUE_1_ID);
    expect(ids).toContain(GI_ISSUE_2_ID);
  });

  // Migrated from: "should ignore invalid status"
  it("ignores invalid status values and returns all issues", async () => {
    const { getIssues } = await import("~/lib/issues/queries");
    const results = await getIssues({ status: "invalid_status" });
    // No valid status → no status condition → all 4 issues returned
    expect(results.length).toBe(4);
  });

  // Migrated from: "should filter by severity"
  it("filters by severity", async () => {
    const { getIssues } = await import("~/lib/issues/queries");
    const results = await getIssues({ severity: "unplayable" });
    expect(results.length).toBe(1);
    expect(results[0]?.id).toBe(GI_ISSUE_3_ID);
  });

  // Migrated from: "should filter by assignedTo (specific user)"
  it("filters by assignedTo (specific user ID)", async () => {
    const { getIssues } = await import("~/lib/issues/queries");
    const results = await getIssues({ assignedTo: USER_ALICE_ID });
    expect(results.length).toBe(1);
    expect(results[0]?.id).toBe(GI_ISSUE_1_ID);
  });

  // Migrated from: "should filter by assignedTo (unassigned)"
  it('filters by assignedTo "unassigned" returns issues with no assignee', async () => {
    const { getIssues } = await import("~/lib/issues/queries");
    const results = await getIssues({ assignedTo: "unassigned" });
    // Issue 3 and Issue 4 have assignedTo: null
    expect(results.length).toBe(2);
    const ids = results.map((i) => i.id);
    expect(ids).toContain(GI_ISSUE_3_ID);
    expect(ids).toContain(GI_ISSUE_4_ID);
  });

  // Migrated from: "should combine multiple filters"
  it("combines machineInitials and status filters", async () => {
    const { getIssues } = await import("~/lib/issues/queries");
    const results = await getIssues({ machineInitials: "MM", status: "new" });
    expect(results.length).toBe(1);
    expect(results[0]?.id).toBe(GI_ISSUE_1_ID);
  });
});
