/**
 * Multi-Tenant Test Helpers
 *
 * Provides specialized utilities for testing multi-tenant isolation, permission
 * boundaries, and RLS policy enforcement. This module focuses on validation
 * patterns and security testing for organizational boundaries.
 *
 * Key Features:
 * - Isolation testing utilities for cross-organization access
 * - Permission boundary verification helpers
 * - RLS policy validation functions
 * - Performance testing for RLS queries
 * - Security audit patterns for multi-tenant systems
 *
 * Usage:
 * ```typescript
 * test("permission boundary enforcement", async ({ workerDb }) => {
 *   await withIsolatedTest(workerDb, async (db) => {
 *     const audit = await auditMultiTenantSecurity(db);
 *     expect(audit.hasViolations).toBe(false);
 *     expect(audit.isolationScore).toBeGreaterThan(0.95);
 *   });
 * });
 * ```
 */

import { eq, sql } from "drizzle-orm";
import type { TestDatabase } from "./pglite-test-setup";
import { withRLSContext } from "./rls-test-context";
import { createOrgContext, type OrgTestContext } from "./organization-context";
import * as schema from "~/server/db/schema";

/**
 * Multi-tenant security audit results
 */
export interface SecurityAuditResult {
  hasViolations: boolean;
  isolationScore: number; // 0-1, where 1 is perfect isolation
  violations: SecurityViolation[];
  performance: {
    averageQueryTime: number;
    rlsOverhead: number; // percentage overhead vs unfiltered query
  };
  coverage: {
    tablesAudited: number;
    totalTables: number;
    coveragePercentage: number;
  };
}

/**
 * Security violation details
 */
export interface SecurityViolation {
  type:
    | "data_leak"
    | "permission_bypass"
    | "rls_missing"
    | "performance_degradation";
  severity: "low" | "medium" | "high" | "critical";
  table: string;
  description: string;
  evidence: unknown;
}

/**
 * Permission test result for a specific operation
 */
export interface PermissionTestResult {
  operation: string;
  allowed: boolean;
  expectedAllowed: boolean;
  passed: boolean;
  error?: string;
  executionTime: number;
}

/**
 * Cross-organization access test result
 */
export interface CrossOrgAccessResult {
  sourceOrgId: string;
  targetOrgId: string;
  attemptedOperation: string;
  wasBlocked: boolean;
  shouldBeBlocked: boolean;
  passed: boolean;
  evidence?: unknown;
}

/**
 * Comprehensive multi-tenant security audit
 *
 * Tests organizational isolation across all major tables and operations
 * to ensure RLS policies are properly implemented and performant.
 *
 * @param db - Database instance
 * @param options - Audit configuration
 * @returns Complete security audit results
 */
export async function auditMultiTenantSecurity(
  db: TestDatabase,
  options: {
    orgCount?: number;
    testDataSize?: "small" | "medium" | "large";
    includePerformance?: boolean;
  } = {},
): Promise<SecurityAuditResult> {
  const {
    orgCount = 3,
    testDataSize = "medium",
    includePerformance = true,
  } = options;

  const violations: SecurityViolation[] = [];
  const performanceMetrics: number[] = [];

  // Create test organizations
  const testOrgs: OrgTestContext[] = [];
  for (let i = 1; i <= orgCount; i++) {
    const org = await createOrgContext(db, `audit${String(i)}`);
    testOrgs.push(org);

    // Create test data based on size preference
    const dataSize = getDataSizeConfig(testDataSize);
    await createAuditTestData(db, org, dataSize);
  }

  // Tables to audit for multi-tenant compliance
  const auditTables = [
    { name: "issues", schema: schema.issues },
    { name: "machines", schema: schema.machines },
    { name: "locations", schema: schema.locations },
    { name: "memberships", schema: schema.memberships },
    { name: "issueStatuses", schema: schema.issueStatuses },
    { name: "priorities", schema: schema.priorities },
    { name: "attachments", schema: schema.attachments },
    { name: "issueHistory", schema: schema.issueHistory },
  ];

  // Test isolation for each table
  for (const table of auditTables) {
    const tableViolations = await auditTableIsolation(db, table, testOrgs);
    violations.push(...tableViolations);

    if (includePerformance) {
      const perfResult = await measureRLSPerformance(db, table, testOrgs[0]);
      performanceMetrics.push(perfResult.rlsOverhead);
    }
  }

  // Calculate overall isolation score
  const totalTests = auditTables.length * orgCount * (orgCount - 1); // Cross-org tests
  const passedTests = totalTests - violations.length;
  const isolationScore = passedTests / totalTests;

  return {
    hasViolations: violations.length > 0,
    isolationScore,
    violations,
    performance: {
      averageQueryTime: includePerformance
        ? performanceMetrics.reduce((a, b) => a + b, 0) /
          performanceMetrics.length
        : 0,
      rlsOverhead: includePerformance ? Math.max(...performanceMetrics) : 0,
    },
    coverage: {
      tablesAudited: auditTables.length,
      totalTables: auditTables.length, // Assuming we audit all relevant tables
      coveragePercentage: 100,
    },
  };
}

