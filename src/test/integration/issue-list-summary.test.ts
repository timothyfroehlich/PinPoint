import { describe, expect, it, vi } from "vitest";
import { setupTestDb, getTestDb } from "~/test/setup/pglite";
import {
  createTestIssue,
  createTestMachine,
  createTestUser,
} from "~/test/helpers/factories";
import {
  invitedUsers,
  issues,
  machines,
  userProfiles,
} from "~/server/db/schema";
import { loadIssueListPage } from "~/lib/issues/list-page";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

/**
 * Issue-list Summary Widget counts (issue-widgets §2–§5): every issue, open or
 * closed, on the host's On the Floor machines (§2.2), whatever search and
 * filters the list carries (widgets §3.1).
 */
describe("issue list Summary Widget counts", () => {
  setupTestDb();

  async function seed(): Promise<void> {
    const db = await getTestDb();
    await db.insert(machines).values([
      createTestMachine({ initials: "AA", name: "Alpha" }),
      createTestMachine({ initials: "BB", name: "Bravo" }),
      createTestMachine({
        initials: "CC",
        name: "Charlie",
        presenceStatus: "off_the_floor",
      }),
      createTestMachine({
        initials: "DD",
        name: "Delta",
        presenceStatus: "removed",
      }),
    ]);
    await db.insert(issues).values([
      createTestIssue("AA", {
        issueNumber: 1,
        status: "new",
        severity: "unplayable",
        priority: "high",
      }),
      createTestIssue("AA", {
        issueNumber: 2,
        status: "fixed",
        severity: "minor",
        priority: "low",
      }),
      createTestIssue("BB", {
        issueNumber: 1,
        status: "in_progress",
        severity: "major",
        priority: "medium",
      }),
      createTestIssue("CC", {
        issueNumber: 1,
        status: "new",
        severity: "unplayable",
        priority: "high",
      }),
      createTestIssue("DD", {
        issueNumber: 1,
        status: "need_help",
        severity: "unplayable",
        priority: "high",
      }),
    ]);
  }

  it("counts open and closed issues on On the Floor machines, ignoring the list's search and filters", async () => {
    await seed();
    const { summary, totalCount } = await loadIssueListPage(
      {
        q: "nothing matches this",
        severity: ["major"],
        presence: [],
      },
      { isAdmin: false }
    );

    // The list itself matches nothing; the widgets still count the scope,
    // skipping CC (off the floor) and DD (removed).
    expect(totalCount).toBe(0);
    expect(summary).toEqual({
      open: 2,
      byStatus: {
        new: 1,
        confirmed: 0,
        in_progress: 1,
        need_parts: 0,
        need_help: 0,
        wait_owner: 0,
        fixed: 1,
        wont_fix: 0,
        wai: 0,
        no_repro: 0,
        duplicate: 0,
      },
      bySeverity: { cosmetic: 0, minor: 0, major: 1, unplayable: 1 },
      byPriority: { low: 0, medium: 1, high: 1 },
    });
  });

  it("counts only a group Issues tab's On the Floor machines", async () => {
    await seed();
    const { summary } = await loadIssueListPage(
      { machine: ["BB"], presence: [] },
      { isAdmin: false, scopeMachineInitials: ["AA", "CC", "DD"] }
    );

    // The group holds AA, CC, and DD; only AA is on the floor. The tab's
    // machine filter (BB) never narrows or widens the widgets.
    expect(summary.open).toBe(1);
    expect(summary.bySeverity).toEqual({
      cosmetic: 0,
      minor: 0,
      major: 0,
      unplayable: 1,
    });
  });
});

/**
 * CORE-SEC-007: the list loader runs on public pages, so no email reaches the
 * page — not the guest reporter email on the issue row, not a reporter or
 * assignee account's email through a joined relation, and not a user's email
 * through the filter and assignee user lists.
 */
describe("issue list loader email privacy (CORE-SEC-007)", () => {
  setupTestDb();

  it("returns no reporter, assignee, or user email anywhere in the page data", async () => {
    const db = await getTestDb();
    const member = createTestUser({ email: "member-reporter@example.com" });
    const assignee = createTestUser({ email: "assignee@example.com" });
    await db.insert(userProfiles).values([member, assignee]);
    const [invited] = await db
      .insert(invitedUsers)
      .values({
        firstName: "Invited",
        lastName: "Reporter",
        email: "invited-reporter@example.com",
      })
      .returning();
    if (!invited) throw new Error("Invited user insert returned no row");
    await db
      .insert(machines)
      .values(createTestMachine({ initials: "AA", ownerId: member.id }));
    await db.insert(issues).values([
      createTestIssue("AA", {
        issueNumber: 1,
        reportedBy: member.id,
        assignedTo: assignee.id,
      }),
      createTestIssue("AA", {
        issueNumber: 2,
        invitedReportedBy: invited.id,
      }),
      createTestIssue("AA", {
        issueNumber: 3,
        reporterName: "Named Guest",
        reporterEmail: "named-guest@example.com",
      }),
      createTestIssue("AA", {
        issueNumber: 4,
        reporterEmail: "email-only-guest@example.com",
      }),
    ]);

    const page = await loadIssueListPage({ status: [] }, { isAdmin: false });

    // Every seeded issue and user loaded, so the absence below is meaningful.
    expect(page.issuesList).toHaveLength(4);
    expect(page.people.map((user) => user.id)).toEqual(
      expect.arrayContaining([member.id, assignee.id, invited.id])
    );
    expect(JSON.stringify(page)).not.toMatch(/@example\.com/);
  });
});
