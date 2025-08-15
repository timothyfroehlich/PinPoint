#!/usr/bin/env tsx

/**
 * Drizzle CRUD Validation Script
 *
 * Tests all basic database operations with Drizzle ORM:
 * - INSERT operations across all tables
 * - SELECT operations with filters and joins
 * - UPDATE operations with complex conditions
 * - DELETE operations with cascade handling
 * - Transaction support and rollback scenarios
 *
 * Run with: npx tsx scripts/validate-drizzle-crud.ts
 */

// Load development environment variables for standalone script execution
import "../src/lib/env-loaders/development";

import { eq, and, sql } from "drizzle-orm";
import {
  createDrizzleClient,
  closeDrizzleConnection,
} from "~/server/db/drizzle";
import * as schema from "~/server/db/schema";
import { env } from "~/env.js";

// Type imports for validation
import type { DrizzleClient } from "~/server/db/drizzle";

interface CRUDTestResult {
  operation: string;
  table: string;
  status: "success" | "error";
  duration: number;
  details?: string | undefined;
  error?: string | undefined;
}

class DrizzleCRUDValidator {
  private db: DrizzleClient;
  private results: CRUDTestResult[] = [];
  private testOrgId = `test-org-${Date.now()}`;
  private testUserId = `test-user-${Date.now()}`;
  private testModelId = `test-model-${Date.now()}`;
  private isMinimalMode: boolean;

  constructor(minimalMode = false) {
    this.isMinimalMode = minimalMode;
    if (minimalMode) {
      console.log("🔧 Initializing Drizzle CRUD Validator (Minimal Mode)...");
    } else {
      console.log("🔧 Initializing Drizzle CRUD Validator (Full Mode)...");
    }
    this.db = createDrizzleClient();
  }

  /**
   * Test basic database connectivity before running validation tests
   */
  async testConnection(): Promise<boolean> {
    const startTime = Date.now();
    try {
      // Simple ping test using a basic SQL query
      await this.db.execute(sql`SELECT 1 as ping`);

      await this.recordResult(
        "CONNECTION_TEST",
        "database",
        startTime,
        undefined,
        "Database connection successful",
      );
      return true;
    } catch (error) {
      await this.recordResult(
        "CONNECTION_TEST",
        "database",
        startTime,
        error as Error,
      );

      console.log("\n💡 Connection troubleshooting:");
      console.log("   - Check if Supabase is running: npm run dev:bg:status");
      console.log("   - Verify DATABASE_URL in your environment");
      console.log(
        `   - Connection string: ${(() => {
          try {
            if (!env.DATABASE_URL) return "";
            const url = new URL(env.DATABASE_URL);
            url.username = "***";
            url.password = "***";
            return url.toString();
          } catch {
            return "";
          }
        })()}`,
      );

      return false;
    }
  }

  private async recordResult(
    operation: string,
    table: string,
    startTime: number,
    error?: Error,
    details?: string,
  ): Promise<void> {
    const duration = Date.now() - startTime;
    const result: CRUDTestResult = {
      operation,
      table,
      status: error ? "error" : "success",
      duration,
      details,
      error: error?.message,
    };

    this.results.push(result);

    const statusIcon = error ? "❌" : "✅";
    const durationText = `${duration}ms`;
    console.log(
      `${statusIcon} ${operation} ${table} - ${durationText}${error ? ` - ${error.message}` : ""}`,
    );
  }

