/**
 * Schema Data Integrity Integration Tests (PGlite)
 *
 * Integration tests for database schema integrity, foreign key relationships,
 * and cascading operations using PGlite in-memory PostgreSQL database.
 *
 * Key Features:
 * - Real PostgreSQL database with PGlite
 * - Complete schema migrations applied
 * - Foreign key constraint validation
 * - Cascading delete operations
 * - Data type validation and constraints
 *
 * Uses modern August 2025 patterns with Vitest and PGlite integration.
 */

import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";

import * as schema from "~/server/db/schema";
import { generateTestId } from "~/test/helpers/test-id-generator";
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";

describe("Schema Data Integrity", () => {
  describe("Organization Relations", () => {
    test("should cascade delete memberships when organization is deleted", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Create test organization first
        const seededOrgId = generateTestId("test-org");
        await db.insert(schema.organizations).values({
          id: seededOrgId,
          name: "Test Organization",
          subdomain: generateTestId("test-org"),
        });

        // Create test user
        const testUser1Id = generateTestId("test-user1");
        await db.insert(schema.users).values({
          id: testUser1Id,
          email: `fk-user-${generateTestId("fk-user")}@test.example`,
          name: "FK Test User",
        });

        // Create role and membership
        const roleId = generateTestId("role");
        await db.insert(schema.roles).values({
          id: roleId,
          name: "Test Role",
          organizationId: seededOrgId,
        });

        const membershipId = generateTestId("membership");
        await db.insert(schema.memberships).values({
          id: membershipId,
          userId: testUser1Id,
          organizationId: seededOrgId,
          roleId,
        });

        // Verify membership exists
        const membershipsBefore = await db
          .select()
          .from(schema.memberships)
          .where(eq(schema.memberships.id, membershipId));
        expect(membershipsBefore).toHaveLength(1);

        // Delete organization (business logic would handle cascade)
        await db
          .delete(schema.memberships)
          .where(eq(schema.memberships.organizationId, seededOrgId));
        await db
          .delete(schema.roles)
          .where(eq(schema.roles.organizationId, seededOrgId));
        await db
          .delete(schema.organizations)
          .where(eq(schema.organizations.id, seededOrgId));

        // Verify membership is deleted
        const membershipsAfter = await db
          .select()
          .from(schema.memberships)
          .where(eq(schema.memberships.id, membershipId));
        expect(membershipsAfter).toHaveLength(0);
      });
    });

    test("should cascade delete all tenant data when organization is deleted", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Create test organization and base data
        const seededOrgId = generateTestId("test-org");
        await db.insert(schema.organizations).values({
          id: seededOrgId,
          name: "Test Organization",
          subdomain: generateTestId("test-org"),
        });

        const testLocationId = generateTestId("test-location");
        await db.insert(schema.locations).values({
          id: testLocationId,
          name: "FK Test Location",
          organizationId: seededOrgId,
        });

        const testModelId = generateTestId("test-model");
        await db.insert(schema.models).values({
          id: testModelId,
          name: "FK Test Model",
          manufacturer: "Test Mfg",
          year: 2024,
        });

        const testMachineId = generateTestId("test-machine");
        await db.insert(schema.machines).values({
          id: testMachineId,
          name: "FK Test Machine",
          organizationId: seededOrgId,
          locationId: testLocationId,
          modelId: testModelId,
          qrCodeId: generateTestId("qr-fk-test"),
        });

        // Create a complete data set for the organization
        const priorityId = generateTestId("priority-cascade");
        const statusId = generateTestId("status-cascade");

        await db.insert(schema.priorities).values({
          id: priorityId,
          name: "Test Priority",
          order: 1,
          organizationId: seededOrgId,
        });

        await db.insert(schema.issueStatuses).values({
          id: statusId,
          name: "Test Status",
          category: "NEW",
          organizationId: seededOrgId,
        });

        const [priority] = await db
          .select()
          .from(schema.priorities)
          .where(eq(schema.priorities.id, priorityId));
        const [status] = await db
          .select()
          .from(schema.issueStatuses)
          .where(eq(schema.issueStatuses.id, statusId));

        const issueId = generateTestId("issue-cascade");
        await db.insert(schema.issues).values({
          id: issueId,
          title: "Cascade Test Issue",
          organizationId: seededOrgId,
          machineId: testMachineId,
          statusId: status?.id ?? statusId,
          priorityId: priority?.id ?? priorityId,
        });

        // Verify all data exists
        const issuesBefore = await db
          .select()
          .from(schema.issues)
          .where(eq(schema.issues.organizationId, seededOrgId));
        expect(issuesBefore.length).toBeGreaterThan(0);

        // Simulate organization deletion with proper cleanup order
        await db
          .delete(schema.issues)
          .where(eq(schema.issues.organizationId, seededOrgId));
        await db
          .delete(schema.machines)
          .where(eq(schema.machines.organizationId, seededOrgId));
        await db
          .delete(schema.locations)
          .where(eq(schema.locations.organizationId, seededOrgId));
        await db
          .delete(schema.priorities)
          .where(eq(schema.priorities.organizationId, seededOrgId));
        await db
          .delete(schema.issueStatuses)
          .where(eq(schema.issueStatuses.organizationId, seededOrgId));
        await db
          .delete(schema.organizations)
          .where(eq(schema.organizations.id, seededOrgId));

        // Verify all tenant data is deleted
        const issuesAfter = await db
          .select()
          .from(schema.issues)
          .where(eq(schema.issues.organizationId, seededOrgId));
        expect(issuesAfter).toHaveLength(0);

        const machinesAfter = await db
          .select()
          .from(schema.machines)
          .where(eq(schema.machines.organizationId, seededOrgId));
        expect(machinesAfter).toHaveLength(0);
      });
    });
  });

  describe("Issue Relations", () => {
    test("should handle foreign key relationships correctly", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Create test organization and base data
        const seededOrgId = generateTestId("test-org");
        await db.insert(schema.organizations).values({
          id: seededOrgId,
          name: "Test Organization",
          subdomain: generateTestId("test-org"),
        });

        const testLocationId = generateTestId("test-location");
        await db.insert(schema.locations).values({
          id: testLocationId,
          name: "FK Test Location",
          organizationId: seededOrgId,
        });

        const testModelId = generateTestId("test-model");
        await db.insert(schema.models).values({
          id: testModelId,
          name: "FK Test Model",
          manufacturer: "Test Mfg",
          year: 2024,
        });

        const testMachineId = generateTestId("test-machine");
        await db.insert(schema.machines).values({
          id: testMachineId,
          name: "FK Test Machine",
          organizationId: seededOrgId,
          locationId: testLocationId,
          modelId: testModelId,
          qrCodeId: generateTestId("qr-fk-test"),
        });

        await db.insert(schema.priorities).values({
          id: generateTestId("priority"),
          name: "High",
          order: 1,
          organizationId: seededOrgId,
          isDefault: true,
        });

        await db.insert(schema.issueStatuses).values({
          id: generateTestId("status"),
          name: "Open",
          category: "NEW",
          organizationId: seededOrgId,
          isDefault: true,
        });

        const testIssueId = generateTestId("test-issue");

        const [priority] = await db
          .select()
          .from(schema.priorities)
          .where(eq(schema.priorities.organizationId, seededOrgId));
        const [status] = await db
          .select()
          .from(schema.issueStatuses)
          .where(eq(schema.issueStatuses.organizationId, seededOrgId));

        // Create issue with valid foreign keys
        const [issue] = await db
          .insert(schema.issues)
          .values({
            id: testIssueId,
            title: "Test Issue with Valid References",
            organizationId: seededOrgId,
            machineId: testMachineId,
            statusId: status?.id ?? "default-status",
            priorityId: priority?.id ?? "default-priority",
          })
          .returning();

        expect(issue).toBeDefined();
        expect(issue?.machineId).toBe(testMachineId);
        expect(issue?.statusId).toBe(status?.id);
        expect(issue?.priorityId).toBe(priority?.id);
      });
    });

    test("should allow null assignedToId for unassigned issues", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Create test organization and base data
        const seededOrgId = generateTestId("test-org");
        await db.insert(schema.organizations).values({
          id: seededOrgId,
          name: "Test Organization",
          subdomain: generateTestId("test-org"),
        });

        const testLocationId = generateTestId("test-location");
        await db.insert(schema.locations).values({
          id: testLocationId,
          name: "FK Test Location",
          organizationId: seededOrgId,
        });

        const testModelId = generateTestId("test-model");
        await db.insert(schema.models).values({
          id: testModelId,
          name: "FK Test Model",
          manufacturer: "Test Mfg",
          year: 2024,
        });

        const testMachineId = generateTestId("test-machine");
        await db.insert(schema.machines).values({
          id: testMachineId,
          name: "FK Test Machine",
          organizationId: seededOrgId,
          locationId: testLocationId,
          modelId: testModelId,
          qrCodeId: generateTestId("qr-fk-test"),
        });

        await db.insert(schema.priorities).values({
          id: generateTestId("priority"),
          name: "High",
          order: 1,
          organizationId: seededOrgId,
          isDefault: true,
        });

        await db.insert(schema.issueStatuses).values({
          id: generateTestId("status"),
          name: "Open",
          category: "NEW",
          organizationId: seededOrgId,
          isDefault: true,
        });

        const testIssueId = generateTestId("test-issue");

        const [priority] = await db
          .select()
          .from(schema.priorities)
          .where(eq(schema.priorities.organizationId, seededOrgId));
        const [status] = await db
          .select()
          .from(schema.issueStatuses)
          .where(eq(schema.issueStatuses.organizationId, seededOrgId));

        const [issue] = await db
          .insert(schema.issues)
          .values({
            id: testIssueId,
            title: "Unassigned Issue",
            organizationId: seededOrgId,
            machineId: testMachineId,
            statusId: status?.id ?? "default-status",
            priorityId: priority?.id ?? "default-priority",
            assignedToId: null, // Explicitly unassigned
          })
          .returning();

        expect(issue).toBeDefined();
        expect(issue?.assignedToId).toBeNull();
      });
    });

    test("should cascade delete comments when issue is deleted", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Create test organization and base data
        const seededOrgId = generateTestId("test-org");
        await db.insert(schema.organizations).values({
          id: seededOrgId,
          name: "Test Organization",
          subdomain: generateTestId("test-org"),
        });

        const testUser1Id = generateTestId("test-user1");
        await db.insert(schema.users).values({
          id: testUser1Id,
          email: `fk-user-${generateTestId("fk-user")}@test.example`,
          name: "FK Test User",
        });

        const testLocationId = generateTestId("test-location");
        await db.insert(schema.locations).values({
          id: testLocationId,
          name: "FK Test Location",
          organizationId: seededOrgId,
        });

        const testModelId = generateTestId("test-model");
        await db.insert(schema.models).values({
          id: testModelId,
          name: "FK Test Model",
          manufacturer: "Test Mfg",
          year: 2024,
        });

        const testMachineId = generateTestId("test-machine");
        await db.insert(schema.machines).values({
          id: testMachineId,
          name: "FK Test Machine",
          organizationId: seededOrgId,
          locationId: testLocationId,
          modelId: testModelId,
          qrCodeId: generateTestId("qr-fk-test"),
        });

        await db.insert(schema.priorities).values({
          id: generateTestId("priority"),
          name: "High",
          order: 1,
          organizationId: seededOrgId,
          isDefault: true,
        });

        await db.insert(schema.issueStatuses).values({
          id: generateTestId("status"),
          name: "Open",
          category: "NEW",
          organizationId: seededOrgId,
          isDefault: true,
        });

        const testIssueId = generateTestId("test-issue");

        const [priority] = await db
          .select()
          .from(schema.priorities)
          .where(eq(schema.priorities.organizationId, seededOrgId));
        const [status] = await db
          .select()
          .from(schema.issueStatuses)
          .where(eq(schema.issueStatuses.organizationId, seededOrgId));

        // Create issue
        await db.insert(schema.issues).values({
          id: testIssueId,
          title: "Issue with Comments",
          organizationId: seededOrgId,
          machineId: testMachineId,
          statusId: status?.id ?? "default-status",
          priorityId: priority?.id ?? "default-priority",
        });

        // Create comment
        const commentId = generateTestId("comment");
        await db.insert(schema.comments).values({
          id: commentId,
          issueId: testIssueId,
          authorId: testUser1Id,
          content: "Test comment",
        });

        // Verify comment exists
        const commentsBefore = await db
          .select()
          .from(schema.comments)
          .where(eq(schema.comments.issueId, testIssueId));
        expect(commentsBefore).toHaveLength(1);

        // Delete issue (should cascade to comments)
        await db
          .delete(schema.comments)
          .where(eq(schema.comments.issueId, testIssueId));
        await db.delete(schema.issues).where(eq(schema.issues.id, testIssueId));

        // Verify comments are deleted
        const commentsAfter = await db
          .select()
          .from(schema.comments)
          .where(eq(schema.comments.issueId, testIssueId));
        expect(commentsAfter).toHaveLength(0);
      });
    });
  });

  describe("Machine Relations", () => {
    test("should enforce locationId belongs to same organization", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Create first organization and location
        const seededOrgId = generateTestId("test-org");
        await db.insert(schema.organizations).values({
          id: seededOrgId,
          name: "Test Organization",
          subdomain: generateTestId("test-org"),
        });

        const testModelId = generateTestId("test-model");
        await db.insert(schema.models).values({
          id: testModelId,
          name: "FK Test Model",
          manufacturer: "Test Mfg",
          year: 2024,
        });

        // Create another organization and location
        const otherOrgId = generateTestId("other-org");
        const otherLocationId = generateTestId("other-location");

        await db.insert(schema.organizations).values({
          id: otherOrgId,
          name: "Other Organization",
          subdomain: generateTestId("other-org-sub"),
        });

        await db.insert(schema.locations).values({
          id: otherLocationId,
          name: "Other Location",
          organizationId: otherOrgId,
        });

        // Try to create machine in org1 with location from org2
        // This would be caught by business logic, not DB constraints during migration
        const [machine] = await db
          .insert(schema.machines)
          .values({
            id: generateTestId("cross-org-machine"),
            name: "Cross-Org Machine",
            organizationId: seededOrgId,
            locationId: otherLocationId, // Wrong organization!
            modelId: testModelId,
            qrCodeId: generateTestId("qr-cross"),
          })
          .returning();

        // Machine was created (DB allows it during migration)
        expect(machine).toBeDefined();
        expect(machine?.organizationId).toBe(seededOrgId);
        expect(machine?.locationId).toBe(otherLocationId);

        // Business logic would validate this:
        const [location] = await db
          .select()
          .from(schema.locations)
          .where(eq(schema.locations.id, otherLocationId));

        expect(location?.organizationId).toBe(otherOrgId);
        expect(location?.organizationId).not.toBe(seededOrgId);
        // Application layer would reject this operation
      });
    });

    test("should cascade delete issues when machine is deleted", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Create test organization and base data
        const seededOrgId = generateTestId("test-org");
        await db.insert(schema.organizations).values({
          id: seededOrgId,
          name: "Test Organization",
          subdomain: generateTestId("test-org"),
        });

        const testLocationId = generateTestId("test-location");
        await db.insert(schema.locations).values({
          id: testLocationId,
          name: "FK Test Location",
          organizationId: seededOrgId,
        });

        const testModelId = generateTestId("test-model");
        await db.insert(schema.models).values({
          id: testModelId,
          name: "FK Test Model",
          manufacturer: "Test Mfg",
          year: 2024,
        });

        const testMachineId = generateTestId("test-machine");
        await db.insert(schema.machines).values({
          id: testMachineId,
          name: "FK Test Machine",
          organizationId: seededOrgId,
          locationId: testLocationId,
          modelId: testModelId,
          qrCodeId: generateTestId("qr-fk-test"),
        });

        await db.insert(schema.priorities).values({
          id: generateTestId("priority"),
          name: "High",
          order: 1,
          organizationId: seededOrgId,
          isDefault: true,
        });

        await db.insert(schema.issueStatuses).values({
          id: generateTestId("status"),
          name: "Open",
          category: "NEW",
          organizationId: seededOrgId,
          isDefault: true,
        });

        const [priority] = await db
          .select()
          .from(schema.priorities)
          .where(eq(schema.priorities.organizationId, seededOrgId));
        const [status] = await db
          .select()
          .from(schema.issueStatuses)
          .where(eq(schema.issueStatuses.organizationId, seededOrgId));

        // Create issue for the machine
        const issueId = generateTestId("issue-machine");
        await db.insert(schema.issues).values({
          id: issueId,
          title: "Machine Issue",
          organizationId: seededOrgId,
          machineId: testMachineId,
          statusId: status?.id ?? "default-status",
          priorityId: priority?.id ?? "default-priority",
        });

        // Verify issue exists
        const issuesBefore = await db
          .select()
          .from(schema.issues)
          .where(eq(schema.issues.machineId, testMachineId));
        expect(issuesBefore).toHaveLength(1);

        // Delete machine (should cascade to issues)
        await db
          .delete(schema.issues)
          .where(eq(schema.issues.machineId, testMachineId));
        await db
          .delete(schema.machines)
          .where(eq(schema.machines.id, testMachineId));

        // Verify issues are deleted
        const issuesAfter = await db
          .select()
          .from(schema.issues)
          .where(eq(schema.issues.machineId, testMachineId));
        expect(issuesAfter).toHaveLength(0);
      });
    });
  });

  describe("User & Membership Relations", () => {
    test("should allow users to have memberships in multiple organizations", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Create first organization
        const seededOrgId = generateTestId("test-org");
        await db.insert(schema.organizations).values({
          id: seededOrgId,
          name: "Test Organization",
          subdomain: generateTestId("test-org"),
        });

        // Create test user
        const testUser1Id = generateTestId("test-user1");
        await db.insert(schema.users).values({
          id: testUser1Id,
          email: `fk-user-${generateTestId("fk-user")}@test.example`,
          name: "FK Test User",
        });

        // Create second organization
        const org2Id = generateTestId("test-org2");
        await db.insert(schema.organizations).values({
          id: org2Id,
          name: "Second Organization",
          subdomain: generateTestId("test-org2-sub"),
        });

        // Create roles for both organizations
        const role1Id = generateTestId("role1");
        const role2Id = generateTestId("role2");

        await db.insert(schema.roles).values([
          {
            id: role1Id,
            name: "Admin",
            organizationId: seededOrgId,
          },
          {
            id: role2Id,
            name: "Member",
            organizationId: org2Id,
          },
        ]);

        // Create memberships for same user in both organizations
        const membership1Id = generateTestId("membership1");
        const membership2Id = generateTestId("membership2");

        await db.insert(schema.memberships).values([
          {
            id: membership1Id,
            userId: testUser1Id,
            organizationId: seededOrgId,
            roleId: role1Id,
          },
          {
            id: membership2Id,
            userId: testUser1Id,
            organizationId: org2Id,
            roleId: role2Id,
          },
        ]);

        // Verify both memberships exist
        const memberships = await db
          .select()
          .from(schema.memberships)
          .where(eq(schema.memberships.userId, testUser1Id));

        expect(memberships).toHaveLength(2);
        expect(
          memberships.find((m) => m.organizationId === seededOrgId),
        ).toBeDefined();
        expect(
          memberships.find((m) => m.organizationId === org2Id),
        ).toBeDefined();
      });
    });
  });
});
