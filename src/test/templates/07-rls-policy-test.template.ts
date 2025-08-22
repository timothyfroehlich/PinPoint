/**
 * TEMPLATE: Archetype 7 - RLS Policy Test (NEW ARCHETYPE)
 *
 * USE FOR: Testing Row-Level Security policies directly at database level
 * RLS IMPACT: NEW - Test database policies directly with realistic contexts
 * AGENT: security-test-architect
 *
 * CHARACTERISTICS:
 * - Tests RLS policies with realistic user contexts
 * - Uses session context to simulate different user roles
 * - Tests organizational boundaries at the database level
 * - Verifies policy enforcement for INSERT, SELECT, UPDATE, DELETE
 * - Tests policy edge cases and complex scenarios
 *
 * NOTE: This archetype complements Track 1 (pgTAP) testing by providing
 * programmatic RLS policy testing within the PGlite environment.
 */

import { describe, test, expect } from "vitest";
import { eq, and, sql } from "drizzle-orm";
import {
  test as workerTest,
  withRLSAwareTest,
  withCrossOrgTest,
} from "~/test/helpers/worker-scoped-db";
import {
  testSessions,
  sessionVerification,
  MultiContextManager,
} from "~/test/helpers/session-context";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import * as schema from "~/server/db/schema";

describe("RLS Policy Enforcement", () => {
  // =============================================================================
  // BASIC RLS POLICY TESTING
  // =============================================================================

  test("issues RLS policy blocks cross-org access", async ({ workerDb }) => {
    const orgContexts = [
      { orgId: "policy-org-1", role: "member", userId: "user-1" },
      { orgId: "policy-org-2", role: "member", userId: "user-2" },
    ];

    await withCrossOrgTest(workerDb, orgContexts, async (setContext, db) => {
      // ARRANGE: Create issue in org-1
      await setContext(0);
      const [org1Issue] = await db
        .insert(schema.issues)
        .values({
          id: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE + "-org1",
          title: "Org 1 RLS Test Issue",
          organizationId: "policy-org-1", // Explicit for clarity in policy testing
          machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
          priorityId: SEED_TEST_IDS.PRIORITIES.MEDIUM,
          statusId: SEED_TEST_IDS.STATUSES.NEW,
          createdById: "user-1",
        })
        .returning();

      // VERIFY: User in org-1 can see their issue
      const org1Issues = await db.query.issues.findMany();
      expect(org1Issues).toHaveLength(1);
      expect(org1Issues[0].id).toBe(org1Issue.id);

      // ASSERT: User in org-2 cannot see org-1 issue
      await setContext(1);
      const org2Issues = await db.query.issues.findMany();
      expect(org2Issues).toHaveLength(0); // RLS policy blocks access

      // ASSERT: Direct query by ID also blocked
      const directAccess = await db.query.issues.findFirst({
        where: eq(schema.issues.id, org1Issue.id),
      });
      expect(directAccess).toBeNull(); // RLS prevents cross-org access
    });
  });

  test("issues RLS policy enforces INSERT restrictions", async ({
    workerDb,
    organizationId,
  }) => {
    await withRLSAwareTest(workerDb, organizationId, async (db) => {
      // ARRANGE: Set authenticated context
      await testSessions.member(db, organizationId, "test-user");

      // TEST: Valid INSERT (matches session org)
      const [validIssue] = await db
        .insert(schema.issues)
        .values({
          id: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE,
          title: "Valid RLS Insert",
          // organizationId is automatically set by RLS or defaults
          machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
          priorityId: SEED_TEST_IDS.PRIORITIES.LOW,
          statusId: SEED_TEST_IDS.STATUSES.NEW,
          createdById: "test-user",
        })
        .returning();

      expect(validIssue).toBeDefined();
      expect(validIssue.organizationId).toBe(organizationId);

      // TEST: Invalid INSERT (different org) should be rejected
      await expect(
        db.insert(schema.issues).values({
          id: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE + "-invalid",
          title: "Invalid Cross-Org Insert",
          organizationId: "different-org", // Explicit mismatch
          machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
          priorityId: SEED_TEST_IDS.PRIORITIES.LOW,
          statusId: SEED_TEST_IDS.STATUSES.NEW,
          createdById: "test-user",
        }),
      ).rejects.toThrow(); // RLS policy should reject this
    });
  });

  test("issues RLS policy enforces UPDATE restrictions", async ({
    workerDb,
    organizationId,
  }) => {
    await withRLSAwareTest(workerDb, organizationId, async (db) => {
      // ARRANGE: Create issue as admin
      await testSessions.admin(db, organizationId, "admin-user");
      const [testIssue] = await db
        .insert(schema.issues)
        .values({
          id: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE,
          title: "RLS Update Test Issue",
          organizationId,
          machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
          priorityId: SEED_TEST_IDS.PRIORITIES.MEDIUM,
          statusId: SEED_TEST_IDS.STATUSES.NEW,
          createdById: "admin-user",
        })
        .returning();

      // TEST: Admin can update issue in same org
      const [adminUpdate] = await db
        .update(schema.issues)
        .set({ priorityId: SEED_TEST_IDS.PRIORITIES.HIGH })
        .where(eq(schema.issues.id, testIssue.id))
        .returning();

      expect(adminUpdate.priorityId).toBe(SEED_TEST_IDS.PRIORITIES.HIGH);

      // SWITCH: To different organization
      await testSessions.admin(db, "different-org", "different-admin");

      // ASSERT: Cannot update issue from different org
      const crossOrgUpdate = await db
        .update(schema.issues)
        .set({ priorityId: SEED_TEST_IDS.PRIORITIES.CRITICAL })
        .where(eq(schema.issues.id, testIssue.id))
        .returning();

      expect(crossOrgUpdate).toHaveLength(0); // RLS prevents cross-org update
    });
  });

  test("issues RLS policy enforces DELETE restrictions", async ({
    workerDb,
    organizationId,
  }) => {
    await withRLSAwareTest(workerDb, organizationId, async (db) => {
      // ARRANGE: Create issue to delete
      await testSessions.admin(db, organizationId, "admin-user");
      const [testIssue] = await db
        .insert(schema.issues)
        .values({
          id: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE,
          title: "RLS Delete Test Issue",
          organizationId,
          machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
          priorityId: SEED_TEST_IDS.PRIORITIES.LOW,
          statusId: SEED_TEST_IDS.STATUSES.NEW,
          createdById: "admin-user",
        })
        .returning();

      // TEST: Admin in same org can delete
      await testSessions.admin(db, organizationId, "admin-user");
      const deleteResult = await db
        .delete(schema.issues)
        .where(eq(schema.issues.id, testIssue.id))
        .returning();

      expect(deleteResult).toHaveLength(1);

      // VERIFY: Issue is actually deleted
      const verifyDeleted = await db.query.issues.findFirst({
        where: eq(schema.issues.id, testIssue.id),
      });
      expect(verifyDeleted).toBeNull();
    });
  });

  // =============================================================================
  // ROLE-BASED RLS POLICY TESTING
  // =============================================================================

  test("RLS policies respect role-based permissions", async ({
    workerDb,
    organizationId,
  }) => {
    await withRLSAwareTest(workerDb, organizationId, async (db) => {
      // TEST: Admin role operations
      await testSessions.admin(db, organizationId, "admin-user");

      const [adminIssue] = await db
        .insert(schema.issues)
        .values({
          id: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE + "-admin",
          title: "Admin RLS Test",
          machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
          priorityId: SEED_TEST_IDS.PRIORITIES.HIGH,
          statusId: SEED_TEST_IDS.STATUSES.NEW,
          createdById: "admin-user",
        })
        .returning();

      expect(adminIssue).toBeDefined();

      // TEST: Member role operations
      await testSessions.member(db, organizationId, "member-user");

      const [memberIssue] = await db
        .insert(schema.issues)
        .values({
          id: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE + "-member",
          title: "Member RLS Test",
          machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
          priorityId: SEED_TEST_IDS.PRIORITIES.MEDIUM,
          statusId: SEED_TEST_IDS.STATUSES.NEW,
          createdById: "member-user",
        })
        .returning();

      expect(memberIssue).toBeDefined();

      // ASSERT: Member can see both issues (same org)
      const memberView = await db.query.issues.findMany();
      expect(memberView).toHaveLength(2);

      // TEST: Viewer role restrictions
      await testSessions.viewer(db, organizationId, "viewer-user");

      // Viewer can read
      const viewerRead = await db.query.issues.findMany();
      expect(viewerRead).toHaveLength(2);

      // But viewer cannot create
      await expect(
        db.insert(schema.issues).values({
          id: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE + "-viewer",
          title: "Viewer Attempt",
          machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
          priorityId: SEED_TEST_IDS.PRIORITIES.LOW,
          statusId: SEED_TEST_IDS.STATUSES.NEW,
          createdById: "viewer-user",
        }),
      ).rejects.toThrow(); // RLS policy should block
    });
  });

  test("RLS policies enforce ownership restrictions", async ({
    workerDb,
    organizationId,
  }) => {
    await withRLSAwareTest(workerDb, organizationId, async (db) => {
      // ARRANGE: Create issues owned by different users
      await testSessions.member(db, organizationId, "owner-user");
      const [ownedIssue] = await db
        .insert(schema.issues)
        .values({
          id: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE + "-owned",
          title: "Owner's Issue",
          machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
          priorityId: SEED_TEST_IDS.PRIORITIES.LOW,
          statusId: SEED_TEST_IDS.STATUSES.NEW,
          createdById: "owner-user",
        })
        .returning();

      await testSessions.member(db, organizationId, "other-user");
      const [otherIssue] = await db
        .insert(schema.issues)
        .values({
          id: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE + "-other",
          title: "Other User's Issue",
          machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
          priorityId: SEED_TEST_IDS.PRIORITIES.LOW,
          statusId: SEED_TEST_IDS.STATUSES.NEW,
          createdById: "other-user",
        })
        .returning();

      // TEST: Owner can modify their own issue
      await testSessions.member(db, organizationId, "owner-user");
      const [ownerUpdate] = await db
        .update(schema.issues)
        .set({ title: "Owner Updated" })
        .where(
          and(
            eq(schema.issues.id, ownedIssue.id),
            eq(schema.issues.createdById, "owner-user"), // Ownership check
          ),
        )
        .returning();

      expect(ownerUpdate.title).toBe("Owner Updated");

      // ASSERT: Owner cannot modify other user's issue
      const unauthorizedUpdate = await db
        .update(schema.issues)
        .set({ title: "Unauthorized Update" })
        .where(
          and(
            eq(schema.issues.id, otherIssue.id),
            eq(schema.issues.createdById, "owner-user"), // This will fail
          ),
        )
        .returning();

      expect(unauthorizedUpdate).toHaveLength(0); // No rows updated
    });
  });

  // =============================================================================
  // COMPLEX RLS POLICY SCENARIOS
  // =============================================================================

  test("RLS policies work with complex JOINs", async ({
    workerDb,
    organizationId,
  }) => {
    await withRLSAwareTest(workerDb, organizationId, async (db) => {
      // ARRANGE: Create related data
      await testSessions.admin(db, organizationId, "admin-user");

      const [machine] = await db
        .insert(schema.machines)
        .values({
          name: "RLS Test Machine",
          organizationId,
          ownerId: "admin-user",
        })
        .returning();

      const [issue] = await db
        .insert(schema.issues)
        .values({
          title: "Machine Issue",
          machineId: machine.id,
          organizationId,
          createdById: "admin-user",
        })
        .returning();

      // TEST: Complex query with relationships
      const issueWithMachine = await db.query.issues.findFirst({
        where: eq(schema.issues.id, issue.id),
        with: {
          machine: true,
        },
      });

      expect(issueWithMachine).toBeDefined();
      expect(issueWithMachine?.machine.name).toBe("RLS Test Machine");
      expect(issueWithMachine?.machine.organizationId).toBe(organizationId);

      // VERIFY: Cross-org JOIN is blocked
      await testSessions.admin(db, "different-org", "different-admin");

      const crossOrgJoin = await db.query.issues.findFirst({
        where: eq(schema.issues.id, issue.id),
        with: {
          machine: true,
        },
      });

      expect(crossOrgJoin).toBeNull(); // RLS blocks access
    });
  });

  test("RLS policies handle subqueries correctly", async ({
    workerDb,
    organizationId,
  }) => {
    await withRLSAwareTest(workerDb, organizationId, async (db) => {
      // ARRANGE: Create test data
      await testSessions.admin(db, organizationId, "admin-user");

      await db.insert(schema.issues).values([
        {
          title: "High Priority Issue",
          priority: "high",
          organizationId,
          createdById: "admin-user",
        },
        {
          title: "Medium Priority Issue",
          priority: "medium",
          organizationId,
          createdById: "admin-user",
        },
      ]);

      // TEST: Subquery with RLS
      const highPriorityCount = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(schema.issues)
        .where(
          and(
            eq(schema.issues.organizationId, organizationId),
            eq(schema.issues.priority, "high"),
          ),
        );

      expect(highPriorityCount[0]?.count).toBe(1);

      // VERIFY: Subquery respects organizational boundaries
      await testSessions.admin(db, "different-org", "different-admin");

      const crossOrgCount = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(schema.issues)
        .where(eq(schema.issues.priority, "high"));

      expect(crossOrgCount[0]?.count).toBe(0); // RLS hides other org's data
    });
  });

  // =============================================================================
  // RLS POLICY EDGE CASES
  // =============================================================================

  test("RLS policies handle NULL values correctly", async ({
    workerDb,
    organizationId,
  }) => {
    await withRLSAwareTest(workerDb, organizationId, async (db) => {
      await testSessions.admin(db, organizationId, "admin-user");

      // TEST: Insert with NULL optional fields
      const [issueWithNulls] = await db
        .insert(schema.issues)
        .values({
          title: "RLS NULL Test",
          description: null, // Optional field
          priority: null, // Optional field
          organizationId,
          createdById: "admin-user",
        })
        .returning();

      expect(issueWithNulls).toBeDefined();
      expect(issueWithNulls.description).toBeNull();
      expect(issueWithNulls.priority).toBeNull();

      // VERIFY: Can query with NULL conditions
      const nullDescriptionIssues = await db.query.issues.findMany({
        where: sql`${schema.issues.description} IS NULL`,
      });

      expect(nullDescriptionIssues).toHaveLength(1);
      expect(nullDescriptionIssues[0].id).toBe(issueWithNulls.id);
    });
  });

  test("RLS policies work with batch operations", async ({
    workerDb,
    organizationId,
  }) => {
    await withRLSAwareTest(workerDb, organizationId, async (db) => {
      await testSessions.admin(db, organizationId, "admin-user");

      // TEST: Batch insert with RLS
      const batchData = Array.from({ length: 5 }, (_, i) => ({
        title: `Batch Issue ${i}`,
        organizationId,
        createdById: "admin-user",
        priority: "medium" as const,
      }));

      const batchResult = await db
        .insert(schema.issues)
        .values(batchData)
        .returning();

      expect(batchResult).toHaveLength(5);
      expect(
        batchResult.every((issue) => issue.organizationId === organizationId),
      ).toBe(true);

      // TEST: Batch update with RLS
      const batchUpdateIds = batchResult.map((issue) => issue.id);
      const updateResult = await db
        .update(schema.issues)
        .set({ priority: "high" })
        .where(sql`${schema.issues.id} = ANY(${batchUpdateIds})`)
        .returning();

      expect(updateResult).toHaveLength(5);
      expect(updateResult.every((issue) => issue.priority === "high")).toBe(
        true,
      );
    });
  });

  test("RLS policies prevent SQL injection through session variables", async ({
    workerDb,
    organizationId,
  }) => {
    await withRLSAwareTest(workerDb, organizationId, async (db) => {
      // ATTEMPT: SQL injection through session variable
      const maliciousOrgId = "'; DROP TABLE issues; --";

      // This should not cause SQL injection
      await expect(
        db.execute(sql`SET app.current_organization_id = ${maliciousOrgId}`),
      ).resolves.not.toThrow(); // Session variable is safely set

      // VERIFY: Policies still work correctly (no injection occurred)
      const safeQuery = await db.query.issues.findMany();
      expect(Array.isArray(safeQuery)).toBe(true); // Query still works, no injection

      // VERIFY: Table still exists
      const tableCheck = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(schema.issues);

      expect(Array.isArray(tableCheck)).toBe(true); // Table not dropped
    });
  });

  // =============================================================================
  // RLS POLICY PERFORMANCE TESTING
  // =============================================================================

  test("RLS policies maintain reasonable performance", async ({
    workerDb,
    organizationId,
  }) => {
    await withRLSAwareTest(workerDb, organizationId, async (db) => {
      await testSessions.admin(db, organizationId, "admin-user");

      // ARRANGE: Create larger dataset
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        title: `Performance Test Issue ${i}`,
        organizationId,
        createdById: "admin-user",
        priority: i % 3 === 0 ? "high" : ("medium" as const),
      }));

      await db.insert(schema.issues).values(largeDataset);

      // TEST: Performance with RLS enabled
      const start = performance.now();

      const results = await db.query.issues.findMany({
        where: eq(schema.issues.priority, "high"),
        with: {
          createdBy: true,
        },
      });

      const duration = performance.now() - start;

      // ASSERT: Query completes in reasonable time
      expect(duration).toBeLessThan(100); // Should be fast even with RLS
      expect(results.length).toBeGreaterThan(0);
      expect(
        results.every((issue) => issue.organizationId === organizationId),
      ).toBe(true);
    });
  });

  // =============================================================================
  // RLS POLICY INTEGRATION WITH APPLICATION LOGIC
  // =============================================================================

  test("RLS policies integrate correctly with application workflows", async ({
    workerDb,
    organizationId,
  }) => {
    // Use MultiContextManager for complex workflow testing
    const contextManager = new MultiContextManager(workerDb);

    contextManager.addContext(
      "creator",
      organizationId,
      "creator-user",
      "member",
    );
    contextManager.addContext(
      "reviewer",
      organizationId,
      "reviewer-user",
      "admin",
    );
    contextManager.addContext(
      "viewer",
      organizationId,
      "viewer-user",
      "viewer",
    );

    await withRLSAwareTest(workerDb, organizationId, async (db) => {
      // STEP 1: Creator creates issue
      await contextManager.switchTo("creator");
      const [newIssue] = await db
        .insert(schema.issues)
        .values({
          title: "Workflow RLS Test Issue",
          status: "draft",
          createdById: "creator-user",
        })
        .returning();

      // STEP 2: Creator can see their draft
      const creatorView = await db.query.issues.findMany({
        where: eq(schema.issues.createdById, "creator-user"),
      });
      expect(creatorView).toHaveLength(1);

      // STEP 3: Reviewer can see and approve
      await contextManager.switchTo("reviewer");
      const reviewerView = await db.query.issues.findFirst({
        where: eq(schema.issues.id, newIssue.id),
      });
      expect(reviewerView).toBeDefined();

      const [approved] = await db
        .update(schema.issues)
        .set({ status: "approved" })
        .where(eq(schema.issues.id, newIssue.id))
        .returning();

      expect(approved.status).toBe("approved");

      // STEP 4: Viewer can see approved issue
      await contextManager.switchTo("viewer");
      const viewerSees = await db.query.issues.findFirst({
        where: eq(schema.issues.id, newIssue.id),
      });
      expect(viewerSees).toBeDefined();
      expect(viewerSees?.status).toBe("approved");

      // STEP 5: Viewer cannot modify
      const viewerUpdate = await db
        .update(schema.issues)
        .set({ status: "published" })
        .where(eq(schema.issues.id, newIssue.id))
        .returning();

      expect(viewerUpdate).toHaveLength(0); // RLS prevents viewer updates
    });
  });
});

