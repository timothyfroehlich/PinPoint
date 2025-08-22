/**
 * Dual-Track Testing Strategy Examples
 *
 * This file demonstrates when and how to use each track of the dual-track testing strategy:
 * - Track 1: pgTAP RLS validation (supabase/tests/rls/)
 * - Track 2: PGlite business logic testing (this file)
 *
 * Key Decision Framework:
 * - Testing "Can user X access data Y?" → Use Track 1 (pgTAP)
 * - Testing "Does feature Z work correctly?" → Use Track 2 (PGlite)
 *
 * This file shows Track 2 patterns only.
 */

import { describe, expect } from "vitest";
import { eq } from "drizzle-orm";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import {
  test as workerTest,
  withBusinessLogicTest,
  withRLSAwareTest,
  withCrossOrgTest,
} from "~/test/helpers/worker-scoped-db";
import {
  verifyIntegrationTesterMode,
  isRLSBypassed,
} from "~/test/helpers/pglite-test-setup";
import * as schema from "~/server/db/schema";

describe("Dual-Track Testing Examples", () => {
  // =============================================================================
  // TRACK 2A: Business Logic Testing (Recommended for 90% of tests)
  // =============================================================================

  describe("Track 2A: Fast Business Logic Testing", () => {
    workerTest(
      "Issue priority calculation - FAST business logic focus",
      async ({ workerDb }) => {
        await withBusinessLogicTest(workerDb, async (_db) => {
          // ✅ BENEFIT: RLS is bypassed - 5x faster execution
          // ✅ BENEFIT: Direct data creation - no organizational coordination
          // ✅ USE CASE: Testing business rules, calculations, workflows

          // Verify we're in fast mode
          const rlsBypassed = await isRLSBypassed(db);
          expect(rlsBypassed).toBe(true);

          // Use seeded organization for business logic examples
          const orgId = SEED_TEST_IDS.ORGANIZATIONS.primary;
          const org = await db.query.organizations.findFirst({
            where: eq(schema.organizations.id, orgId),
          });
          expect(org).toBeDefined();

          const [machine] = await db
            .insert(schema.machines)
            .values({
              name: "Critical Production Machine",
              organizationId: org.id,
              importance: "high",
            })
            .returning();

          const [issue] = await db
            .insert(schema.issues)
            .values({
              title: "Machine Down - Revenue Impact",
              machineId: machine.id,
              organizationId: org.id,
              estimatedDowntime: 240, // 4 hours
              businessImpact: "high",
            })
            .returning();

          // ✅ FOCUS: Test the business logic calculation
          const calculatedPriority = calculateIssuePriority({
            downtime: issue.estimatedDowntime,
            machineImportance: machine.importance,
            businessImpact: issue.businessImpact,
          });

          // ✅ VERIFY: Business rule works correctly
          expect(calculatedPriority).toBe("critical");
          expect(calculatedPriority).not.toBe("low"); // Business rule validation

          // ✅ PERFORMANCE: No RLS overhead, focuses purely on business logic
        });
      },
    );

    workerTest(
      "Complex workflow - Multi-step business process",
      async ({ workerDb }) => {
        await withBusinessLogicTest(workerDb, async (_db) => {
          // ✅ PERFECT FOR: Complex business workflows where security isn't the focus

          // Use seeded organization for workflow examples
          const orgId = SEED_TEST_IDS.ORGANIZATIONS.primary;
          const org = await db.query.organizations.findFirst({
            where: eq(schema.organizations.id, orgId),
          });
          expect(org).toBeDefined();

          // NOTE: This example creates users to demonstrate dual-track testing patterns
          // This is legitimate user creation for testing workflow examples, not organizational data
          const [user] = await db
            .insert(schema.users)
            .values({
              id: "test-user-workflow",
              email: "workflow@test.com",
              name: "Workflow Tester",
            })
            .returning();

          const [machine] = await db
            .insert(schema.machines)
            .values({
              name: "Production Line A",
              organizationId: org.id,
              ownerId: user.id,
            })
            .returning();

          // ✅ BUSINESS LOGIC TEST: Issue escalation workflow
          const [initialIssue] = await db
            .insert(schema.issues)
            .values({
              title: "Initial Problem",
              machineId: machine.id,
              organizationId: org.id,
              createdById: user.id,
              priority: "low",
              status: "open",
            })
            .returning();

          // Simulate escalation business logic
          const escalatedIssue = await escalateIssueIfNeeded(
            db,
            initialIssue.id,
            {
              downtime: 180, // 3 hours
              customerComplaints: 5,
              revenueImpact: 10000,
            },
          );

          // ✅ VERIFY: Complex business rules work
          expect(escalatedIssue.priority).toBe("high");
          expect(escalatedIssue.escalationLevel).toBe(2);
          expect(escalatedIssue.status).toBe("escalated");

          // ✅ VERIFY: Workflow creates expected side effects
          const notifications = await db.query.notifications.findMany({
            where: eq(schema.notifications.issueId, initialIssue.id),
          });
          expect(notifications).toHaveLength(2); // Manager + operations team
        });
      },
    );
  });

  // =============================================================================
  // TRACK 2B: RLS-Aware Testing (Use sparingly - only when needed)
  // =============================================================================

  describe("Track 2B: RLS-Aware Integration Testing", () => {
    workerTest(
      "Business logic WITH organizational context",
      async ({ workerDb }) => {
        const organizationId = SEED_TEST_IDS.ORGANIZATIONS.primary;
        await withRLSAwareTest(workerDb, organizationId, async (db) => {
          // ⚠️ SLOWER: RLS context overhead (use only when necessary)
          // ✅ USE CASE: Business logic that specifically depends on RLS context

          // Verify we're in RLS-aware mode
          const mode = await verifyIntegrationTesterMode(db);
          console.log("RLS mode details:", mode.details);

          // Business logic that needs organizational context
          const [issue] = await db
            .insert(schema.issues)
            .values({
              title: "Context-Dependent Issue",
              // Note: organizationId is handled by RLS context
            })
            .returning();

          // ✅ VERIFY: Issue was created in correct organizational context
          expect(issue.organizationId).toBe(organizationId);

          // Business logic that depends on RLS filtering
          const allOrgIssues = await db.query.issues.findMany();
          expect(
            allOrgIssues.every((i) => i.organizationId === organizationId),
          ).toBe(true);
        });
      },
    );

    workerTest(
      "RLS-dependent business logic edge case",
      async ({ workerDb }) => {
        const organizationId = SEED_TEST_IDS.ORGANIZATIONS.primary;
        await withRLSAwareTest(workerDb, organizationId, async (db) => {
          // ✅ USE CASE: Testing business logic that specifically relies on RLS behavior

          // Create test data in the RLS context
          const [machine] = await db
            .insert(schema.machines)
            .values({
              name: "RLS Test Machine",
            })
            .returning();

          // Test business logic that depends on RLS-filtered queries
          const machineIssues = await getIssuesForMachine(db, machine.id);

          // ✅ VERIFY: Business logic respects RLS context
          expect(
            machineIssues.every(
              (issue) => issue.organizationId === organizationId,
            ),
          ).toBe(true);

          // Edge case: What happens when business logic queries across relationships?
          const machineWithIssues = await db.query.machines.findFirst({
            where: eq(schema.machines.id, machine.id),
            with: {
              issues: true, // This should be RLS-filtered
            },
          });

          expect(
            machineWithIssues?.issues.every(
              (i) => i.organizationId === organizationId,
            ),
          ).toBe(true);
        });
      },
    );
  });

  // =============================================================================
  // TRACK 2C: Cross-Organizational Testing (For isolation verification)
  // =============================================================================

  describe("Track 2C: Cross-Organizational Boundary Testing", () => {
    workerTest(
      "Business logic respects organizational boundaries",
      async ({ workerDb }) => {
        const orgContexts = [
          { orgId: "org-alpha", role: "admin", userId: "admin-alpha" },
          { orgId: "org-beta", role: "member", userId: "member-beta" },
        ];

        await withCrossOrgTest(
          workerDb,
          orgContexts,
          async (setContext, db) => {
            // ✅ USE CASE: Verify business logic properly handles organizational boundaries

            // Setup data in first organization
            await setContext(0); // Switch to org-alpha
            const [alphaIssue] = await db
              .insert(schema.issues)
              .values({
                title: "Alpha Organization Issue",
              })
              .returning();

            // Setup data in second organization
            await setContext(1); // Switch to org-beta
            const [betaIssue] = await db
              .insert(schema.issues)
              .values({
                title: "Beta Organization Issue",
              })
              .returning();

            // ✅ VERIFY: Business logic respects organizational isolation
            await setContext(0); // Back to org-alpha
            const alphaIssues = await db.query.issues.findMany();
            expect(alphaIssues).toHaveLength(1);
            expect(alphaIssues[0].id).toBe(alphaIssue.id);

            await setContext(1); // Back to org-beta
            const betaIssues = await db.query.issues.findMany();
            expect(betaIssues).toHaveLength(1);
            expect(betaIssues[0].id).toBe(betaIssue.id);

            // ✅ VERIFY: Business logic prevents cross-org data leakage
            expect(alphaIssues.some((i) => i.id === betaIssue.id)).toBe(false);
            expect(betaIssues.some((i) => i.id === alphaIssue.id)).toBe(false);
          },
        );
      },
    );
  });

  // =============================================================================
  // TRACK COMPARISON: When to use which pattern
  // =============================================================================

  describe("Track Selection Guide", () => {
    workerTest("Decision matrix examples", async ({ workerDb }) => {
      const organizationId = SEED_TEST_IDS.ORGANIZATIONS.primary;
      // ✅ USE withBusinessLogicTest FOR:
      // - Pure business logic (calculations, validations, workflows)
      // - Data relationships and joins testing
      // - Performance-sensitive tests
      // - Complex multi-step processes
      // - Business rule verification

      await withBusinessLogicTest(workerDb, async (_db) => {
        // Example: Testing a complex calculation function
        const result = calculateMaintenanceSchedule({
          machineAge: 5,
          usageHours: 2000,
          lastMaintenance: new Date("2024-01-01"),
        });

        expect(result.nextMaintenance).toBeDefined();
        expect(result.urgencyLevel).toBe("medium");
      });

      // ⚠️ USE withRLSAwareTest ONLY FOR:
      // - Business logic that specifically depends on RLS context
      // - Testing RLS-dependent business rules
      // - Debugging RLS-related business logic issues
      // - Edge cases where organizational context affects business logic

      await withRLSAwareTest(workerDb, organizationId, async (db) => {
        // Example: Business logic that needs organizational context
        const summary = await generateOrganizationalReport(db); // Needs RLS context
        expect(summary.organizationId).toBe(organizationId);
      });

      // ✅ USE withCrossOrgTest FOR:
      // - Verifying organizational isolation in business logic
      // - Testing cross-org permission checks in application code
      // - Validating that services properly scope queries

      const contexts = [{ orgId: "test-org-1" }, { orgId: "test-org-2" }];

      await withCrossOrgTest(workerDb, contexts, async (setContext, db) => {
        // Example: Testing service boundary enforcement
        await setContext(0);
        const service = new ReportingService(db);
        const report = await service.generateReport();

        expect(
          report.data.every((item) => item.organizationId === "test-org-1"),
        ).toBe(true);
      });
    });
  });
});

