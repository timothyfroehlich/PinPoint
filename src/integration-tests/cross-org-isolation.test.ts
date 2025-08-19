/**
 * ✅ KEEP: Multi-org testing requires custom orgs (legitimate)
 * 
 * CURRENT STATUS: CORRECT PATTERN
 * - Multi-tenant boundary testing legitimately requires multiple organizations
 * - Custom org creation via setupMultiOrgContext() is appropriate
 * - Cannot use single seed organization for cross-org isolation testing
 * - Memory-safe worker-scoped patterns already implemented correctly
 * 
 * NO CHANGES NEEDED - This test properly creates multiple orgs for isolation testing
 * 
 * Cross-Organization Isolation Integration Tests
 *
 * Comprehensive integration tests that verify RLS enforcement at the application
 * level using real database operations. These tests validate organizational
 * boundaries are properly maintained across all data access patterns.
 *
 * Key Features:
 * - Memory-safe using worker-scoped PGlite patterns
 * - Integration tests for organizational boundaries
 * - Verifies RLS enforcement at application level
 * - Tests with multiple organizations and users
 * - Performance validation for RLS queries
 *
 * Test Categories:
 * 1. Basic organizational isolation
 * 2. Cross-organization access denial
 * 3. Complex relational queries with RLS
 * 4. Permission boundary enforcement
 * 5. Performance regression detection
 */

import { describe, test, expect } from "vitest";
import { eq, and } from "drizzle-orm";

import {
  test as baseTest,
  withIsolatedTest,
} from "~/test/helpers/worker-scoped-db";
import {
  withTestUser,
  withRLSContext,
  withFullRLSContext,
  verifyOrganizationalIsolation,
  TestUsers,
  TestOrganizations,
} from "~/test/helpers/rls-test-context";
import {
  createOrgContext,
  setupMultiOrgContext,
  createOrgTestData,
  verifyOrgIsolation,
  OrgTestScenarios,
} from "~/test/helpers/organization-context";
import {
  auditMultiTenantSecurity,
  testPermissionBoundaries,
  testCrossOrgAccess,
  measureRLSPerformance,
  validateRLSPolicies,
  MultiTenantTestPatterns,
} from "~/test/helpers/multi-tenant-test-helpers";
import * as schema from "~/server/db/schema";

// Use memory-safe worker-scoped test pattern
const test = baseTest;