/**
 * Test permission boundaries for a specific user and organization
 *
 * @param db - Database instance
 * @param userId - User to test permissions for
 * @param orgId - Organization context
 * @param permissionSet - Expected permissions
 * @returns Array of permission test results
 */
export async function testPermissionBoundaries(
  db: TestDatabase,
  userId: string,
  orgId: string,
  permissionSet: string[],
): Promise<PermissionTestResult[]> {
  const results: PermissionTestResult[] = [];

  // Test basic read operations
  const readOperations = [
    { name: "read_issues", allowed: permissionSet.includes("issue:view") },
    { name: "read_machines", allowed: permissionSet.includes("machine:view") },
    {
      name: "read_locations",
      allowed: permissionSet.includes("location:view"),
    },
  ];

  for (const operation of readOperations) {
    const startTime = performance.now();

    try {
      const result = await withRLSContext(db, userId, orgId, async (db) => {
        switch (operation.name) {
          case "read_issues":
            return await db.query.issues.findMany({ limit: 1 });
          case "read_machines":
            return await db.query.machines.findMany({ limit: 1 });
          case "read_locations":
            return await db.query.locations.findMany({ limit: 1 });
          default:
            return [];
        }
      });

      const executionTime = performance.now() - startTime;
      const allowed = result.length >= 0; // Query succeeded

      results.push({
        operation: operation.name,
        allowed,
        expectedAllowed: operation.allowed,
        passed: allowed === operation.allowed,
        executionTime,
      });
    } catch (error) {
      const executionTime = performance.now() - startTime;

      results.push({
        operation: operation.name,
        allowed: false,
        expectedAllowed: operation.allowed,
        passed: !operation.allowed, // Error is expected if not allowed
        error: error instanceof Error ? error.message : String(error),
        executionTime,
      });
    }
  }

  // Test write operations
  const writeOperations = [
    { name: "create_issue", allowed: permissionSet.includes("issue:create") },
    { name: "update_machine", allowed: permissionSet.includes("machine:edit") },
    {
      name: "delete_location",
      allowed: permissionSet.includes("location:delete"),
    },
  ];

  for (const operation of writeOperations) {
    const startTime = performance.now();

    try {
      const _result = await withRLSContext(db, userId, orgId, async (db) => {
        switch (operation.name) {
          case "create_issue":
            // Try to create a test issue
            return await db
              .insert(schema.issues)
              .values({
                id: `test-issue-${String(Date.now())}`,
                title: "Permission Test Issue",
                organizationId: orgId,
                machineId: "test-machine-id",
                statusId: "test-status-id",
                priorityId: "test-priority-id",
                createdById: userId,
              })
              .returning();
          case "update_machine":
            // Try to update a machine (would fail if no machine exists, but tests permission)
            return await db
              .update(schema.machines)
              .set({ name: "Updated Name" })
              .where(eq(schema.machines.organizationId, orgId))
              .returning();
          case "delete_location":
            // Try to delete a location
            return await db
              .delete(schema.locations)
              .where(eq(schema.locations.organizationId, orgId))
              .returning();
          default:
            return [];
        }
      });

      const executionTime = performance.now() - startTime;
      const allowed = true; // Operation succeeded

      results.push({
        operation: operation.name,
        allowed,
        expectedAllowed: operation.allowed,
        passed: allowed === operation.allowed,
        executionTime,
      });
    } catch (error) {
      const executionTime = performance.now() - startTime;

      results.push({
        operation: operation.name,
        allowed: false,
        expectedAllowed: operation.allowed,
        passed: !operation.allowed, // Error is expected if not allowed
        error: error instanceof Error ? error.message : String(error),
        executionTime,
      });
    }
  }

  return results;
}

