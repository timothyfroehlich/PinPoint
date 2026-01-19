import { describe, it, expect, beforeEach } from "vitest";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { issues, machines, userProfiles } from "~/server/db/schema";
import { buildWhereConditions } from "~/lib/issues/filters";
import { and, type SQL } from "drizzle-orm";

describe("Issue Filtering Integration", () => {
  setupTestDb();

  const ALICE_ID = "00000000-0000-0000-0000-000000000001";
  const BOB_ID = "00000000-0000-0000-0000-000000000002";
  const CHARLIE_ID = "00000000-0000-0000-0000-000000000003";

  const ISSUE_1_ID = "00000000-0000-0000-0000-0000000000e1";
  const ISSUE_2_ID = "00000000-0000-0000-0000-0000000000e2";
  const ISSUE_3_ID = "00000000-0000-0000-0000-0000000000e3";

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
        consistency: "constant",
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
        consistency: "intermittent",
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
        consistency: "constant",
        reportedBy: ALICE_ID,
        assignedTo: CHARLIE_ID,
        createdAt: new Date("2026-01-03 10:00:00"),
        updatedAt: new Date("2026-01-03 10:00:00"),
      },
    ]);
  });

  const queryIssues = async (where: SQL[]) => {
    const db = await getTestDb();
    return await db
      .select()
      .from(issues)
      .where(and(...where));
  };

  it("filters by status (OR logic)", async () => {
    const where = buildWhereConditions({ status: ["new", "confirmed"] });
    const results = await queryIssues(where);
    expect(results).toHaveLength(2);
    expect(results.map((i) => i.id)).toContain(ISSUE_1_ID);
    expect(results.map((i) => i.id)).toContain(ISSUE_2_ID);
  });

  it("filters by search query (title match)", async () => {
    const where = buildWhereConditions({ q: "Gumball" });
    const results = await queryIssues(where);
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe(ISSUE_2_ID);
  });

  it("filters by search query (issue number match)", async () => {
    const where = buildWhereConditions({ q: "1" });
    const results = await queryIssues(where);
    expect(results.some((i) => i.id === ISSUE_1_ID)).toBe(true);
  });

  it("filters by search query (machine initials match)", async () => {
    const where = buildWhereConditions({ q: "AFM" });
    const results = await queryIssues(where);
    expect(results).toHaveLength(2);
    expect(results.map((i) => i.id)).toContain(ISSUE_1_ID);
    expect(results.map((i) => i.id)).toContain(ISSUE_3_ID);
  });

  it("filters by combined status and machine initials", async () => {
    const where = buildWhereConditions({
      status: ["new"],
      machine: ["AFM"],
    });
    const results = await queryIssues(where);
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe(ISSUE_1_ID);
  });

  it("filters by severity and priority", async () => {
    const where = buildWhereConditions({
      severity: ["major"],
      priority: ["high"],
    });
    const results = await queryIssues(where);
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe(ISSUE_1_ID);
  });
});