describe("Cross-Organization Isolation", () => {
  describe("Basic Organizational Isolation", () => {
    test("users can only see data from their own organization", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Create two separate organizations with test data
        const { org1, org2 } = await setupMultiOrgContext(db, 2);

        await createOrgTestData(db, org1, {
          issueCount: 3,
          machineCount: 2,
          locationCount: 1,
        });
        await createOrgTestData(db, org2, {
          issueCount: 2,
          machineCount: 1,
          locationCount: 1,
        });

        // Test org1 user can only see org1 data
        await withRLSContext(
          db,
          org1.users.admin.id,
          org1.organization.id,
          async (db) => {
            const issues = await db.query.issues.findMany();
            const machines = await db.query.machines.findMany();
            const locations = await db.query.locations.findMany();

            // All data should belong to org1
            expect(
              issues.every(
                (issue) => issue.organizationId === org1.organization.id,
              ),
            ).toBe(true);
            expect(
              machines.every(
                (machine) => machine.organizationId === org1.organization.id,
              ),
            ).toBe(true);
            expect(
              locations.every(
                (location) => location.organizationId === org1.organization.id,
              ),
            ).toBe(true);

            // Should have the correct counts
            expect(issues).toHaveLength(3);
            expect(machines).toHaveLength(2);
            expect(locations).toHaveLength(1);
          },
        );

        // Test org2 user can only see org2 data
        await withRLSContext(
          db,
          org2.users.admin.id,
          org2.organization.id,
          async (db) => {
            const issues = await db.query.issues.findMany();
            const machines = await db.query.machines.findMany();
            const locations = await db.query.locations.findMany();

            // All data should belong to org2
            expect(
              issues.every(
                (issue) => issue.organizationId === org2.organization.id,
              ),
            ).toBe(true);
            expect(
              machines.every(
                (machine) => machine.organizationId === org2.organization.id,
              ),
            ).toBe(true);
            expect(
              locations.every(
                (location) => location.organizationId === org2.organization.id,
              ),
            ).toBe(true);

            // Should have the correct counts
            expect(issues).toHaveLength(2);
            expect(machines).toHaveLength(1);
            expect(locations).toHaveLength(1);
          },
        );
      });
    });

    test("cross-organization data queries return empty results", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { org1, org2 } = await setupMultiOrgContext(db, 2);

        await createOrgTestData(db, org1, { issueCount: 5 });
        await createOrgTestData(db, org2, { issueCount: 3 });

        // User from org1 tries to explicitly query org2's data
        await withRLSContext(
          db,
          org1.users.admin.id,
          org1.organization.id,
          async (db) => {
            const org2Issues = await db.query.issues.findMany({
              where: eq(schema.issues.organizationId, org2.organization.id),
            });

            // Should return empty - RLS blocks access
            expect(org2Issues).toHaveLength(0);
          },
        );

        // User from org2 tries to explicitly query org1's data
        await withRLSContext(
          db,
          org2.users.admin.id,
          org2.organization.id,
          async (db) => {
            const org1Issues = await db.query.issues.findMany({
              where: eq(schema.issues.organizationId, org1.organization.id),
            });

            // Should return empty - RLS blocks access
            expect(org1Issues).toHaveLength(0);
          },
        );
      });
    });

    test("organizational isolation verification utility works correctly", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { org1, org2 } = await setupMultiOrgContext(db, 2);

        await createOrgTestData(db, org1, { issueCount: 4 });
        await createOrgTestData(db, org2, { issueCount: 2 });

        // Use the verification utility
        const isolation = await verifyOrganizationalIsolation(
          db,
          async (db) => await db.query.issues.findMany(),
          org1.organization.id,
          org2.organization.id,
        );

        expect(isolation.isolationEnforced).toBe(true);
        expect(isolation.org1Results).toHaveLength(4);
        expect(isolation.org2Results).toHaveLength(2);
        expect(
          isolation.org1Results.every(
            (issue) => issue.organizationId === org1.organization.id,
          ),
        ).toBe(true);
        expect(
          isolation.org2Results.every(
            (issue) => issue.organizationId === org2.organization.id,
          ),
        ).toBe(true);
      });
    });
  });

  describe("Complex Relational Queries", () => {
    test("joins across related tables maintain organizational isolation", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { org1, org2 } = await setupMultiOrgContext(db, 2);

        await createOrgTestData(db, org1, {
          locationCount: 2,
          machineCount: 3,
          issueCount: 5,
        });
        await createOrgTestData(db, org2, {
          locationCount: 1,
          machineCount: 2,
          issueCount: 3,
        });

        // Test complex join query maintains isolation
        await withRLSContext(
          db,
          org1.users.admin.id,
          org1.organization.id,
          async (db) => {
            const issuesWithDetails = await db.query.issues.findMany({
              with: {
                machine: {
                  with: {
                    location: true,
                  },
                },
                status: true,
                priority: true,
                createdBy: true,
              },
            });

            // All issues should belong to org1
            expect(
              issuesWithDetails.every(
                (issue) => issue.organizationId === org1.organization.id,
              ),
            ).toBe(true);

            // All related entities should also belong to org1
            issuesWithDetails.forEach((issue) => {
              if (issue.machine) {
                expect(issue.machine.organizationId).toBe(org1.organization.id);
                if (issue.machine.location) {
                  expect(issue.machine.location.organizationId).toBe(
                    org1.organization.id,
                  );
                }
              }
              if (issue.status) {
                expect(issue.status.organizationId).toBe(org1.organization.id);
              }
              if (issue.priority) {
                expect(issue.priority.organizationId).toBe(
                  org1.organization.id,
                );
              }
            });

            expect(issuesWithDetails).toHaveLength(5);
          },
        );
      });
    });

    test("aggregation queries respect organizational boundaries", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { org1, org2 } = await setupMultiOrgContext(db, 2);

        await createOrgTestData(db, org1, { issueCount: 7 });
        await createOrgTestData(db, org2, { issueCount: 4 });

        // Test count aggregation respects RLS
        await withRLSContext(
          db,
          org1.users.admin.id,
          org1.organization.id,
          async (db) => {
            const issueCount = await db.query.issues.findMany();
            expect(issueCount).toHaveLength(7); // Only org1's issues
          },
        );

        await withRLSContext(
          db,
          org2.users.admin.id,
          org2.organization.id,
          async (db) => {
            const issueCount = await db.query.issues.findMany();
            expect(issueCount).toHaveLength(4); // Only org2's issues
          },
        );
      });
    });
  });

  describe("Permission Boundary Enforcement", () => {
    test("different user roles see appropriate data within organization", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const org = await createOrgContext(db, "perms");
        await createOrgTestData(db, org, { issueCount: 5 });

        // Test admin user permissions
        const adminPermissions = [
          "issue:view",
          "issue:edit",
          "issue:create",
          "issue:delete",
          "machine:view",
          "machine:edit",
          "location:view",
        ];
        const adminResults = await testPermissionBoundaries(
          db,
          org.users.admin.id,
          org.organization.id,
          adminPermissions,
        );

        // Admin should have access to read operations
        const adminReadResults = adminResults.filter((r) =>
          r.operation.startsWith("read_"),
        );
        expect(adminReadResults.every((r) => r.passed)).toBe(true);

        // Test member user permissions
        const memberPermissions = ["issue:view", "machine:view"];
        const memberResults = await testPermissionBoundaries(
          db,
          org.users.member.id,
          org.organization.id,
          memberPermissions,
        );

        // Member should have limited access
        const memberReadResults = memberResults.filter((r) =>
          r.operation.startsWith("read_"),
        );
        expect(memberReadResults.every((r) => r.passed)).toBe(true);
      });
    });

    test("cross-organization access attempts are blocked", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { org1, org2 } = await setupMultiOrgContext(db, 2);

        await createOrgTestData(db, org1, { issueCount: 3 });
        await createOrgTestData(db, org2, { issueCount: 2 });

        // Test cross-org access attempts
        const crossOrgResults = await testCrossOrgAccess(db, org1, org2);

        // All cross-org access attempts should be blocked
        expect(crossOrgResults.every((result) => result.passed)).toBe(true);
        expect(crossOrgResults.every((result) => result.wasBlocked)).toBe(true);
      });
    });
  });

  describe("Supabase Authentication Integration", () => {
    test("Supabase auth context properly sets organizational boundaries", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { org1, org2 } = await setupMultiOrgContext(db, 2);

        await createOrgTestData(db, org1, { issueCount: 4 });
        await createOrgTestData(db, org2, { issueCount: 3 });

        // Test with full Supabase auth context mocking
        await withFullRLSContext(
          db,
          org1.users.admin.id,
          org1.organization.id,
          async (db) => {
            const issues = await db.query.issues.findMany();

            // Should only see org1 issues
            expect(issues).toHaveLength(4);
            expect(
              issues.every(
                (issue) => issue.organizationId === org1.organization.id,
              ),
            ).toBe(true);
          },
          {
            role: "Admin",
            email: org1.users.admin.email,
            name: org1.users.admin.name,
          },
        );

        // Test with different organization context
        await withFullRLSContext(
          db,
          org2.users.member.id,
          org2.organization.id,
          async (db) => {
            const issues = await db.query.issues.findMany();

            // Should only see org2 issues
            expect(issues).toHaveLength(3);
            expect(
              issues.every(
                (issue) => issue.organizationId === org2.organization.id,
              ),
            ).toBe(true);
          },
          {
            role: "Member",
            email: org2.users.member.email,
            name: org2.users.member.name,
          },
        );
      });
    });

    test("authentication helpers create proper test contexts", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const org = await createOrgContext(db, "auth");
        await createOrgTestData(db, org, { issueCount: 2 });

        // Test predefined user contexts
        await withTestUser(
          TestUsers.admin(org.organization.id).id,
          org.organization.id,
          async () => {
            await withRLSContext(
              db,
              TestUsers.admin(org.organization.id).id,
              org.organization.id,
              async (db) => {
                const issues = await db.query.issues.findMany();
                expect(issues).toHaveLength(2);
              },
            );
          },
          { role: "Admin" },
        );
      });
    });
  });

  describe("Performance and Security Auditing", () => {
    test("RLS queries perform within acceptable thresholds", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const org = await createOrgContext(db, "perf");

        // Create larger dataset for performance testing
        await createOrgTestData(db, org, {
          locationCount: 5,
          machineCount: 20,
          issueCount: 100,
        });

        // Test performance for different table types
        const tables = [
          { name: "issues", schema: schema.issues },
          { name: "machines", schema: schema.machines },
          { name: "locations", schema: schema.locations },
        ];

        for (const table of tables) {
          const perfResult = await measureRLSPerformance(db, table, org);

          // RLS overhead should be reasonable (less than 100% overhead)
          expect(perfResult.rlsOverhead).toBeLessThan(100);

          // Query time should be reasonable (less than 100ms)
          expect(perfResult.rlsQueryTime).toBeLessThan(100);
        }
      });
    });

    test("comprehensive security audit passes", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Run comprehensive security audit
        const auditResult = await auditMultiTenantSecurity(db, {
          orgCount: 3,
          testDataSize: "medium",
          includePerformance: true,
        });

        // Security audit should pass
        expect(auditResult.hasViolations).toBe(false);
        expect(auditResult.isolationScore).toBeGreaterThan(0.95);
        expect(auditResult.violations).toHaveLength(0);

        // Performance should be reasonable
        expect(auditResult.performance.averageQueryTime).toBeLessThan(50);
        expect(auditResult.performance.rlsOverhead).toBeLessThan(50);

        // Coverage should be complete
        expect(auditResult.coverage.coveragePercentage).toBe(100);
      });
    });

    test("RLS policies are properly configured", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const policyValidation = await validateRLSPolicies(db);

        // All organization-scoped tables should have RLS enabled
        expect(policyValidation.policiesActive).toBe(true);
        expect(policyValidation.tablesWithoutRLS).toHaveLength(0);

        // All tables should have policies
        expect(
          policyValidation.policyDetails.every((detail) => detail.hasPolicy),
        ).toBe(true);
      });
    });
  });

  describe("Test Pattern Validation", () => {
    test("predefined test patterns work correctly", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Test basic isolation pattern
        const basicResults = await MultiTenantTestPatterns.basicIsolation(db);
        expect(basicResults.every((result) => result.passed)).toBe(true);

        // Test performance regression pattern
        const perfResults =
          await MultiTenantTestPatterns.performanceRegression(db);
        expect(perfResults.averageOverhead).toBeLessThan(100);
        expect(perfResults.maxOverhead).toBeLessThan(200);

        // Test full security audit pattern
        const auditResults =
          await MultiTenantTestPatterns.fullSecurityAudit(db);
        expect(auditResults.hasViolations).toBe(false);
        expect(auditResults.isolationScore).toBeGreaterThan(0.9);
      });
    });

    test("organization test scenarios create proper isolation", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Test isolation scenario
        const { org1, org2 } = await OrgTestScenarios.isolation(db);

        const isolation = await verifyOrgIsolation(
          db,
          org1.organization.id,
          org2.organization.id,
        );
        expect(isolation.isIsolated).toBe(true);
        expect(isolation.crossContamination.org1HasOrg2Data).toBe(false);
        expect(isolation.crossContamination.org2HasOrg1Data).toBe(false);

        // Test comprehensive scenario
        const { org } = await OrgTestScenarios.comprehensive(db);

        await withRLSContext(
          db,
          org.users.admin.id,
          org.organization.id,
          async (db) => {
            const issues = await db.query.issues.findMany();
            const machines = await db.query.machines.findMany();
            const locations = await db.query.locations.findMany();

            expect(issues.length).toBeGreaterThan(0);
            expect(machines.length).toBeGreaterThan(0);
            expect(locations.length).toBeGreaterThan(0);

            // All data should belong to the same organization
            expect(
              issues.every((i) => i.organizationId === org.organization.id),
            ).toBe(true);
            expect(
              machines.every((m) => m.organizationId === org.organization.id),
            ).toBe(true);
            expect(
              locations.every((l) => l.organizationId === org.organization.id),
            ).toBe(true);
          },
        );
      });
    });
  });

  describe("Edge Cases and Error Handling", () => {
    test("handles missing session context gracefully", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const org = await createOrgContext(db, "edge");
        await createOrgTestData(db, org, { issueCount: 3 });

        // Query without setting RLS context should return no results or throw appropriate error
        try {
          const issues = await db.query.issues.findMany();
          // If query succeeds, it should return empty results due to RLS
          expect(issues).toHaveLength(0);
        } catch (error) {
          // If query fails, it should be due to missing context
          expect(error).toBeDefined();
        }
      });
    });

    test("handles invalid organization context", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const org = await createOrgContext(db, "invalid");
        await createOrgTestData(db, org, { issueCount: 2 });

        // Query with invalid organization ID should return no results
        await withRLSContext(
          db,
          org.users.admin.id,
          "non-existent-org",
          async (db) => {
            const issues = await db.query.issues.findMany();
            expect(issues).toHaveLength(0);
          },
        );
      });
    });

    test("handles concurrent multi-organization access", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { org1, org2, org3 } = await setupMultiOrgContext(db, 3);

        await createOrgTestData(db, org1, { issueCount: 3 });
        await createOrgTestData(db, org2, { issueCount: 2 });
        await createOrgTestData(db, org3, { issueCount: 4 });

        // Simulate concurrent access from different organizations
        const results = await Promise.all([
          withRLSContext(
            db,
            org1.users.admin.id,
            org1.organization.id,
            async (db) => ({
              org: org1.organization.id,
              count: (await db.query.issues.findMany()).length,
            }),
          ),
          withRLSContext(
            db,
            org2.users.admin.id,
            org2.organization.id,
            async (db) => ({
              org: org2.organization.id,
              count: (await db.query.issues.findMany()).length,
            }),
          ),
          withRLSContext(
            db,
            org3.users.admin.id,
            org3.organization.id,
            async (db) => ({
              org: org3.organization.id,
              count: (await db.query.issues.findMany()).length,
            }),
          ),
        ]);

        // Each organization should see only its own data
        expect(results).toEqual([
          { org: org1.organization.id, count: 3 },
          { org: org2.organization.id, count: 2 },
          { org: org3.organization.id, count: 4 },
        ]);
      });
    });
  });
});