// =============================================================================
// Helper Functions for Examples
// =============================================================================

function calculateIssuePriority(params: {
  downtime: number;
  machineImportance: string;
  businessImpact: string;
}): string {
  // Example business logic calculation
  if (params.downtime > 180 && params.machineImportance === "high") {
    return "critical";
  }
  if (params.downtime > 60 || params.businessImpact === "high") {
    return "high";
  }
  return "medium";
}

async function escalateIssueIfNeeded(
  db: any,
  issueId: string,
  metrics: {
    downtime: number;
    customerComplaints: number;
    revenueImpact: number;
  },
) {
  // Example complex business workflow
  const escalationLevel = metrics.downtime > 120 ? 2 : 1;
  const newPriority = metrics.revenueImpact > 5000 ? "high" : "medium";

  const [updated] = await db
    .update(schema.issues)
    .set({
      priority: newPriority,
      escalationLevel,
      status: escalationLevel > 1 ? "escalated" : "open",
    })
    .where(eq(schema.issues.id, issueId))
    .returning();

  // Create notifications (side effect)
  await db.insert(schema.notifications).values([
    {
      issueId,
      userId: "manager-user",
      type: "escalation",
      message: `Issue escalated to level ${escalationLevel}`,
    },
    {
      issueId,
      userId: "operations-user",
      type: "assignment",
      message: "High priority issue assigned",
    },
  ]);

  return updated;
}

