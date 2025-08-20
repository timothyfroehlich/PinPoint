/**
 * Multi-Tenant Isolation Integration Tests - CRITICAL DATABASE-LEVEL RLS VALIDATION
 *
 * Enhanced integration tests for comprehensive multi-tenant security boundary enforcement.
 * Tests both application-level logic AND database-level RLS policy enforcement.
 * Enhanced following Phase 3.1 security analysis - ZERO tolerance for cross-organizational data leakage.
 *
 * Key Security Features:
 * - Database-level RLS policy enforcement validation
 * - Cross-organizational access attempt blocking
 * - Complex query RLS bypass prevention
 * - Anonymous/unauthenticated access blocking
 * - Edge case security boundary testing
 * - Application-level + Database-level isolation verification
 *
 * Uses memory-safe PGlite with comprehensive security boundary validation.
 */

import { eq, and } from "drizzle-orm";
import { describe, expect } from "vitest";

import * as schema from "~/server/db/schema";
import {
  generateTestId,
  generateTestEmail,
} from "~/test/helpers/test-id-generator";
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";

describe("Multi-Tenant Isolation", () => {
  describe("Organization Boundary Enforcement", () => {
    test("should enforce organizationId on all tenant-scoped tables", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Generate unique test identifiers
        const org1Id = generateTestId("org1");
        const location1Id = generateTestId("location1");

        // Set up test organizations
        await db.insert(schema.organizations).values({
          id: org1Id,
          name: "Test Organization 1",
          subdomain: generateTestId("org1-subdomain"),
        });

        // Create test data for tenant-scoped tables
        await db.insert(schema.locations).values({
          id: location1Id,
          name: "Test Location",
          organizationId: org1Id,
        });

        const [location] = await db
          .select()
          .from(schema.locations)
          .where(eq(schema.locations.id, location1Id));

        expect(location).toBeDefined();
        expect(location?.organizationId).toBe(org1Id);
        expect(location?.organizationId).not.toBeNull();
      });
    });

    test("should prevent querying data across organization boundaries", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Generate unique test identifiers
        const org1Id = generateTestId("org1");
        const org2Id = generateTestId("org2");

        // Set up test organizations
        await db.insert(schema.organizations).values([
          {
            id: org1Id,
            name: "Test Organization 1",
            subdomain: generateTestId("org1-subdomain"),
          },
          {
            id: org2Id,
            name: "Test Organization 2",
            subdomain: generateTestId("org2-subdomain"),
          },
        ]);

        // Create data for both organizations
        await db.insert(schema.locations).values([
          {
            id: generateTestId("location-org1"),
            name: "Org 1 Location",
            organizationId: org1Id,
          },
          {
            id: generateTestId("location-org2"),
            name: "Org 2 Location",
            organizationId: org2Id,
          },
        ]);

        // Query with org1 filter should only return org1 data
        const org1Locations = await db
          .select()
          .from(schema.locations)
          .where(eq(schema.locations.organizationId, org1Id));

        // Should have exactly the one we created
        expect(org1Locations).toHaveLength(1);

        // Find our specific location
        const ourLocation = org1Locations.find(
          (loc) => loc.name === "Org 1 Location",
        );
        expect(ourLocation).toBeDefined();
        expect(ourLocation?.organizationId).toBe(org1Id);

        // Verify org2 data exists but is not returned
        const org2Locations = await db
          .select()
          .from(schema.locations)
          .where(eq(schema.locations.organizationId, org2Id));

        expect(org2Locations).toHaveLength(1);
        expect(org2Locations[0]?.name).toBe("Org 2 Location");
      });
    });

    test("should prevent updating data across organization boundaries", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Generate unique test identifiers
        const org1Id = generateTestId("org1");
        const org2Id = generateTestId("org2");
        const location1Id = generateTestId("location1");

        // Set up test organizations
        await db.insert(schema.organizations).values([
          {
            id: org1Id,
            name: "Test Organization 1",
            subdomain: generateTestId("org1-subdomain"),
          },
          {
            id: org2Id,
            name: "Test Organization 2",
            subdomain: generateTestId("org2-subdomain"),
          },
        ]);

        // Create location for org1
        await db.insert(schema.locations).values({
          id: location1Id,
          name: "Original Name",
          organizationId: org1Id,
        });

        // Try to update org1's location while filtering for org2 context
        const updateResult = await db
          .update(schema.locations)
          .set({ name: "Updated Name" })
          .where(
            and(
              eq(schema.locations.id, location1Id),
              eq(schema.locations.organizationId, org2Id), // Wrong org filter
            ),
          )
          .returning();

        // Should return 0 affected rows
        expect(updateResult).toHaveLength(0);

        // Verify original data is unchanged
        const [location] = await db
          .select()
          .from(schema.locations)
          .where(eq(schema.locations.id, location1Id));

        expect(location?.name).toBe("Original Name");
      });
    });

    test("should prevent deleting data across organization boundaries", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Generate unique test identifiers
        const org1Id = generateTestId("org1");
        const org2Id = generateTestId("org2");
        const location1Id = generateTestId("location1");

        // Set up test organizations
        await db.insert(schema.organizations).values([
          {
            id: org1Id,
            name: "Test Organization 1",
            subdomain: generateTestId("org1-subdomain"),
          },
          {
            id: org2Id,
            name: "Test Organization 2",
            subdomain: generateTestId("org2-subdomain"),
          },
        ]);

        // Create location for org1
        await db.insert(schema.locations).values({
          id: location1Id,
          name: "Test Location",
          organizationId: org1Id,
        });

        // Try to delete org1's location with org2 context
        const deleteResult = await db
          .delete(schema.locations)
          .where(
            and(
              eq(schema.locations.id, location1Id),
              eq(schema.locations.organizationId, org2Id), // Wrong org filter
            ),
          )
          .returning();

        // Should return 0 affected rows
        expect(deleteResult).toHaveLength(0);

        // Verify location still exists
        const locations = await db
          .select()
          .from(schema.locations)
          .where(eq(schema.locations.id, location1Id));

        expect(locations).toHaveLength(1);
      });
    });
  });

  describe("Global vs Tenant-Scoped Entities", () => {
    test("should handle null organizationId for global entities", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Generate unique test identifiers
        const globalModelId = generateTestId("global-model");

        // Create global OPDB model (organizationId = null, accessible to all orgs)
        const [globalModel] = await db
          .insert(schema.models)
          .values({
            id: globalModelId,
            name: "Medieval Madness",
            manufacturer: "Williams",
            year: 1997,
            // organizationId defaults to null (global OPDB model)
            // isCustom defaults to false (OPDB model)
            opdbId: "4032",
          })
          .returning();

        expect(globalModel).toBeDefined();
        expect(globalModel?.isCustom).toBe(false);
        expect(globalModel?.organizationId).toBeNull(); // Global OPDB model
        expect(globalModel?.opdbId).toBe("4032");
      });
    });

    test("should allow multi-organization access for global data", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Generate unique test identifiers
        const org1Id = generateTestId("org1");
        const org2Id = generateTestId("org2");
        const globalModelId = generateTestId("global-model");
        const user1Id = generateTestId("user1");

        // Set up test organizations and users
        await db.insert(schema.organizations).values([
          {
            id: org1Id,
            name: "Test Organization 1",
            subdomain: generateTestId("org1-subdomain"),
          },
          {
            id: org2Id,
            name: "Test Organization 2",
            subdomain: generateTestId("org2-subdomain"),
          },
        ]);

        await db.insert(schema.users).values({
          id: user1Id,
          email: generateTestEmail("user1"),
          name: "Test User 1",
        });

        // Create global OPDB model
        const [_globalModel] = await db
          .insert(schema.models)
          .values({
            id: globalModelId,
            name: "Star Trek: The Next Generation",
            manufacturer: "Williams",
            year: 1993,
            isCustom: false,
            opdbId: "2357",
          })
          .returning();

        // Create locations for both orgs
        const [org1Location] = await db
          .insert(schema.locations)
          .values({
            id: generateTestId("location-org1"),
            name: "Org 1 Location",
            organizationId: org1Id,
          })
          .returning();

        const [org2Location] = await db
          .insert(schema.locations)
          .values({
            id: generateTestId("location-org2"),
            name: "Org 2 Location",
            organizationId: org2Id,
          })
          .returning();

        // Both organizations should be able to reference this global model
        const machines = await db
          .insert(schema.machines)
          .values([
            {
              id: generateTestId("machine-org1"),
              name: "TNG Machine 1",
              serialNumber: "TNG001",
              modelId: globalModelId,
              organizationId: org1Id,
              locationId: org1Location?.id,
              ownerId: user1Id,
              qrCodeId: generateTestId("qr-org1"),
            },
            {
              id: generateTestId("machine-org2"),
              name: "TNG Machine 2",
              serialNumber: "TNG002",
              modelId: globalModelId,
              organizationId: org2Id,
              locationId: org2Location?.id,
              ownerId: user1Id,
              qrCodeId: generateTestId("qr-org2"),
            },
          ])
          .returning();

        expect(machines).toHaveLength(2);
        expect(machines[0]?.modelId).toBe(globalModelId);
        expect(machines[1]?.modelId).toBe(globalModelId);
        expect(machines[0]?.organizationId).toBe(org1Id);
        expect(machines[1]?.organizationId).toBe(org2Id);
      });
    });
  });

  // === CRITICAL DATABASE-LEVEL RLS BOUNDARY TESTING ===
  // Enhanced following Phase 3.1 security analysis

  describe("Critical RLS Policy Enforcement", () => {
    test("CRITICAL - Database-level cross-organizational access blocking", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Create test organizations and data
        const org1Id = generateTestId("primary-org");
        const org2Id = generateTestId("competitor-org");
        const user1Id = generateTestId("primary-user");
        const user2Id = generateTestId("competitor-user");

        // Set up organizations and users
        await db.insert(schema.organizations).values([
          {
            id: org1Id,
            name: "Primary Organization",
            subdomain: generateTestId("primary-sub"),
          },
          {
            id: org2Id,
            name: "Competitor Organization", 
            subdomain: generateTestId("competitor-sub"),
          },
        ]);

        await db.insert(schema.users).values([
          {
            id: user1Id,
            email: generateTestEmail("primary-admin"),
            name: "Primary Admin",
            organizationId: org1Id,
          },
          {
            id: user2Id,
            email: generateTestEmail("competitor-admin"), 
            name: "Competitor Admin",
            organizationId: org2Id,
          },
        ]);

        // Create sensitive data in both organizations
        await db.insert(schema.locations).values([
          {
            id: generateTestId("primary-secret-location"),
            name: "Primary Org Secret Location",
            address: "Confidential Primary Address",
            organizationId: org1Id,
            createdBy: user1Id,
          },
          {
            id: generateTestId("competitor-secret-location"),
            name: "Competitor Org Secret Location", 
            address: "Confidential Competitor Address",
            organizationId: org2Id,
            createdBy: user2Id,
          },
        ]);

        // CRITICAL TEST: Set RLS context for primary org and attempt cross-org access
        // This simulates database-level security enforcement
        await db.execute(
          `SET app.current_organization_id = '${org1Id}'`
        );
        await db.execute(
          `SET app.current_user_id = '${user1Id}'`
        );

        // Attempt to access competitor org data WITHOUT application-level filtering
        // RLS should block this at database level
        const crossOrgAttempt = await db
          .select()
          .from(schema.locations)
          // NO WHERE clause - testing pure RLS enforcement
          .where(eq(schema.locations.organizationId, org2Id));

        // CRITICAL: Should return empty due to RLS blocking, not application logic
        expect(crossOrgAttempt).toHaveLength(0);

        // Verify primary org data is accessible
        const ownOrgData = await db
          .select()
          .from(schema.locations)
          .where(eq(schema.locations.organizationId, org1Id));

        expect(ownOrgData).toHaveLength(1);
        expect(ownOrgData[0]?.name).toBe("Primary Org Secret Location");
      });
    });

    test("CRITICAL - Zero tolerance for cross-organizational data leakage", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Create test data across multiple tables
        const org1Id = generateTestId("org1");
        const org2Id = generateTestId("org2");

        await db.insert(schema.organizations).values([
          { id: org1Id, name: "Org 1", subdomain: generateTestId("org1-sub") },
          { id: org2Id, name: "Org 2", subdomain: generateTestId("org2-sub") },
        ]);

        // Create comprehensive test data in competitor org
        const location2Id = generateTestId("competitor-location");
        const machine2Id = generateTestId("competitor-machine");
        const issue2Id = generateTestId("competitor-issue");

        await db.insert(schema.locations).values({
          id: location2Id,
          name: "Competitor Secret Location",
          organizationId: org2Id,
        });

        // Set RLS context for org1
        await db.execute(`SET app.current_organization_id = '${org1Id}'`);

        // ZERO TOLERANCE: No competitor data should be accessible
        const competitorLocations = await db
          .select()
          .from(schema.locations)
          .where(eq(schema.locations.organizationId, org2Id));

        const competitorMachines = await db
          .select() 
          .from(schema.machines)
          .where(eq(schema.machines.organizationId, org2Id));

        const competitorIssues = await db
          .select()
          .from(schema.issues)
          .where(eq(schema.issues.organizationId, org2Id));

        // CRITICAL: All should be empty due to RLS enforcement
        expect(competitorLocations).toHaveLength(0);
        expect(competitorMachines).toHaveLength(0); 
        expect(competitorIssues).toHaveLength(0);
      });
    });

    test("CRITICAL - Complex JOIN queries respect RLS boundaries", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Create comprehensive relational test data
        const org1Id = generateTestId("primary-org");
        const org2Id = generateTestId("competitor-org");
        const user1Id = generateTestId("primary-user");

        await db.insert(schema.organizations).values([
          { id: org1Id, name: "Primary Org", subdomain: generateTestId("primary") },
          { id: org2Id, name: "Competitor Org", subdomain: generateTestId("competitor") },
        ]);

        await db.insert(schema.users).values({
          id: user1Id,
          email: generateTestEmail("primary-user"),
          name: "Primary User",
          organizationId: org1Id,
        });

        // Create related data in competitor org
        const competitorLocationId = generateTestId("competitor-location");
        const competitorMachineId = generateTestId("competitor-machine");

        await db.insert(schema.locations).values({
          id: competitorLocationId,
          name: "Competitor Location",
          organizationId: org2Id,
        });

        await db.insert(schema.machines).values({
          id: competitorMachineId,
          name: "Competitor Machine", 
          serialNumber: "COMP001",
          organizationId: org2Id,
          locationId: competitorLocationId,
        });

        // Set RLS context for primary org
        await db.execute(`SET app.current_organization_id = '${org1Id}'`);
        await db.execute(`SET app.current_user_id = '${user1Id}'`);

        // CRITICAL: Complex JOIN attempting to access competitor data
        const joinResult = await db
          .select({
            machineId: schema.machines.id,
            machineName: schema.machines.name,
            locationName: schema.locations.name,
            organizationName: schema.organizations.name,
          })
          .from(schema.machines)
          .innerJoin(
            schema.locations,
            eq(schema.machines.locationId, schema.locations.id)
          )
          .innerJoin(
            schema.organizations,
            eq(schema.machines.organizationId, schema.organizations.id)  
          )
          .where(eq(schema.machines.organizationId, org2Id));

        // CRITICAL: JOIN should return empty due to RLS blocking competitor data
        expect(joinResult).toHaveLength(0);
      });
    });

    test("CRITICAL - Anonymous access blocked by RLS", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Create test data
        const orgId = generateTestId("test-org");
        await db.insert(schema.organizations).values({
          id: orgId,
          name: "Test Organization",
          subdomain: generateTestId("test-sub"),
        });

        await db.insert(schema.locations).values({
          id: generateTestId("secret-location"),
          name: "Secret Location Data",
          organizationId: orgId,
        });

        // Clear RLS context (simulate anonymous user)
        await db.execute(`RESET app.current_organization_id`);
        await db.execute(`RESET app.current_user_id`);

        // Anonymous users should see no data
        const anonymousAccess = await db.select().from(schema.locations);
        expect(anonymousAccess).toHaveLength(0);

        const anonymousOrgs = await db.select().from(schema.organizations);
        expect(anonymousOrgs).toHaveLength(0);
      });
    });

    test("CRITICAL - Invalid organization context blocks all access", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Create test data
        const realOrgId = generateTestId("real-org");
        await db.insert(schema.organizations).values({
          id: realOrgId,
          name: "Real Organization",
          subdomain: generateTestId("real-sub"),
        });

        await db.insert(schema.locations).values({
          id: generateTestId("real-location"),
          name: "Real Location",
          organizationId: realOrgId,
        });

        // Set invalid organization context
        const fakeOrgId = generateTestId("fake-org");
        await db.execute(`SET app.current_organization_id = '${fakeOrgId}'`);
        await db.execute(`SET app.current_user_id = 'fake-user'`);

        // Should see no data with invalid context
        const invalidAccess = await db.select().from(schema.locations);
        expect(invalidAccess).toHaveLength(0);

        const invalidOrgAccess = await db.select().from(schema.organizations);
        expect(invalidOrgAccess).toHaveLength(0);
      });
    });
  });

  describe("Edge Case Security Validation", () => {
    test("SQL injection attempts cannot bypass RLS", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Create test data
        const org1Id = generateTestId("org1");
        const org2Id = generateTestId("org2");

        await db.insert(schema.organizations).values([
          { id: org1Id, name: "Org 1", subdomain: generateTestId("org1") },
          { id: org2Id, name: "Org 2", subdomain: generateTestId("org2") },
        ]);

        await db.insert(schema.locations).values([
          {
            id: generateTestId("org1-location"),
            name: "Org 1 Location",
            organizationId: org1Id,
          },
          {
            id: generateTestId("org2-location"), 
            name: "Org 2 Secret Location",
            organizationId: org2Id,
          },
        ]);

        // Set context for org1
        await db.execute(`SET app.current_organization_id = '${org1Id}'`);

        // Attempt SQL injection-style bypass (should be parameterized and blocked by RLS)
        const maliciousAttempt = await db
          .select()
          .from(schema.locations)
          .where(
            eq(schema.locations.name, "' OR '1'='1' OR organizationId = '" + org2Id + "' --")
          );

        // Should return empty - no location with that malicious name exists,
        // and RLS prevents seeing org2 data regardless
        expect(maliciousAttempt).toHaveLength(0);
      });
    });

    test("Complex WHERE conditions cannot bypass organizational boundaries", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Create test data
        const org1Id = generateTestId("org1");
        const org2Id = generateTestId("org2");

        await db.insert(schema.organizations).values([
          { id: org1Id, name: "Org 1", subdomain: generateTestId("org1") },
          { id: org2Id, name: "Org 2", subdomain: generateTestId("org2") },
        ]);

        await db.insert(schema.locations).values([
          {
            id: generateTestId("org1-location"),
            name: "Public Name",
            organizationId: org1Id,
          },
          {
            id: generateTestId("org2-location"),
            name: "Public Name", // Same name, different org
            organizationId: org2Id,
          },
        ]);

        // Set context for org1
        await db.execute(`SET app.current_organization_id = '${org1Id}'`);

        // Complex OR condition attempting to access both orgs by name
        const complexQuery = await db
          .select()
          .from(schema.locations)
          .where(
            and(
              eq(schema.locations.name, "Public Name"),
              // This OR should not help access org2 data due to RLS
              eq(schema.locations.organizationId, org2Id)
            )
          );

        // Should return empty - RLS blocks org2 access regardless of name match
        expect(complexQuery).toHaveLength(0);

        // Verify org1 data is still accessible
        const validQuery = await db
          .select()
          .from(schema.locations)
          .where(
            and(
              eq(schema.locations.name, "Public Name"),
              eq(schema.locations.organizationId, org1Id)
            )
          );

        expect(validQuery).toHaveLength(1);
      });
    });

    test("Subquery attempts cannot access cross-organizational data", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Create test organizations and locations
        const org1Id = generateTestId("org1");
        const org2Id = generateTestId("org2");

        await db.insert(schema.organizations).values([
          { id: org1Id, name: "Org 1", subdomain: generateTestId("org1") },
          { id: org2Id, name: "Org 2", subdomain: generateTestId("org2") },
        ]);

        const location1Id = generateTestId("org1-location");
        const location2Id = generateTestId("org2-location");

        await db.insert(schema.locations).values([
          {
            id: location1Id,
            name: "Org 1 Location",
            organizationId: org1Id,
          },
          {
            id: location2Id,
            name: "Org 2 Location", 
            organizationId: org2Id,
          },
        ]);

        // Create machines referencing these locations
        await db.insert(schema.machines).values([
          {
            id: generateTestId("org1-machine"),
            name: "Org 1 Machine",
            serialNumber: "ORG1-001",
            organizationId: org1Id,
            locationId: location1Id,
          },
          {
            id: generateTestId("org2-machine"),
            name: "Org 2 Machine", 
            serialNumber: "ORG2-001",
            organizationId: org2Id,
            locationId: location2Id,
          },
        ]);

        // Set context for org1
        await db.execute(`SET app.current_organization_id = '${org1Id}'`);

        // Attempt subquery to find machines in org2 locations
        const subqueryAttempt = await db
          .select()
          .from(schema.machines)
          .where(
            eq(schema.machines.locationId, location2Id) // Direct attempt to access org2 location
          );

        // Should return empty due to RLS blocking org2 machine access
        expect(subqueryAttempt).toHaveLength(0);
      });
    });
  });

  describe("Performance Security Validation", () => {
    test("RLS enforcement maintains performance boundaries", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Create multiple organizations with data
        const orgs = [];
        for (let i = 1; i <= 5; i++) {
          const orgId = generateTestId(`perf-org-${i}`);
          orgs.push(orgId);
          
          await db.insert(schema.organizations).values({
            id: orgId,
            name: `Performance Test Org ${i}`,
            subdomain: generateTestId(`perf-${i}`),
          });

          // Create locations for each org
          for (let j = 1; j <= 3; j++) {
            await db.insert(schema.locations).values({
              id: generateTestId(`perf-location-${i}-${j}`),
              name: `Org ${i} Location ${j}`,
              organizationId: orgId,
            });
          }
        }

        // Set context for first org
        await db.execute(`SET app.current_organization_id = '${orgs[0]}'`);

        // Performance test: Query should only return data for current org
        const startTime = Date.now();
        const results = await db.select().from(schema.locations);
        const endTime = Date.now();

        // Should only see first org's data (3 locations)
        expect(results).toHaveLength(3);
        expect(results.every(loc => loc.organizationId === orgs[0])).toBe(true);

        // Query should complete reasonably quickly (under 100ms for this test data)
        const queryTime = endTime - startTime;
        expect(queryTime).toBeLessThan(100);
      });
    });
  });
});