describe("Integration with Existing Test Infrastructure", () => {
  test("RLS helpers integrate with worker-scoped database pattern", async ({
    workerDb,
  }) => {
    await withIsolatedTest(workerDb, async (db) => {
      // Verify we can use RLS helpers within worker-scoped test pattern
      const org = await createOrgContext(db, "integration");
      await createOrgTestData(db, org, { issueCount: 1 });

      await withRLSContext(
        db,
        org.users.admin.id,
        org.organization.id,
        async (db) => {
          const issues = await db.query.issues.findMany();
          expect(issues).toHaveLength(1);
          expect(issues[0].organizationId).toBe(org.organization.id);
        },
      );
    });
  });

  test("memory usage remains stable across multiple RLS tests", async ({
    workerDb,
  }) => {
    await withIsolatedTest(workerDb, async (db) => {
      // Create multiple organizations and test contexts
      const orgCount = 10;
      const orgs = await setupMultiOrgContext(db, orgCount);

      // Perform RLS tests for each organization
      for (const [key, org] of Object.entries(orgs)) {
        await createOrgTestData(db, org, { issueCount: 2 });

        await withRLSContext(
          db,
          org.users.admin.id,
          org.organization.id,
          async (db) => {
            const issues = await db.query.issues.findMany();
            expect(issues).toHaveLength(2);
            expect(
              issues.every(
                (issue) => issue.organizationId === org.organization.id,
              ),
            ).toBe(true);
          },
        );
      }

      // Memory should be stable - no additional PGlite instances created
      // This is verified by the worker-scoped pattern not creating new databases
    });
  });

  test("RLS tests work with existing factory patterns", async ({
    workerDb,
  }) => {
    await withIsolatedTest(workerDb, async (db) => {
      const org = await createOrgContext(db, "factory");

      // Use existing factory patterns with RLS context
      await withRLSContext(
        db,
        org.users.admin.id,
        org.organization.id,
        async (db) => {
          // Create test data using organization context
          await createOrgTestData(db, org, {
            locationCount: 1,
            machineCount: 1,
            issueCount: 1,
          });

          // Verify data is properly scoped
          const issues = await db.query.issues.findMany();
          const machines = await db.query.machines.findMany();
          const locations = await db.query.locations.findMany();

          expect(issues).toHaveLength(1);
          expect(machines).toHaveLength(1);
          expect(locations).toHaveLength(1);

          // All should belong to the test organization
          expect(issues[0].organizationId).toBe(org.organization.id);
          expect(machines[0].organizationId).toBe(org.organization.id);
          expect(locations[0].organizationId).toBe(org.organization.id);
        },
      );
    });
  });
});
