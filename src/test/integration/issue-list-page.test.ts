import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import {
  createTestComment,
  createTestIssue,
  createTestMachine,
  createTestUser,
} from "~/test/helpers/factories";
import {
  issueComments,
  issues,
  machines,
  userProfiles,
} from "~/server/db/schema";
import { loadIssueListPage } from "~/lib/issues/list-page";
import type { IssueSort } from "~/lib/issues/filters";
import { formatIssueId } from "~/lib/issues/utils";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

/**
 * Issue list sorting and row data (issues-list §3.4, §5.1–§5.3), run through
 * the real list loader against PGlite: Severity and Priority sort by rank,
 * Assignee by display name with unassigned last, and every sort ends in
 * issue ID order.
 */
describe("issue list page: sorting and comment counts", () => {
  setupTestDb();

  // Account ids sort opposite to their names, so an id sort cannot pass for
  // a name sort.
  const ALICE = "ffffffff-ffff-4fff-8fff-ffffffffffff";
  const BOB = "00000000-0000-4000-8000-000000000000";
  const T1 = new Date("2026-03-01T00:00:00Z");
  const T2 = new Date("2026-03-02T00:00:00Z");
  const T3 = new Date("2026-03-03T00:00:00Z");

  beforeEach(async () => {
    const db = await getTestDb();
    await db
      .insert(userProfiles)
      .values([
        createTestUser({ id: ALICE, firstName: "Alice", lastName: "Zed" }),
        createTestUser({ id: BOB, firstName: "Bob", lastName: "Young" }),
      ]);
    await db
      .insert(machines)
      .values([
        createTestMachine({ initials: "AA", name: "Alpha" }),
        createTestMachine({ initials: "BB", name: "Bravo" }),
      ]);
    await db.insert(issues).values([
      createTestIssue("AA", {
        issueNumber: 1,
        severity: "unplayable",
        priority: "low",
        assignedTo: BOB,
        createdAt: T1,
        updatedAt: T2,
      }),
      createTestIssue("AA", {
        issueNumber: 2,
        severity: "minor",
        priority: "high",
        createdAt: T2,
        updatedAt: T3,
      }),
      createTestIssue("AA", {
        issueNumber: 3,
        severity: "major",
        priority: "medium",
        createdAt: T2,
        updatedAt: T1,
      }),
      createTestIssue("BB", {
        issueNumber: 1,
        severity: "unplayable",
        priority: "high",
        assignedTo: ALICE,
        createdAt: T1,
        updatedAt: T1,
      }),
      createTestIssue("BB", {
        issueNumber: 2,
        severity: "cosmetic",
        priority: "medium",
        assignedTo: BOB,
        createdAt: T3,
        updatedAt: T2,
      }),
    ]);
  });

  async function orderFor(sort: IssueSort): Promise<string[]> {
    const { issuesList } = await loadIssueListPage(
      { sort, pageSize: 50 },
      { isAdmin: false }
    );
    return issuesList.map((i) =>
      formatIssueId(i.machineInitials, i.issueNumber)
    );
  }

  it.each<[IssueSort, string[]]>([
    ["updated_desc", ["AA-02", "AA-01", "BB-02", "AA-03", "BB-01"]],
    ["updated_asc", ["AA-03", "BB-01", "AA-01", "BB-02", "AA-02"]],
    ["created_desc", ["BB-02", "AA-02", "AA-03", "AA-01", "BB-01"]],
    ["created_asc", ["AA-01", "BB-01", "AA-02", "AA-03", "BB-02"]],
    ["issue_asc", ["AA-01", "AA-02", "AA-03", "BB-01", "BB-02"]],
    ["issue_desc", ["BB-02", "BB-01", "AA-03", "AA-02", "AA-01"]],
    // By rank, not alphabet: alphabetical would put Minor above Major.
    ["severity_desc", ["AA-01", "BB-01", "AA-03", "AA-02", "BB-02"]],
    ["severity_asc", ["BB-02", "AA-02", "AA-03", "AA-01", "BB-01"]],
    ["priority_desc", ["AA-02", "BB-01", "AA-03", "BB-02", "AA-01"]],
    ["priority_asc", ["AA-01", "AA-03", "BB-02", "AA-02", "BB-01"]],
    // Name order, unassigned last in both directions; Bob's two issues tie
    // on Updated, so issue ID breaks the tie.
    ["assignee_asc", ["BB-01", "AA-01", "BB-02", "AA-02", "AA-03"]],
    ["assignee_desc", ["AA-01", "BB-02", "BB-01", "AA-02", "AA-03"]],
  ])("sorts %s deterministically", async (sort, expected) => {
    expect(await orderFor(sort)).toEqual(expected);
  });

  it("pages a tied sort without repeating or skipping issues", async () => {
    const page = async (n: number): Promise<string[]> => {
      const { issuesList } = await loadIssueListPage(
        { sort: "severity_desc", pageSize: 2, page: n },
        { isAdmin: false }
      );
      return issuesList.map((i) =>
        formatIssueId(i.machineInitials, i.issueNumber)
      );
    };
    const all = [...(await page(1)), ...(await page(2)), ...(await page(3))];
    expect(all).toEqual(["AA-01", "BB-01", "AA-03", "AA-02", "BB-02"]);
  });

  it("counts people's comments on each row, not system timeline entries", async () => {
    const db = await getTestDb();
    const rows = await db.query.issues.findMany({
      columns: { id: true, machineInitials: true, issueNumber: true },
    });
    const aa1 = rows.find(
      (r) => r.machineInitials === "AA" && r.issueNumber === 1
    );
    if (!aa1) throw new Error("seed missing AA-01");
    await db.insert(issueComments).values([
      createTestComment(aa1.id, { authorId: ALICE }),
      createTestComment(aa1.id, { authorId: BOB }),
      createTestComment(aa1.id, {
        isSystem: true,
        content: null,
        eventData: { type: "status_changed", from: "new", to: "confirmed" },
      }),
    ]);

    const { issuesList } = await loadIssueListPage(
      { sort: "issue_asc", pageSize: 50 },
      { isAdmin: false }
    );
    const counts = Object.fromEntries(
      issuesList.map((i) => [
        formatIssueId(i.machineInitials, i.issueNumber),
        i.commentCount,
      ])
    );
    expect(counts).toEqual({
      "AA-01": 2,
      "AA-02": 0,
      "AA-03": 0,
      "BB-01": 0,
      "BB-02": 0,
    });
  });
});
