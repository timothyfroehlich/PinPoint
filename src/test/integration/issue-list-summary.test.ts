import { describe, expect, it, vi } from "vitest";
import { setupTestDb, getTestDb } from "~/test/setup/pglite";
import { createTestIssue, createTestMachine } from "~/test/helpers/factories";
import { issues, machines } from "~/server/db/schema";
import { loadIssueListPage } from "~/lib/issues/list-page";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

/**
 * Issue-list Summary Widget counts (issue-widgets §2–§5): All counts every
 * issue on the host's On the Floor machines; Filtered follows the list's
 * filters across all pages.
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
    ]);
  }

  it("counts All as every issue on On the Floor machines, open or closed", async () => {
    await seed();
    const { summary } = await loadIssueListPage(
      { severity: ["major"] },
      { isAdmin: false }
    );

    // All ignores the list's filters but skips CC, which is off the floor.
    expect(summary.status.total).toBe(3);
    expect(summary.status.open).toBe(2);
    expect(summary.status.byStatus).toMatchObject({
      new: 1,
      in_progress: 1,
      fixed: 1,
    });
    expect(summary.severity.machinesWithOpenIssues).toBe(2);
    expect(summary.severity.bySeverity).toEqual({
      cosmetic: 0,
      minor: 0,
      major: 1,
      unplayable: 1,
    });
    expect(summary.priority.byPriority).toEqual({
      low: 0,
      medium: 1,
      high: 1,
    });
  });

  it("counts Filtered with the list's filters and All within a group's scope", async () => {
    await seed();
    const { summary } = await loadIssueListPage(
      {
        machine: ["AA", "CC"],
        severity: ["unplayable"],
        includeInactiveMachines: true,
        severityWidget: "filtered",
      },
      { isAdmin: false, scopeMachineInitials: ["AA", "CC"] }
    );

    // Status stays All: the group's On the Floor machine AA only.
    expect(summary.status.total).toBe(2);
    expect(summary.status.open).toBe(1);
    // Severity is Filtered: open unplayable issues on AA and CC.
    expect(summary.severity.open).toBe(2);
    expect(summary.severity.machinesWithOpenIssues).toBe(2);
    expect(summary.severity.bySeverity.unplayable).toBe(2);
  });
});
