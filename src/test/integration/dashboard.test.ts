/**
 * Integration Test: Dashboard Queries with PGlite
 *
 * Tests dashboard-specific queries:
 * - Issues assigned to current user
 * - Recently reported issues
 * - Newest machines
 * - Recently fixed machines
 * - Dashboard stats
 */

import { randomUUID } from "node:crypto";
import { describe, it, expect } from "vitest";
import {
  eq,
  desc,
  and,
  ne,
  sql,
  inArray,
  notInArray,
  not,
  exists,
} from "drizzle-orm";
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
import { CLOSED_STATUSES } from "~/lib/issues/status";

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

      // Create issues: 2 for user1 (1 open, 1 fixed), 1 for user2
      await db.insert(issues).values([
        createTestIssue(machine.initials, {
          title: "Issue 1 for User 1",
          issueNumber: 1,
          assignedTo: testUser1.id,
          status: "new",
        }),
        createTestIssue(machine.initials, {
          title: "Issue 2 for User 1 (fixed)",
          issueNumber: 2,
          assignedTo: testUser1.id,
          status: "fixed",
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
          ne(issues.status, "fixed")
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
        where: and(eq(issues.assignedTo, userId), ne(issues.status, "fixed")),
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

  describe("Newest Machines Query", () => {
    it("should return 3 most recently added machines ordered by createdAt", async () => {
      const db = await getTestDb();

      // Create 5 machines with staggered creation times
      const now = Date.now();
      const machinesData = await db
        .insert(machines)
        .values([
          createTestMachine({
            name: "Oldest Machine",
            initials: "M1",
            createdAt: new Date(now - 5000),
          }),
          createTestMachine({
            name: "Old Machine",
            initials: "M2",
            createdAt: new Date(now - 4000),
          }),
          createTestMachine({
            name: "Third Newest",
            initials: "M3",
            createdAt: new Date(now - 3000),
          }),
          createTestMachine({
            name: "Second Newest",
            initials: "M4",
            createdAt: new Date(now - 2000),
          }),
          createTestMachine({
            name: "Newest Machine",
            initials: "M5",
            createdAt: new Date(now - 1000),
          }),
        ])
        .returning();

      // Query newest machines (dashboard query pattern)
      const newestMachines = await db.query.machines.findMany({
        orderBy: desc(machines.createdAt),
        limit: 3,
        columns: {
          id: true,
          name: true,
          initials: true,
          createdAt: true,
        },
      });

      // Should return exactly 3 most recent machines
      expect(newestMachines).toHaveLength(3);
      expect(newestMachines[0].name).toBe("Newest Machine");
      expect(newestMachines[1].name).toBe("Second Newest");
      expect(newestMachines[2].name).toBe("Third Newest");
    });

    it("should return empty array when no machines exist", async () => {
      const db = await getTestDb();

      // Query with no machines
      const newestMachines = await db.query.machines.findMany({
        orderBy: desc(machines.createdAt),
        limit: 3,
      });

      expect(newestMachines).toHaveLength(0);
    });
  });

  describe("Recently Fixed Machines Query", () => {
    it("should return machines that had major/unplayable issues but now have none", async () => {
      const db = await getTestDb();

      // Create 4 machines
      const [machine1, machine2, machine3, machine4] = await db
        .insert(machines)
        .values([
          createTestMachine({ name: "Recently Fixed 1", initials: "RF1" }),
          createTestMachine({ name: "Recently Fixed 2", initials: "RF2" }),
          createTestMachine({ name: "Still Broken", initials: "SB" }),
          createTestMachine({ name: "Never Broken", initials: "NB" }),
        ])
        .returning();

      const now = Date.now();

      // Machine 1: Had major issue, now fixed (most recent fix)
      await db.insert(issues).values(
        createTestIssue(machine1.initials, {
          issueNumber: 1,
          severity: "major",
          status: "fixed",
          updatedAt: new Date(now - 1000),
        })
      );

      // Machine 2: Had unplayable issue, now fixed (older fix)
      await db.insert(issues).values(
        createTestIssue(machine2.initials, {
          issueNumber: 1,
          severity: "unplayable",
          status: "fixed",
          updatedAt: new Date(now - 2000),
        })
      );

      // Machine 3: Has major issue (closed) but ALSO has open major issue (should NOT appear)
      await db.insert(issues).values([
        createTestIssue(machine3.initials, {
          issueNumber: 1,
          severity: "major",
          status: "fixed",
          updatedAt: new Date(now - 500),
        }),
        createTestIssue(machine3.initials, {
          issueNumber: 2,
          severity: "major",
          status: "new",
        }),
      ]);

      // Machine 4: Never had major/unplayable issues (should NOT appear)
      await db.insert(issues).values(
        createTestIssue(machine4.initials, {
          issueNumber: 1,
          severity: "playable",
          status: "fixed",
        })
      );

      // Query recently fixed machines (dashboard query pattern)
      const recentlyFixedMachines = await db
        .select({
          id: machines.id,
          name: machines.name,
          initials: machines.initials,
          fixedAt: sql<Date>`max(${issues.updatedAt})`.as("fixed_at"),
        })
        .from(machines)
        .innerJoin(issues, eq(issues.machineInitials, machines.initials))
        .where(
          and(
            // Issue was major or unplayable
            inArray(issues.severity, ["major", "unplayable"]),
            // Issue is now closed
            inArray(issues.status, [...CLOSED_STATUSES]),
            // Machine has NO open major/unplayable issues currently
            not(
              exists(
                db
                  .select({ one: sql`1` })
                  .from(issues)
                  .where(
                    and(
                      eq(issues.machineInitials, machines.initials),
                      inArray(issues.severity, ["major", "unplayable"]),
                      notInArray(issues.status, [...CLOSED_STATUSES])
                    )
                  )
              )
            )
          )
        )
        .groupBy(machines.id, machines.name, machines.initials)
        .orderBy(sql`max(${issues.updatedAt}) DESC`)
        .limit(3);

      // Should return machine1 and machine2 (recently fixed), not machine3 (still has open issues) or machine4 (never had major issues)
      expect(recentlyFixedMachines).toHaveLength(2);
      expect(recentlyFixedMachines[0].name).toBe("Recently Fixed 1"); // Most recent fix
      expect(recentlyFixedMachines[1].name).toBe("Recently Fixed 2");
    });

    it("should return empty array when no machines have been recently fixed", async () => {
      const db = await getTestDb();

      // Create machine with open issue
      const [machine] = await db
        .insert(machines)
        .values(createTestMachine({ initials: "BR" }))
        .returning();

      await db.insert(issues).values(
        createTestIssue(machine.initials, {
          issueNumber: 1,
          severity: "major",
          status: "new",
        })
      );

      // Query should return nothing
      const recentlyFixedMachines = await db
        .select({
          id: machines.id,
          name: machines.name,
          initials: machines.initials,
          fixedAt: sql<Date>`max(${issues.updatedAt})`.as("fixed_at"),
        })
        .from(machines)
        .innerJoin(issues, eq(issues.machineInitials, machines.initials))
        .where(
          and(
            inArray(issues.severity, ["major", "unplayable"]),
            inArray(issues.status, [...CLOSED_STATUSES]),
            not(
              exists(
                db
                  .select({ one: sql`1` })
                  .from(issues)
                  .where(
                    and(
                      eq(issues.machineInitials, machines.initials),
                      inArray(issues.severity, ["major", "unplayable"]),
                      notInArray(issues.status, [...CLOSED_STATUSES])
                    )
                  )
              )
            )
          )
        )
        .groupBy(machines.id, machines.name, machines.initials)
        .orderBy(sql`max(${issues.updatedAt}) DESC`)
        .limit(3);

      expect(recentlyFixedMachines).toHaveLength(0);
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

      // Create 3 open issues, 2 fixed
      await db.insert(issues).values([
        createTestIssue(machine.initials, { issueNumber: 1, status: "new" }),
        createTestIssue(machine.initials, {
          issueNumber: 2,
          status: "in_progress",
        }),
        createTestIssue(machine.initials, { issueNumber: 3, status: "new" }),
        createTestIssue(machine.initials, {
          issueNumber: 4,
          status: "fixed",
        }),
        createTestIssue(machine.initials, {
          issueNumber: 5,
          status: "fixed",
        }),
      ]);

      // Query total open issues (dashboard stat pattern)
      const totalOpenIssuesResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(issues)
        .where(ne(issues.status, "fixed"));

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

      // Machine 3: only fixed issues (operational)
      await db.insert(issues).values(
        createTestIssue(machine3.initials, {
          issueNumber: 1,
          status: "fixed",
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

      // Create 2 open assigned issues, 1 fixed assigned issue
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
          status: "fixed",
        }),
      ]);

      // Query assigned issues count (dashboard pattern)
      const assignedIssues = await db.query.issues.findMany({
        where: and(eq(issues.assignedTo, user.id), ne(issues.status, "fixed")),
      });

      const myIssuesCount = assignedIssues.length;

      expect(myIssuesCount).toBe(2); // Only open issues
    });
  });
});