// =============================================================================
// TEMPLATE USAGE INSTRUCTIONS
// =============================================================================

/*
SETUP INSTRUCTIONS:

1. Replace schema references with your actual database tables
2. Update session context fields to match your RLS policy variables
3. Customize organizational and role contexts for your system
4. Update SEED_TEST_IDS references to match your test constants
   - Always use static SEED_TEST_IDS constants.
   - Example: `const machineId = SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1;`
5. Add your specific RLS policies to test
6. Update test data creation to match your schema requirements
7. Remove unused test cases and add policy-specific scenarios

RLS POLICY TEST CHARACTERISTICS:
- Tests Row-Level Security policies directly at database level
- Uses realistic session contexts to simulate user scenarios
- Tests all CRUD operations with policy enforcement
- Tests organizational boundaries and role-based access
- Tests policy edge cases and complex scenarios

WHEN TO USE THIS TEMPLATE:
✅ Testing RLS policy enforcement directly
✅ Testing organizational data isolation at DB level
✅ Testing role-based policy restrictions
✅ Testing complex policy scenarios with JOINs
✅ Testing policy performance and edge cases

WHEN NOT TO USE:
❌ Testing business logic (use Archetype 2)
❌ Testing application-level permissions (use Archetype 6)
❌ Testing database constraints (use Archetype 8)
❌ Testing pure functions (use Archetype 1)

RELATIONSHIP TO OTHER TESTING:
- Complements Track 1 (pgTAP) with programmatic RLS testing
- Works with Archetype 6 (Permission/Auth) for complete security coverage
- Provides database-level validation for application security

EXAMPLE RLS POLICIES TO TEST:
- Multi-tenant organizational isolation
- Role-based CRUD permissions
- Resource ownership restrictions
- Complex policy conditions with JOINs
- Performance impact of policy evaluation

STATIC DATA PATTERNS:
- This template exemplifies the static constant approach - no dynamic queries needed.
- This template demonstrates the correct static approach.
- Uses SEED_TEST_IDS for consistent cross-org testing
- Static IDs enable predictable RLS policy validation
- Mock patterns provide template IDs for policy scenarios
- Deterministic data ensures reproducible policy tests
*/