  /**
   * Test basic INSERT operations across core tables
   */
  async testInsertOperations(): Promise<void> {
    console.log("\n📝 Testing INSERT Operations...");

    // 1. Insert User
    const startUser = Date.now();
    try {
      const [user] = await this.db
        .insert(schema.users)
        .values({
          id: this.testUserId,
          email: "test@drizzle-validation.com",
          name: "Drizzle Test User",
          notificationFrequency: "IMMEDIATE",
        })
        .returning();

      await this.recordResult(
        "INSERT",
        "users",
        startUser,
        undefined,
        `Created user: ${user?.id}`,
      );
    } catch (error) {
      await this.recordResult("INSERT", "users", startUser, error as Error);
    }

    // 2. Insert Organization
    const startOrg = Date.now();
    try {
      const [org] = await this.db
        .insert(schema.organizations)
        .values({
          id: this.testOrgId,
          name: "Drizzle Test Organization",
          subdomain: `drizzle-test-${Date.now()}`,
        })
        .returning();

      await this.recordResult(
        "INSERT",
        "organizations",
        startOrg,
        undefined,
        `Created org: ${org?.id}`,
      );
    } catch (error) {
      await this.recordResult(
        "INSERT",
        "organizations",
        startOrg,
        error as Error,
      );
    }

    // 3. Insert Location
    const startLocation = Date.now();
    try {
      const [location] = await this.db
        .insert(schema.locations)
        .values({
          id: `test-location-${Date.now()}`,
          name: "Test Location",
          street: "123 Test Street",
          organizationId: this.testOrgId,
        })
        .returning();

      await this.recordResult(
        "INSERT",
        "locations",
        startLocation,
        undefined,
        `Created location: ${location?.id}`,
      );
    } catch (error) {
      await this.recordResult(
        "INSERT",
        "locations",
        startLocation,
        error as Error,
      );
    }

    // 4. Insert Model
    const startModel = Date.now();
    try {
      const [model] = await this.db
        .insert(schema.models)
        .values({
          id: this.testModelId,
          name: "Test Pinball Model",
          manufacturer: "Drizzle Games Inc",
          year: 2024,
        })
        .returning();

      await this.recordResult(
        "INSERT",
        "models",
        startModel,
        undefined,
        `Created model: ${model?.id}`,
      );
    } catch (error) {
      await this.recordResult("INSERT", "models", startModel, error as Error);
    }
  }

  /**
   * Test complex SELECT operations with joins and filters
   */
  async testSelectOperations(): Promise<void> {
    console.log("\n🔍 Testing SELECT Operations...");

    // 1. Basic SELECT with filter
    const startBasicSelect = Date.now();
    try {
      const users = await this.db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, "test@drizzle-validation.com"));

