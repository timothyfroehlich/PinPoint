/**
 * Integration Test: Dashboard Queries with PGlite
 *
 * Tests dashboard-specific queries:
 * - Issues assigned to current user
 * - Recently reported issues
 * - Unplayable machines
 * - Dashboard stats
 */

import { randomUUID } from "node:crypto";
import { describe, it, expect } from "vitest";
import { eq, desc, and, ne, sql } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { machines, issues, userProfiles } from "~/server/db/schema";
import {
  createTestMachine,
  createTestIssue,
  createTestUser,
} from "~/test/helpers/factories";
import {
  deriveMachineStatus,
  type IssueForStatus,
} from "~/lib/machines/status";

describe("Dashboard Queries (PGlite)", () => {
  // Set up worker-scoped PGlite and auto-cleanup after each test
  setupTestDb();

  describe("Assigned Issues Query", () => {
    it("should return only open issues assigned to specific user", async () => {
      const db = await getTestDb();

      // Create users
      const user1 = createTestUser({ firstName: "User", lastName: "1" });
      const user2 = createTestUser({ firstName: "User", lastName: "2" });
      const [testUser1] = await db
        .insert(userProfiles)
        .values(user1)
        .returning();
      const [testUser2] = await db
        .insert(userProfiles)
        .values(user2)
        .returning();

      // Create machine
      const testMachine = createTestMachine({ initials: "MM" });
      const [machine] = await db
        .insert(machines)
        .values(testMachine)
        .returning();

      // Create issues: 2 for user1 (1 open, 1 resolved), 1 for user2
      await db.insert(issues).values([
        createTestIssue(machine.initials, {
          title: "Issue 1 for User 1",
          issueNumber: 1,
          assignedTo: testUser1.id,
          status: "new",
        }),
        createTestIssue(machine.initials, {
          title: "Issue 2 for User 1 (resolved)",
          issueNumber: 2,
          assignedTo: testUser1.id,
          status: "resolved",
        }),
        createTestIssue(machine.initials, {
          title: "Issue for User 2",
          issueNumber: 3,
          assignedTo: testUser2.id,
          status: "new",
        }),
      ]);

      // Query assigned issues for user1 (dashboard query pattern)
      const assignedIssues = await db.query.issues.findMany({
        where: and(
          eq(issues.assignedTo, testUser1.id),
          ne(issues.status, "resolved")
        ),
        orderBy: desc(issues.createdAt),
        with: {
          machine: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Should only return 1 open issue for user1
      expect(assignedIssues).toHaveLength(1);
      expect(assignedIssues[0].title).toBe("Issue 1 for User 1");
    });

    it("should return empty array when user has no assigned issues", async () => {
      const db = await getTestDb();

      const userId = randomUUID();

      // Query with no data
      const assignedIssues = await db.query.issues.findMany({
        where: and(
          eq(issues.assignedTo, userId),
          ne(issues.status, "resolved")
        ),
      });

      expect(assignedIssues).toHaveLength(0);
    });
  });

  describe("Recently Reported Issues Query", () => {
    it("should return last 10 issues with machine and reporter", async () => {
      const db = await getTestDb();

      // Create user and machine
      const testUser = createTestUser({
        firstName: "Reporter",
        lastName: "User",
      });
      const [user] = await db.insert(userProfiles).values(testUser).returning();

      const testMachine = createTestMachine({ initials: "RR" });
      const [machine] = await db
        .insert(machines)
        .values(testMachine)
        .returning();

      // Create 12 issues to test limit of 10
      const issuesData = Array.from({ length: 12 }, (_, i) =>
        createTestIssue(machine.initials, {
          title: `Issue ${i + 1}`,
          issueNumber: i + 1,
          reportedBy: user.id,
          createdAt: new Date(Date.now() - (12 - i) * 1000), // Stagger timestamps
        })
      );
      await db.insert(issues).values(issuesData);

      // Query recent issues (dashboard query pattern)
      const recentIssues = await db.query.issues.findMany({
        orderBy: desc(issues.createdAt),
        limit: 10,
        with: {
          machine: {
            columns: {
              id: true,
              name: true,
            },
          },
          reportedByUser: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Should return exactly 10 (most recent)
      expect(recentIssues).toHaveLength(10);
      expect(recentIssues[0].title).toBe("Issue 12"); // Most recent
      expect(recentIssues[9].title).toBe("Issue 3"); // 10th most recent
    });
  });

  describe("Unplayable Machines Query", () => {
    it("should return only machines with open unplayable issues", async () => {
      const db = await getTestDb();

      // Create 3 machines
      const [machine1, machine2, machine3] = await db
        .insert(machines)
        .values([
          createTestMachine({ name: "Unplayable Machine", initials: "UM" }),
          createTestMachine({ name: "Playable Machine", initials: "PM" }),
          createTestMachine({ name: "Operational Machine", initials: "OM" }),
        ])
        .returning();

      // Machine 1: unplayable issue (open)
      await db.insert(issues).values(
        createTestIssue(machine1.initials, {
          issueNumber: 1,
          severity: "unplayable",
          status: "new",
        })
      );

      // Machine 2: only playable issues (open)
      await db.insert(issues).values(
        createTestIssue(machine2.initials, {
          issueNumber: 1,
          severity: "playable",
          status: "new",
        })
      );

      // Machine 3: unplayable issue (resolved - should NOT appear)
      await db.insert(issues).values(
        createTestIssue(machine3.initials, {
          issueNumber: 1,
          severity: "unplayable",
          status: "resolved",
        })
      );

      // Query all machines with issues (dashboard query pattern)
      const allMachines = await db.query.machines.findMany({
        with: {
          issues: {
            columns: {
              id: true,
              status: true,
              severity: true,
            },
          },
        },
      });

      const unplayableMachines = allMachines
        .map((machine) => {
          const status = deriveMachineStatus(
            machine.issues as IssueForStatus[]
          );
          const unplayableIssuesCount = machine.issues.filter(
            (issue: { severity: string; status: string }) =>
              issue.severity === "unplayable" && issue.status !== "resolved"
          ).length;

          return {
            id: machine.id,
            name: machine.name,
            status,
            unplayableIssuesCount,
          };
        })
        .filter((machine) => machine.status === "unplayable");

      // Should only return machine1
      expect(unplayableMachines).toHaveLength(1);
      expect(unplayableMachines[0].name).toBe("Unplayable Machine");
      expect(unplayableMachines[0].unplayableIssuesCount).toBe(1);
    });
  });

  describe("Dashboard Stats Calculation", () => {
    it("should correctly calculate total open issues", async () => {
      const db = await getTestDb();

      // Create machine
      const testMachine = createTestMachine({ initials: "DS" });
      const [machine] = await db
        .insert(machines)
        .values(testMachine)
        .returning();

      // Create 3 open issues, 2 resolved
      await db.insert(issues).values([
        createTestIssue(machine.initials, { issueNumber: 1, status: "new" }),
        createTestIssue(machine.initials, {
          issueNumber: 2,
          status: "in_progress",
        }),
        createTestIssue(machine.initials, { issueNumber: 3, status: "new" }),
        createTestIssue(machine.initials, {
          issueNumber: 4,
          status: "resolved",
        }),
        createTestIssue(machine.initials, {
          issueNumber: 5,
          status: "resolved",
        }),
      ]);

      // Query total open issues (dashboard stat pattern)
      const totalOpenIssuesResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(issues)
        .where(ne(issues.status, "resolved"));

      const totalOpenIssues = totalOpenIssuesResult[0]?.count ?? 0;

      expect(totalOpenIssues).toBe(3);
    });

    it("should correctly calculate machines needing service", async () => {
      const db = await getTestDb();

      // Create 4 machines
      const [machine1, machine2, machine3] = await db
        .insert(machines)
        .values([
          createTestMachine({ name: "Machine 1", initials: "M1" }),
          createTestMachine({ name: "Machine 2", initials: "M2" }),
          createTestMachine({ name: "Machine 3", initials: "M3" }),
          createTestMachine({ name: "Machine 4", initials: "M4" }),
        ])
        .returning();

      // Machine 1: open issue (needs service)
      await db.insert(issues).values(
        createTestIssue(machine1.initials, {
          issueNumber: 1,
          status: "new",
        })
      );

      // Machine 2: open issue (needs service)
      await db.insert(issues).values(
        createTestIssue(machine2.initials, {
          issueNumber: 1,
          status: "in_progress",
        })
      );

      // Machine 3: only resolved issues (operational)
      await db.insert(issues).values(
        createTestIssue(machine3.initials, {
          issueNumber: 1,
          status: "resolved",
        })
      );

      // Machine 4: no issues (operational)

      // Query all machines with issues (dashboard query pattern)
      const allMachines = await db.query.machines.findMany({
        with: {
          issues: {
            columns: {
              status: true,
              severity: true,
            },
          },
        },
      });

      // Calculate machines needing service
      const machinesNeedingService = allMachines.filter((machine) => {
        const status = deriveMachineStatus(machine.issues as IssueForStatus[]);
        return status !== "operational";
      }).length;

      expect(machinesNeedingService).toBe(2); // machine1 and machine2
    });

    it("should correctly count issues assigned to user", async () => {
      const db = await getTestDb();

      // Create user
      const testUser = createTestUser();
      const [user] = await db.insert(userProfiles).values(testUser).returning();

      // Create machine
      const testMachine = createTestMachine({ initials: "AI" });
      const [machine] = await db
        .insert(machines)
        .values(testMachine)
        .returning();

      // Create 2 open assigned issues, 1 resolved assigned issue
      await db.insert(issues).values([
        createTestIssue(machine.initials, {
          issueNumber: 1,
          assignedTo: user.id,
          status: "new",
        }),
        createTestIssue(machine.initials, {
          issueNumber: 2,
          assignedTo: user.id,
          status: "in_progress",
        }),
        createTestIssue(machine.initials, {
          issueNumber: 3,
          assignedTo: user.id,
          status: "resolved",
        }),
      ]);

      // Query assigned issues count (dashboard pattern)
      const assignedIssues = await db.query.issues.findMany({
        where: and(
          eq(issues.assignedTo, user.id),
          ne(issues.status, "resolved")
        ),
      });

      const myIssuesCount = assignedIssues.length;

      expect(myIssuesCount).toBe(2); // Only open issues
    });
  });
});