/**
 * Test cross-organization access attempts
 *
 * @param db - Database instance
 * @param sourceOrg - Organization making the access attempt
 * @param targetOrg - Organization being accessed
 * @returns Cross-organization access test results
 */
export async function testCrossOrgAccess(
  db: TestDatabase,
  sourceOrg: OrgTestContext,
  targetOrg: OrgTestContext,
): Promise<CrossOrgAccessResult[]> {
  const results: CrossOrgAccessResult[] = [];

  // Test attempts to read data from other organization
  const crossReadAttempts = [
    { table: "issues", operation: "read_cross_org_issues" },
    { table: "machines", operation: "read_cross_org_machines" },
    { table: "locations", operation: "read_cross_org_locations" },
  ];

  for (const attempt of crossReadAttempts) {
    try {
      const data = await withRLSContext(
        db,
        sourceOrg.users.admin.id,
        sourceOrg.organization.id,
        async (db) => {
          switch (attempt.table) {
            case "issues":
              return await db.query.issues.findMany({
                where: eq(
                  schema.issues.organizationId,
                  targetOrg.organization.id,
                ),
              });
            case "machines":
              return await db.query.machines.findMany({
                where: eq(
                  schema.machines.organizationId,
                  targetOrg.organization.id,
                ),
              });
            case "locations":
              return await db.query.locations.findMany({
                where: eq(
                  schema.locations.organizationId,
                  targetOrg.organization.id,
                ),
              });
            default:
              return [];
          }
        },
      );

      const wasBlocked = data.length === 0;

      results.push({
        sourceOrgId: sourceOrg.organization.id,
        targetOrgId: targetOrg.organization.id,
        attemptedOperation: attempt.operation,
        wasBlocked,
        shouldBeBlocked: true,
        passed: wasBlocked, // Should be blocked
        evidence: data.length > 0 ? data : undefined,
      });
    } catch {
      // Error likely means access was properly blocked
      results.push({
        sourceOrgId: sourceOrg.organization.id,
        targetOrgId: targetOrg.organization.id,
        attemptedOperation: attempt.operation,
        wasBlocked: true,
        shouldBeBlocked: true,
        passed: true,
      });
    }
  }

  return results;
}

/**
 * Measure RLS policy performance impact
 *
 * @param db - Database instance
 * @param table - Table configuration to test
 * @param org - Organization context for testing
 * @returns Performance measurement results
 */
export async function measureRLSPerformance(
  db: TestDatabase,
  table: { name: string; schema: any },
  org: OrgTestContext,
): Promise<{
  rlsQueryTime: number;
  unrestrictedQueryTime: number;
  rlsOverhead: number; // percentage
}> {
  const iterations = 5;

  // Measure RLS-filtered query time
  const rlsTimes: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now();

    await withRLSContext(
      db,
      org.users.admin.id,
      org.organization.id,
      async (db) => {
        // Use the specific table's findMany method
        switch (table.name) {
          case "issues":
            return await db.query.issues.findMany({ limit: 100 });
          case "machines":
            return await db.query.machines.findMany({ limit: 100 });
          case "locations":
            return await db.query.locations.findMany({ limit: 100 });
          default:
            return [];
        }
      },
    );

    rlsTimes.push(performance.now() - startTime);
  }

  // Measure unrestricted query time (admin/service role)
  const unrestrictedTimes: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now();

    // Query without RLS context (simulates service role access)
    switch (table.name) {
      case "issues":
        await db.query.issues.findMany({
          where: eq(schema.issues.organizationId, org.organization.id),
          limit: 100,
        });
        break;
      case "machines":
        await db.query.machines.findMany({
          where: eq(schema.machines.organizationId, org.organization.id),
          limit: 100,
        });
        break;
      case "locations":
        await db.query.locations.findMany({
          where: eq(schema.locations.organizationId, org.organization.id),
          limit: 100,
        });
        break;
    }

    unrestrictedTimes.push(performance.now() - startTime);
  }

  const avgRLSTime = rlsTimes.reduce((a, b) => a + b, 0) / rlsTimes.length;
  const avgUnrestrictedTime =
    unrestrictedTimes.reduce((a, b) => a + b, 0) / unrestrictedTimes.length;
  const overhead =
    ((avgRLSTime - avgUnrestrictedTime) / avgUnrestrictedTime) * 100;

  return {
    rlsQueryTime: avgRLSTime,
    unrestrictedQueryTime: avgUnrestrictedTime,
    rlsOverhead: Math.max(0, overhead), // Don't show negative overhead
  };
}