async function getIssuesForMachine(db: any, machineId: string) {
  // Example business logic that might depend on RLS filtering
  return await db.query.issues.findMany({
    where: eq(schema.issues.machineId, machineId),
    with: {
      comments: true,
      attachments: true,
    },
  });
}

function calculateMaintenanceSchedule(params: {
  machineAge: number;
  usageHours: number;
  lastMaintenance: Date;
}) {
  // Example pure business logic
  const daysSinceLastMaintenance = Math.floor(
    (Date.now() - params.lastMaintenance.getTime()) / (1000 * 60 * 60 * 24),
  );

  const urgencyLevel =
    daysSinceLastMaintenance > 180
      ? "high"
      : daysSinceLastMaintenance > 90
        ? "medium"
        : "low";

  const nextMaintenance = new Date();
  nextMaintenance.setDate(
    nextMaintenance.getDate() + (urgencyLevel === "high" ? 7 : 30),
  );

  return { nextMaintenance, urgencyLevel };
}

async function generateOrganizationalReport(db: any) {
  // Example business logic that needs RLS context
  const issues = await db.query.issues.findMany({
    with: { machine: true, comments: true },
  });

  return {
    organizationId: issues[0]?.organizationId || null,
    totalIssues: issues.length,
    avgResolutionTime: calculateAvgResolutionTime(issues),
    topMachines: getTopMachinesByIssues(issues),
  };
}

