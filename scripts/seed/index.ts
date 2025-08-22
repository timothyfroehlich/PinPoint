#!/usr/bin/env tsx
/**
 * Explicit Database Seeding - Single Entry Point
 *
 * Replaces the complex orchestrator with simple, target-based seeding.
 * Eliminates environment detection complexity in favor of explicit commands.
 *
 * Usage:
 *   tsx scripts/seed/index.ts local:pg minimal    # PostgreSQL-only (CI tests)
 *   tsx scripts/seed/index.ts local:sb minimal    # Local Supabase (development)
 *   tsx scripts/seed/index.ts local:sb full       # Local Supabase with full dataset
 *   tsx scripts/seed/index.ts preview full        # Remote preview environment
 */

// Load development environment variables for standalone script execution
import "../../src/lib/env-loaders/development";

import { getEnvironmentName } from "../../src/lib/environment";
import { seedInfrastructure } from "./shared/infrastructure";
import { seedAuthUsers } from "./shared/auth-users";
import { seedSampleData } from "./shared/sample-data";

type SeedTarget = "local:pg" | "local:sb" | "preview";
type DataAmount = "minimal" | "full";

/**
 * Get environment type using official detection logic
 * Uses the centralized environment detection from src/lib/environment.js
 */
function getEnvironmentType() {
  // Use official environment detection
  return getEnvironmentName();
}

/**
 * Validate target parameter
 */
function validateTarget(target: string): target is SeedTarget {
  const validTargets: SeedTarget[] = ["local:pg", "local:sb", "preview"];
  return validTargets.includes(target as SeedTarget);
}

/**
 * Validate data amount parameter
 */
function validateDataAmount(dataAmount: string): dataAmount is DataAmount {
  const validAmounts: DataAmount[] = ["minimal", "full"];
  return validAmounts.includes(dataAmount as DataAmount);
}

/**
 * Validate environment-specific requirements
 */
function validateEnvironment(target: SeedTarget, dataAmount: DataAmount): void {
  // Only validate preview environment (needs remote Supabase URL)
  if (target === "preview") {
    const supabaseUrl = process.env["SUPABASE_URL"];
    if (!supabaseUrl?.includes("supabase.co")) {
      throw new Error(
        "Preview environment requires remote Supabase URL (must contain 'supabase.co')",
      );
    }
  }

  // Local targets require no validation - errors will surface naturally
  console.log(`[SEED] Target: ${target.toUpperCase()}`);
  console.log(`[SEED] Data Amount: ${dataAmount.toUpperCase()}`);
  console.log(
    `[SEED] Auth users: YES (${target === "local:pg" ? "direct DB" : "Supabase Auth"})`,
  );
  console.log(`[SEED] Sample data: ${dataAmount.toUpperCase()}`);
}

/**
 * Main seeding function
 */
