import { describe, it, expect, beforeEach } from "vitest";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { issues, machines, userProfiles } from "~/server/db/schema";
import { buildWhereConditions } from "~/lib/issues/filters-queries";
import { and, type SQL, type InferSelectModel } from "drizzle-orm";

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