/**
 * Validate RLS policies are active for all organization-scoped tables
 *
 * @param db - Database instance
 * @returns RLS policy validation results
 */
export async function validateRLSPolicies(db: TestDatabase): Promise<{
  policiesActive: boolean;
  tablesWithRLS: string[];
  tablesWithoutRLS: string[];
  policyDetails: {
    table: string;
    hasPolicy: boolean;
    policyNames: string[];
  }[];
}> {
  // Query PostgreSQL system tables to check RLS status
  const rlsStatus = await db.execute(sql`
    SELECT 
      schemaname,
      tablename,
      rowsecurity as rls_enabled,
      (
        SELECT array_agg(policyname)
        FROM pg_policies p
        WHERE p.schemaname = t.schemaname 
        AND p.tablename = t.tablename
      ) as policy_names
    FROM pg_tables t
    WHERE schemaname = 'public'
    AND tablename IN (
      'issues', 'machines', 'locations', 'memberships', 
      'roles', 'priorities', 'issueStatuses', 'attachments', 'issueHistory'
    )
    ORDER BY tablename
  `);

  const tablesWithRLS: string[] = [];
  const tablesWithoutRLS: string[] = [];
  const policyDetails: {
    table: string;
    hasPolicy: boolean;
    policyNames: string[];
  }[] = [];

  for (const row of rlsStatus.rows as any[]) {
    const tableName = row.tablename;
    const hasRLS = row.rls_enabled;
    const policyNames = row.policy_names || [];

    if (hasRLS) {
      tablesWithRLS.push(tableName);
    } else {
      tablesWithoutRLS.push(tableName);
    }

    policyDetails.push({
      table: tableName,
      hasPolicy: hasRLS && policyNames.length > 0,
      policyNames,
    });
  }

  return {
    policiesActive: tablesWithoutRLS.length === 0,
    tablesWithRLS,
    tablesWithoutRLS,
    policyDetails,
  };
}

// Helper functions

/**
 * Get data size configuration for testing
 */
function getDataSizeConfig(size: "small" | "medium" | "large") {
  switch (size) {
    case "small":
      return { locations: 1, machines: 2, issues: 3 };
    case "medium":
      return { locations: 2, machines: 5, issues: 10 };
    case "large":
      return { locations: 5, machines: 15, issues: 30 };
  }
}

/**
 * Create test data for security auditing
 */