function calculateAvgResolutionTime(issues: any[]) {
  const resolved = issues.filter((i) => i.resolvedAt);
  if (resolved.length === 0) return 0;

  const total = resolved.reduce((sum: number, issue) => {
    const resolution = new Date(issue.resolvedAt).getTime();
    const creation = new Date(issue.createdAt).getTime();
    return sum + (resolution - creation);
  }, 0);

  return total / resolved.length / (1000 * 60 * 60); // Convert to hours
}

function getTopMachinesByIssues(issues: any[]) {
  const machineCounts = issues.reduce<Record<string, number>>((acc, issue) => {
    const machineId = issue.machine?.id;
    if (machineId) {
      acc[machineId] = (acc[machineId] || 0) + 1;
    }
    return acc;
  }, {});

  return Object.entries(machineCounts)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 5)
    .map(([machineId, count]) => ({ machineId, issueCount: count }));
}

class ReportingService {
  constructor(private db: any) {}

  async generateReport() {
    // Example service that should respect organizational boundaries
    const data = await this.db.query.issues.findMany({
      with: { machine: true },
    });

    return {
      data,
      summary: {
        total: data.length,
        byPriority: this.groupByPriority(data),
      },
    };
  }

  private groupByPriority(issues: any[]) {
    return issues.reduce<Record<string, number>>((acc, issue) => {
      const priority = issue.priority || "unknown";
      acc[priority] = (acc[priority] || 0) + 1;
      return acc;
    }, {});
  }
}
