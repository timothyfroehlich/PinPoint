#!/usr/bin/env tsx
/**
 * Explicit Database Seeding - Single Entry Point
 *
 * Unified seeding orchestrator using shared utilities for consistent patterns.
 * Eliminates duplicate validation/logging/error handling across seed files.
 *
 * Note: This file handles database seeding using snake_case field names
 * to match the actual database schema. Field validation ensures consistency.
 *
 * Usage:
 *   tsx src/server/db/seed/index.ts local:pg minimal    # PostgreSQL-only (CI tests)
 *   tsx src/server/db/seed/index.ts local:sb minimal    # Local Supabase (development)
 *   tsx src/server/db/seed/index.ts local:sb full       # Local Supabase with full dataset
 *   tsx src/server/db/seed/index.ts preview full        # Remote preview environment
 */

// Load development environment variables for standalone script execution
import "~/lib/env-loaders/development";

// Internal utilities
import { getEnvironmentName } from "~/lib/environment";
import { env } from "~/env.js";
import {
  SeedLogger,
  SeedValidator,
  SeedConfigBuilder,
  confirmDestructiveOperation,
  withErrorContext,
  type SeedTarget,
  type DataAmount,
} from "./seed-utilities";

// Local imports
import { seedInfrastructure } from "./infrastructure";
import { seedAuthUsers } from "./auth-users";
import { seedSampleData } from "./sample-data";

/**
 * Main seeding function with unified error handling and validation
 */
async function main(): Promise<void> {
  const startTime = Date.now();
  SeedLogger.info("🌱 Starting explicit database seeding...");

  try {
    // 1. Parse and validate parameters
    const target = process.argv[2];
    const dataAmount = process.argv[3];

    // Handle optional supabaseUrl for exactOptionalPropertyTypes compliance
    const supabaseUrl = env.SUPABASE_URL;
    const validationParams: {
      target: string;
      dataAmount: string;
      environment: string;
      supabaseUrl?: string;
    } = {
      target: target ?? "",
      dataAmount: dataAmount ?? "",
      environment: getEnvironmentName(),
    };

    if (supabaseUrl) {
      validationParams.supabaseUrl = supabaseUrl;
    }

    const validation = SeedValidator.validateAll(validationParams);

    if (!validation.success) {
      SeedLogger.error("VALIDATION", validation.errors.join(", "));
      SeedValidator.showUsage();
      process.exit(1);
    }

    // 2. Build configuration
    const config = SeedConfigBuilder.forTarget(target as SeedTarget)
      .withDataAmount(dataAmount as DataAmount)
      .withEnvironment(getEnvironmentName())
      .withSupabaseUrl(env.SUPABASE_URL ?? "")
      .build();

    // 3. Safety confirmation for destructive operations
    await confirmDestructiveOperation(config.target);

    SeedLogger.info(
      `Target: ${config.target.toUpperCase()}, Data: ${config.dataAmount.toUpperCase()}`,
    );

    // 4. Execute seeding steps with error context
    const organizationResult = await withErrorContext(
      "INFRASTRUCTURE",
      "seed infrastructure data",
      () => seedInfrastructure(),
    );

    // Extract the actual organizations data from the SeedResult
    const organizations = organizationResult.data;

    // Sequential auth users and sample data (dependencies)
    await withErrorContext(
      "AUTH_USERS",
      "seed authentication users",
      async () => {
        await seedAuthUsers(organizations.primary.id, config.target);
        await seedAuthUsers(organizations.secondary.id, config.target);
      },
    );

    await withErrorContext("SAMPLE_DATA", "seed sample data", () =>
      seedSampleData(organizations.primary.id, config.dataAmount),
    );

    // 5. Success summary
    const duration = Date.now() - startTime;
    SeedLogger.success(`Completed in ${String(duration)}ms`);

    console.log("");
    console.log("🔑 Environment Summary:");
    console.log(`   Target: ${config.target.toUpperCase()}`);
    console.log(`   Primary Organization: ${organizations.primary.name}`);
    console.log(`   Secondary Organization: ${organizations.secondary.name}`);
    console.log(`   Auth Users: Created for BOTH organizations`);
    console.log(
      `   Sample Data: ${config.dataAmount === "full" ? "Full dataset" : "Minimal dataset"}`,
    );

    if (config.target !== "local:pg") {
      console.log("");
      console.log("🧪 Development Credentials:");
      console.log("   Admin: tim.froehlich@example.com");
      console.log("   Member1: harry.williams@example.com");
      console.log("   Member2: escher.lefkoff@example.com");
      console.log("   Password: dev-login-123 (for all dev users)");
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    SeedLogger.error(
      "SEEDING",
      `Failed after ${String(duration)}ms: ${String(error)}`,
    );
    process.exit(1);
  }
}

// Run if called directly (ESM equivalent of require.main === module)
if (import.meta.url === `file://${process.argv[1] ?? ""}`) {
  main().catch((error: unknown) => {
    SeedLogger.error("UNHANDLED", error);
    process.exit(1);
  });
}