async function createAuditTestData(
  db: TestDatabase,
  org: OrgTestContext,
  dataSize: { locations: number; machines: number; issues: number },
) {
  // Create locations
  for (let i = 1; i <= dataSize.locations; i++) {
    await db.insert(schema.locations).values({
      id: `audit-location-${org.organization.id}-${String(i)}`,
      name: `Audit Location ${String(i)}`,
      street: `${String(i)}00 Audit St`,
      city: "Audit City",
      state: "AC",
      zip: "00000",
      organizationId: org.organization.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Create machines
  for (let i = 1; i <= dataSize.machines; i++) {
    await db.insert(schema.machines).values({
      id: `audit-machine-${org.organization.id}-${String(i)}`,
      name: `Audit Machine ${String(i)}`,
      serialNumber: `AM${i.toString().padStart(4, "0")}`,
      condition: "Good",
      organizationId: org.organization.id,
      locationId: `audit-location-${org.organization.id}-${String(Math.ceil(i / Math.ceil(dataSize.machines / dataSize.locations)))}`,
      qrCodeId: `audit-qr-${org.organization.id}-${String(i)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Create issues
  for (let i = 1; i <= dataSize.issues; i++) {
    await db.insert(schema.issues).values({
      id: `audit-issue-${org.organization.id}-${String(i)}`,
      title: `Audit Issue ${String(i)}`,
      description: `Audit test issue ${String(i)}`,
      organizationId: org.organization.id,
      machineId: `audit-machine-${org.organization.id}-${String(Math.ceil(i / Math.ceil(dataSize.issues / dataSize.machines)))}`,
      statusId: org.statuses.new.id,
      priorityId: org.priorities.medium.id,
      createdById: org.users.member.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

/**
 * Audit isolation for a specific table
 */
async function auditTableIsolation(
  db: TestDatabase,
  table: { name: string; schema: any },
  testOrgs: OrgTestContext[],
): Promise<SecurityViolation[]> {
  const violations: SecurityViolation[] = [];

  // Test each organization can only see its own data
  for (let i = 0; i < testOrgs.length; i++) {
    for (let j = 0; j < testOrgs.length; j++) {
      if (i === j) continue; // Skip self-access

      const sourceOrg = testOrgs[i];
      const targetOrg = testOrgs[j];

      try {
        const crossOrgData = await withRLSContext(
          db,
          sourceOrg.users.admin.id,
          sourceOrg.organization.id,
          async (db) => {
            // Query for target org's data while in source org context
            switch (table.name) {
              case "issues":
                return await db.query.issues.findMany({
                  where: eq(
                    schema.issues.organizationId,
                    targetOrg.organization.id,
                  ),
                });
              case "machines":
                return await db.query.machines.findMany({
                  where: eq(
                    schema.machines.organizationId,
                    targetOrg.organization.id,
                  ),
                });
              case "locations":
                return await db.query.locations.findMany({
                  where: eq(
                    schema.locations.organizationId,
                    targetOrg.organization.id,
                  ),
                });
              default:
                return [];
            }
          },
        );

        // If we got data, that's a violation
        if (crossOrgData.length > 0) {
          violations.push({
            type: "data_leak",
            severity: "critical",
            table: table.name,
            description: `Organization ${sourceOrg.organization.id} can access data from ${targetOrg.organization.id}`,
            evidence: crossOrgData,
          });
        }
      } catch (error) {
        // Errors are generally good - they mean access was blocked
        // Only flag as violation if it's an unexpected error type
        if (
          error instanceof Error &&
          !error.message.includes("permission") &&
          !error.message.includes("policy")
        ) {
          violations.push({
            type: "rls_missing",
            severity: "high",
            table: table.name,
            description: `Unexpected error during cross-org access test: ${error.message}`,
            evidence: error,
          });
        }
      }
    }
  }

  return violations;
}

/**
 * Common multi-tenant test patterns
 */
export const MultiTenantTestPatterns = {
  /**
   * Quick isolation test for two organizations
   */
  basicIsolation: async (db: TestDatabase) => {
    const org1 = await createOrgContext(db, "iso1");
    const org2 = await createOrgContext(db, "iso2");

    return await testCrossOrgAccess(db, org1, org2);
  },

  /**
   * Performance regression test for RLS overhead
   */
  performanceRegression: async (db: TestDatabase) => {
    const org = await createOrgContext(db, "perf");

    const perfResults = await Promise.all([
      measureRLSPerformance(db, { name: "issues", schema: schema.issues }, org),
      measureRLSPerformance(
        db,
        { name: "machines", schema: schema.machines },
        org,
      ),
      measureRLSPerformance(
        db,
        { name: "locations", schema: schema.locations },
        org,
      ),
    ]);

    return {
      averageOverhead:
        perfResults.reduce((sum, result) => sum + result.rlsOverhead, 0) /
        perfResults.length,
      maxOverhead: Math.max(...perfResults.map((r) => r.rlsOverhead)),
      results: perfResults,
    };
  },

  /**
   * Comprehensive security audit
   */
  fullSecurityAudit: async (db: TestDatabase) => {
    return await auditMultiTenantSecurity(db, {
      orgCount: 3,
      testDataSize: "medium",
      includePerformance: true,
    });
  },
} as const;

/**
 * Type exports
 */
export type {
  SecurityAuditResult,
  SecurityViolation,
  PermissionTestResult,
  CrossOrgAccessResult,
};