      await this.recordResult(
        "SELECT",
        "users",
        startBasicSelect,
        undefined,
        `Found ${users.length} users`,
      );
    } catch (error) {
      await this.recordResult(
        "SELECT",
        "users",
        startBasicSelect,
        error as Error,
      );
    }

    // 2. Complex SELECT with joins
    const startJoinSelect = Date.now();
    try {
      const orgsWithLocations = await this.db
        .select({
          orgId: schema.organizations.id,
          orgName: schema.organizations.name,
          locationId: schema.locations.id,
          locationName: schema.locations.name,
          locationCount: sql<number>`count(${schema.locations.id})`.as(
            "location_count",
          ),
        })
        .from(schema.organizations)
        .leftJoin(
          schema.locations,
          eq(schema.organizations.id, schema.locations.organizationId),
        )
        .where(eq(schema.organizations.id, this.testOrgId))
        .groupBy(schema.organizations.id, schema.locations.id);

      await this.recordResult(
        "SELECT JOIN",
        "organizations+locations",
        startJoinSelect,
        undefined,
        `Found ${orgsWithLocations.length} org-location relationships`,
      );
    } catch (error) {
      await this.recordResult(
        "SELECT JOIN",
        "organizations+locations",
        startJoinSelect,
        error as Error,
      );
    }

    // 3. Aggregate query
    const startAggregate = Date.now();
    try {
      const [orgStats] = await this.db
        .select({
          organizationId: schema.organizations.id,
          locationCount: sql<number>`count(${schema.locations.id})`.as(
            "location_count",
          ),
          // Note: Model count removed as models are not organization-scoped
        })
        .from(schema.organizations)
        .leftJoin(
          schema.locations,
          eq(schema.organizations.id, schema.locations.organizationId),
        )
        // Note: Models are global entities, no organization scoping
        .where(eq(schema.organizations.id, this.testOrgId))
        .groupBy(schema.organizations.id);

      await this.recordResult(
        "SELECT AGGREGATE",
        "organizations",
        startAggregate,
        undefined,
        `Org stats: ${orgStats?.locationCount} locations`,
      );
    } catch (error) {
      await this.recordResult(
        "SELECT AGGREGATE",
        "organizations",
        startAggregate,
        error as Error,
      );
    }
  }

  /**
   * Test UPDATE operations with different strategies
   */
  async testUpdateOperations(): Promise<void> {
    console.log("\n✏️  Testing UPDATE Operations...");

    // 1. Simple UPDATE
    const startSimpleUpdate = Date.now();
    try {
      const result = await this.db
        .update(schema.users)
        .set({
          name: "Updated Drizzle Test User",
          notificationFrequency: "DAILY",
        })
        .where(eq(schema.users.id, this.testUserId))
        .returning();

      await this.recordResult(
        "UPDATE",
        "users",
        startSimpleUpdate,
        undefined,
        `Updated ${result.length} users`,
      );
    } catch (error) {
      await this.recordResult(
        "UPDATE",
        "users",
        startSimpleUpdate,
        error as Error,
      );
    }

    // 2. Conditional UPDATE
    const startConditionalUpdate = Date.now();
    try {
      const result = await this.db
        .update(schema.organizations)
        .set({
          name: "Updated Test Organization",
          subdomain: `updated-drizzle-test-${Date.now()}`,
        })
        .where(
          and(
            eq(schema.organizations.id, this.testOrgId),
            sql`${schema.organizations.name} LIKE 'Drizzle%'`,
          ),
        )
        .returning();

      await this.recordResult(
        "UPDATE CONDITIONAL",
        "organizations",
        startConditionalUpdate,
        undefined,
        `Updated ${result.length} organizations`,
      );
    } catch (error) {
      await this.recordResult(
        "UPDATE CONDITIONAL",
        "organizations",
        startConditionalUpdate,
        error as Error,
      );
    }

    // 3. Bulk UPDATE
    const startBulkUpdate = Date.now();
    try {
      const result = await this.db
        .update(schema.locations)
        .set({
          street: "Updated Test Address",
        })
        .where(eq(schema.locations.organizationId, this.testOrgId))
        .returning();

      await this.recordResult(
        "UPDATE BULK",
        "locations",
        startBulkUpdate,
        undefined,
        `Bulk updated ${result.length} locations`,
      );
    } catch (error) {
      await this.recordResult(
        "UPDATE BULK",
        "locations",
        startBulkUpdate,
        error as Error,
      );
    }
  }

  /**
   * Test DELETE operations with cascade considerations
   */
  async testDeleteOperations(): Promise<void> {
    console.log("\n🗑️  Testing DELETE Operations...");

    // 1. Simple DELETE
    const startSimpleDelete = Date.now();
    try {
      const result = await this.db
        .delete(schema.models)
        .where(eq(schema.models.id, this.testModelId))
        .returning();

      await this.recordResult(
        "DELETE",
        "models",
        startSimpleDelete,
        undefined,
        `Deleted ${result.length} models`,
      );
    } catch (error) {
      await this.recordResult(
        "DELETE",
        "models",
        startSimpleDelete,
        error as Error,
      );
    }

    // 2. Conditional DELETE
    const startConditionalDelete = Date.now();
    try {
      const result = await this.db
        .delete(schema.locations)
        .where(
          and(
            eq(schema.locations.organizationId, this.testOrgId),
            sql`${schema.locations.name} LIKE 'Test%'`,
          ),
        )
        .returning();

      await this.recordResult(
        "DELETE CONDITIONAL",
        "locations",
        startConditionalDelete,
        undefined,
        `Deleted ${result.length} locations`,
      );
    } catch (error) {
      await this.recordResult(
        "DELETE CONDITIONAL",
        "locations",
        startConditionalDelete,
        error as Error,
      );
    }

    // 3. Cleanup DELETE (organization and user)
    const startCleanupOrg = Date.now();
    try {
      const result = await this.db
        .delete(schema.organizations)
        .where(eq(schema.organizations.id, this.testOrgId))
        .returning();

      await this.recordResult(
        "DELETE CLEANUP",
        "organizations",
        startCleanupOrg,
        undefined,
        `Cleaned up ${result.length} organizations`,
      );
    } catch (error) {
      await this.recordResult(
        "DELETE CLEANUP",
        "organizations",
        startCleanupOrg,
        error as Error,
      );
    }

    const startCleanupUser = Date.now();
    try {
      const result = await this.db
        .delete(schema.users)
        .where(eq(schema.users.id, this.testUserId))
        .returning();

      await this.recordResult(
        "DELETE CLEANUP",
        "users",
        startCleanupUser,
        undefined,
        `Cleaned up ${result.length} users`,
      );
    } catch (error) {
      await this.recordResult(
        "DELETE CLEANUP",
        "users",
        startCleanupUser,
        error as Error,
      );
    }
  }

  /**
   * Test transaction support and rollback scenarios
   */
  async testTransactionOperations(): Promise<void> {
    console.log("\n🔄 Testing TRANSACTION Operations...");

    // 1. Successful transaction
    const startSuccessTransaction = Date.now();
    try {
      const result = await this.db.transaction(async (tx) => {
        const [user] = await tx
          .insert(schema.users)
          .values({
            id: `tx-user-${Date.now()}`,
            email: "transaction-test@example.com",
            name: "Transaction Test User",
          })
          .returning();

        const [org] = await tx
          .insert(schema.organizations)
          .values({
            id: `tx-org-${Date.now()}`,
            name: "Transaction Test Org",
            subdomain: `tx-test-${Date.now()}`,
          })
          .returning();

        return { user, org };
      });

      await this.recordResult(
        "TRANSACTION SUCCESS",
        "multi-table",
        startSuccessTransaction,
        undefined,
        `Created user ${result.user?.id} and org ${result.org?.id}`,
      );

      // Cleanup
      if (result.user?.id) {
        await this.db
          .delete(schema.users)
          .where(eq(schema.users.id, result.user.id));
      }
      if (result.org?.id) {
        await this.db
          .delete(schema.organizations)
          .where(eq(schema.organizations.id, result.org.id));
      }
    } catch (error) {
      await this.recordResult(
        "TRANSACTION SUCCESS",
        "multi-table",
        startSuccessTransaction,
        error as Error,
      );
    }

    // 2. Rollback transaction
    const startRollbackTransaction = Date.now();
    try {
      await this.db.transaction(async (tx) => {
        // Create user successfully
        await tx
          .insert(schema.users)
          .values({
            id: `rollback-user-${Date.now()}`,
            email: "rollback-test@example.com",
            name: "Rollback Test User",
          })
          .returning();

        // This should cause rollback due to duplicate subdomain
        await tx.insert(schema.organizations).values({
          id: `rollback-org-${Date.now()}`,
          name: "Rollback Test Org",
          subdomain: "duplicate-subdomain", // This might cause constraint violation
        });

        // Intentionally throw to test rollback
        throw new Error("Intentional rollback test");
      });

      await this.recordResult(
        "TRANSACTION ROLLBACK",
        "multi-table",
        startRollbackTransaction,
        new Error("Transaction should have been rolled back"),
      );
    } catch {
      // This is expected - verify no data was committed
      const users = await this.db
        .select()
        .from(schema.users)
        .where(sql`${schema.users.email} LIKE 'rollback-test%'`);

      if (users.length === 0) {
        await this.recordResult(
          "TRANSACTION ROLLBACK",
          "multi-table",
          startRollbackTransaction,
          undefined,
          "Rollback successful - no data committed",
        );
      } else {
        await this.recordResult(
          "TRANSACTION ROLLBACK",
          "multi-table",
          startRollbackTransaction,
          new Error(
            `Rollback failed - found ${users.length} users that should have been rolled back`,
          ),
        );
      }
    }
  }

  /**
   * Generate comprehensive test report
   */
  generateReport(): void {
    console.log("\n" + "=".repeat(80));
    console.log("📊 DRIZZLE CRUD VALIDATION REPORT");
    console.log("=".repeat(80));

    const totalTests = this.results.length;
    const successfulTests = this.results.filter(
      (r) => r.status === "success",
    ).length;
    const failedTests = this.results.filter((r) => r.status === "error").length;
    const successRate = (successfulTests / totalTests) * 100;

    console.log(`\n📈 SUMMARY:`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Successful: ${successfulTests} ✅`);
    console.log(`   Failed: ${failedTests} ❌`);
    console.log(`   Success Rate: ${successRate.toFixed(1)}%`);

    if (failedTests > 0) {
      console.log(`\n❌ FAILURES:`);
      this.results
        .filter((r) => r.status === "error")
        .forEach((result) => {
          console.log(
            `   • ${result.operation} ${result.table}: ${result.error}`,
          );
        });
    }

    console.log(`\n⚡ PERFORMANCE:`);
    if (totalTests > 0) {
      const avgDuration =
        this.results.reduce((sum, r) => sum + r.duration, 0) / totalTests;
      const slowestTest = this.results.reduce((max, r) =>
        r.duration > max.duration ? r : max,
      );
      const fastestTest = this.results.reduce((min, r) =>
        r.duration < min.duration ? r : min,
      );

      console.log(`   Average: ${avgDuration.toFixed(1)}ms`);
      console.log(
        `   Fastest: ${fastestTest.operation} ${fastestTest.table} (${fastestTest.duration}ms)`,
      );
      console.log(
        `   Slowest: ${slowestTest.operation} ${slowestTest.table} (${slowestTest.duration}ms)`,
      );
    } else {
      console.log(
        `   No performance data available - all tests failed to execute`,
      );
    }

    console.log(`\n📊 BY OPERATION TYPE:`);
    const operationTypes = [...new Set(this.results.map((r) => r.operation))];
    operationTypes.forEach((opType) => {
      const opResults = this.results.filter((r) => r.operation === opType);
      const opSuccess = opResults.filter((r) => r.status === "success").length;
      const opTotal = opResults.length;
      const opRate = (opSuccess / opTotal) * 100;
      console.log(
        `   ${opType}: ${opSuccess}/${opTotal} (${opRate.toFixed(1)}%)`,
      );
    });

    console.log("\n" + "=".repeat(80));
  }

  /**
   * Run minimal connectivity and basic operations test
   */
  async runMinimalTests(): Promise<void> {
    console.log("🚀 Starting Drizzle CRUD Validation (Minimal)...");
    console.log(`Environment: ${env.NODE_ENV}`);
    console.log(`Database: ${env.DATABASE_URL?.split("@")[1] ?? "Unknown"}`);

    try {
      // Step 1: Test basic connection first
      const connectionSuccess = await this.testConnection();
      if (!connectionSuccess) {
        console.error("\n💥 Connection test failed - skipping remaining tests");
        this.generateReport();
        return;
      }

      // Step 2: Basic data query (no data modification)
      const startConnectivity = Date.now();
      try {
        const userCount = await this.db
          .select({ count: sql<number>`count(*)` })
          .from(schema.users);

        await this.recordResult(
          "DATA_QUERY",
          "users",
          startConnectivity,
          undefined,
          `Found ${userCount[0]?.count ?? 0} users`,
        );
      } catch (error) {
        await this.recordResult(
          "DATA_QUERY",
          "users",
          startConnectivity,
          error as Error,
        );
      }

      // Step 3: Schema validation (verify all tables exist)
      const tables = [
        { table: schema.users, name: "users" },
        { table: schema.organizations, name: "organizations" },
        { table: schema.locations, name: "locations" },
        { table: schema.models, name: "models" },
        { table: schema.machines, name: "machines" },
      ];

      for (const { table, name } of tables) {
        const startSchema = Date.now();
        try {
          await this.db.select().from(table).limit(1);
          await this.recordResult(
            "SCHEMA_CHECK",
            name,
            startSchema,
            undefined,
            "Table accessible",
          );
        } catch (error) {
          await this.recordResult(
            "SCHEMA_CHECK",
            name,
            startSchema,
            error as Error,
          );
        }
      }
    } catch (error) {
      console.error("\n💥 Minimal validation failed:", error);
    }

    this.generateReport();
  }

  /**
   * Run all CRUD validation tests
   */
  async runAllTests(): Promise<void> {
    console.log("🚀 Starting Drizzle CRUD Validation (Full)...");
    console.log(`Environment: ${env.NODE_ENV}`);
    console.log(`Database: ${env.DATABASE_URL?.split("@")[1] ?? "Unknown"}`);

    try {
      if (this.isMinimalMode) {
        await this.runMinimalTests();
        return;
      }

      // Test connection first before running full CRUD tests
      const connectionSuccess = await this.testConnection();
      if (!connectionSuccess) {
        console.error("\n💥 Connection test failed - skipping remaining tests");
        this.generateReport();
        return;
      }

      await this.testInsertOperations();
      await this.testSelectOperations();
      await this.testUpdateOperations();
      await this.testDeleteOperations();
      await this.testTransactionOperations();
    } catch (error) {
      console.error("\n💥 Validation failed with critical error:", error);
    }

    this.generateReport();
  }
}

// Main execution
async function main() {
  // Check if minimal mode is requested via environment variable or CLI arg
  const isMinimalMode =
    process.env["DB_VALIDATE_MINIMAL"] === "true" ||
    process.argv.includes("--minimal");

  const validator = new DrizzleCRUDValidator(isMinimalMode);
  await validator.runAllTests();

  // Close database connections to prevent hanging
  await closeDrizzleConnection();
}

// Execute when run directly
main()
  .then(() => {
    // Ensure the process exits after completion
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