async function main(): Promise<void> {
  const startTime = Date.now();
  console.log("[SEED] 🌱 Starting explicit database seeding...");

  try {
    // 1. Validate target and data amount parameters
    const target = process.argv[2];
    const dataAmount = process.argv[3];

    if (
      !target ||
      !validateTarget(target) ||
      !dataAmount ||
      !validateDataAmount(dataAmount)
    ) {
      console.error("Usage: tsx scripts/seed/index.ts <target> <dataAmount>");
      console.error("");
      console.error("Targets:");
      console.error("  local:pg  - PostgreSQL-only seeding for CI tests");
      console.error("  local:sb  - Local Supabase seeding for development");
      console.error("  preview   - Remote preview environment seeding");
      console.error("");
      console.error("Data Amounts:");
      console.error(
        "  minimal   - Basic test data (3 users, 6 machines, 10 issues)",
      );
      console.error(
        "  full      - Complete sample data (3 users, 60+ machines, 200+ issues)",
      );
      console.error("");
      console.error("Examples:");
      console.error("  tsx scripts/seed/index.ts local:sb minimal");
      console.error("  tsx scripts/seed/index.ts preview full");
      process.exit(1);
    }

    // 2. Debug logging - capture calling context
    const officialEnv = getEnvironmentType();
    const supabaseUrl = process.env["SUPABASE_URL"] || "not-set";

    console.log("\n[DEBUG] 🔍 Environment Detection Debug Info:");
    console.log(`[DEBUG] Command line args: ${process.argv.join(" ")}`);
    console.log(`[DEBUG] Requested target: ${target}`);
    console.log(`[DEBUG] Requested data amount: ${dataAmount}`);
    console.log(`[DEBUG] Official environment: ${officialEnv}`);
    console.log(`[DEBUG] NODE_ENV: ${process.env["NODE_ENV"] || "not-set"}`);
    console.log(
      `[DEBUG] VERCEL_ENV: ${process.env["VERCEL_ENV"] || "not-set"}`,
    );
    console.log(
      `[DEBUG] SUPABASE_URL: ${supabaseUrl.substring(0, 50)}${supabaseUrl.length > 50 ? "..." : ""}`,
    );
    console.log(`[DEBUG] Process working directory: ${process.cwd()}`);
    console.log(
      `[DEBUG] Parent process: ${process.env["PARENT_PID"] || "unknown"}`,
    );

    // 3. Safety checks - prevent accidental destructive operations
    if (target === "preview") {
      console.log(
        "\n⚠️  [SAFETY] PREVIEW MODE DETECTED - DESTRUCTIVE OPERATION WARNING!",
      );
      console.log("[SAFETY] This mode will DELETE ALL existing dev users!");
      console.log(
        "[SAFETY] Users to be deleted: admin@dev.local, member@dev.local, player@dev.local, and pinball personalities",
      );

      // Cross-validate with official environment detection
      if (officialEnv === "development") {
        console.error(
          "\n❌ [SAFETY] BLOCKED: Preview mode blocked in development environment!",
        );
        console.error(
          "[SAFETY] Target 'preview' is not allowed when NODE_ENV=development",
        );
        console.error("[SAFETY] Use 'local:sb' for local development instead");
        console.error("");
        console.error("Environment Detection Details:");
        console.error(`  Requested Target: ${target}`);
        console.error(`  Detected Environment: ${officialEnv}`);
        console.error(`  NODE_ENV: ${process.env["NODE_ENV"]}`);
        console.error(
          `  VERCEL_ENV: ${process.env["VERCEL_ENV"] || "not-set"}`,
        );
        process.exit(1);
      }

      // Warn about preview mode even in valid environments
      console.log("[SAFETY] Preview mode requires remote Supabase URL");
      console.log("[SAFETY] Continuing in 3 seconds... (Ctrl+C to abort)");

      // Add a brief delay for manual cancellation
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    // 4. Environment validation
    validateEnvironment(target, dataAmount);

    // 3. Infrastructure seeding (dual organizations, permissions, roles, statuses)
    console.log("\n[SEED] 🏗️  Step 1: Infrastructure");
    const organizations = await seedInfrastructure();

    // 4 & 5. Auth users and Sample data seeding sequentially (dependencies)
    console.log(
      "\n[SEED] 👥🎮 Step 2 & 3: Auth Users + Sample Data (sequential for dependencies)",
    );

    try {
      // First, create auth users (required for sample data user references)
      // All modes now create users: local:pg uses direct DB, others use Supabase Auth
      await seedAuthUsers(organizations.primary.id, target);
      // Then create sample data (depends on users existing)
      await seedSampleData(organizations.primary.id, dataAmount, false); // All modes have users now
      console.log("[SEED] ✅ Sequential processing completed successfully");
    } catch (error) {
      console.error("[SEED] ❌ Sequential processing failed:", error);
      throw error;
    }

    // 6. Success summary
    const duration = Date.now() - startTime;
    console.log(
      `\n✅ [SEED] Explicit seeding completed in ${duration.toString()}ms!`,
    );
    console.log("");
    console.log("🔑 Environment Summary:");
    console.log(`   Target: ${target.toUpperCase()}`);
    console.log(
      `   Primary Organization: ${organizations.primary.name} (${organizations.primary.subdomain})`,
    );
    console.log(
      `   Secondary Organization: ${organizations.secondary.name} (${organizations.secondary.subdomain})`,
    );
    console.log(
      `   Auth Users: Created (${target === "local:pg" ? "direct DB" : "Supabase Auth"})`,
    );
    console.log(
      `   Sample Data: ${dataAmount === "full" ? "Full dataset (60+ machines, 200+ issues)" : "Minimal dataset (6 machines, 10 issues)"}`,
    );
    console.log(
      `   Behavior: Upsert-based (idempotent) - always creates complete dataset`,
    );

    console.log("");
    console.log("🧪 Development Credentials:");
    if (target === "local:pg") {
      console.log("   Admin: tim@example.com (direct DB user)");
      console.log("   Member1: harry@example.com (direct DB user)");
      console.log("   Member2: escher@example.com (direct DB user)");
    } else {
      console.log("   Admin: tim@example.com");
      console.log("   Member1: harry@example.com");
      console.log("   Member2: escher@example.com");
      console.log("   Password: dev-login-123 (for all dev users)");
    }

    console.log("");
    console.log("📊 Data Summary (both modes create identical counts):");
    if (dataAmount === "minimal") {
      console.log("   Users: 3 (tim, harry, escher)");
      console.log("   Organizations: 2 (primary, competitor)");
      console.log("   Machines: 6 primary + 1 competitor = 7 total");
      console.log("   Issues: 10 (minimal dataset)");
      console.log(
        "   Only difference: User creation method (direct DB vs Supabase Auth)",
      );
    }
  } catch (error) {
    console.error(
      `\n❌ [SEED] Explicit seeding failed for target '${process.argv[2] ?? "unknown"}':`,
    );
    console.error(error);
    process.exit(1);
  }
}

// Run if called directly (ESM equivalent of require.main === module)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error("Unhandled seeding error:", error);
    process.exit(1);
  });
}
