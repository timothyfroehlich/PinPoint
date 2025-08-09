#!/usr/bin/env tsx
/**
 * Explicit Database Seeding - Single Entry Point
 *
 * Replaces the complex orchestrator with simple, target-based seeding.
 * Eliminates environment detection complexity in favor of explicit commands.
 *
 * Usage:
 *   tsx scripts/seed/index.ts local:pg    # PostgreSQL-only (CI tests)
 *   tsx scripts/seed/index.ts local:sb    # Local Supabase (development)
 *   tsx scripts/seed/index.ts preview     # Remote preview environment
 */

// Load development environment variables for standalone script execution
import "../../src/lib/env-loaders/development";

import { getEnvironmentName } from "../../src/lib/environment";
import { seedInfrastructure } from "./shared/infrastructure";
import { seedAuthUsers } from "./shared/auth-users";
import { seedSampleData } from "./shared/sample-data";

type SeedTarget = "local:pg" | "local:sb" | "preview";

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
 * Validate environment-specific requirements
 */
function validateEnvironment(target: SeedTarget): void {
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
  console.log(`[SEED] Auth users: ${target === "local:pg" ? "NO" : "YES"}`);
  console.log(
    `[SEED] Sample data: ${target === "preview" ? "FULL" : "MINIMAL"}`,
  );
}

/**
 * Main seeding function
 */
async function main(): Promise<void> {
  const startTime = Date.now();
  console.log("[SEED] 🌱 Starting explicit database seeding...");

  try {
    // 1. Validate target parameter
    const target = process.argv[2];
    if (!target || !validateTarget(target)) {
      console.error(
        "Usage: tsx scripts/seed/index.ts <local:pg|local:sb|preview>",
      );
      console.error("");
      console.error("Targets:");
      console.error("  local:pg  - PostgreSQL-only seeding for CI tests");
      console.error("  local:sb  - Local Supabase seeding for development");
      console.error("  preview   - Remote preview environment seeding");
      process.exit(1);
    }

    // 2. Debug logging - capture calling context
    const officialEnv = getEnvironmentType();
    const supabaseUrl = process.env["SUPABASE_URL"] || "not-set";

    console.log("\n[DEBUG] 🔍 Environment Detection Debug Info:");
    console.log(`[DEBUG] Command line args: ${process.argv.join(" ")}`);
    console.log(`[DEBUG] Requested target: ${target}`);
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
    validateEnvironment(target);

    // 3. Infrastructure seeding (organizations, permissions, roles, statuses)
    console.log("\n[SEED] 🏗️  Step 1: Infrastructure");
    const organization = await seedInfrastructure();

    // 4 & 5. Auth users and Sample data seeding in parallel (where safe)
    if (target !== "local:pg") {
      console.log(
        "\n[SEED] 👥🎮 Step 2 & 3: Auth Users + Sample Data (parallel optimization)",
      );
      const dataAmount = target === "preview" ? "full" : "minimal";

      try {
        // Run auth users and sample data in parallel since they're independent
        await Promise.all([
          seedAuthUsers(organization.id, target),
          seedSampleData(organization.id, dataAmount),
        ]);
        console.log("[SEED] ✅ Parallel processing completed successfully");
      } catch (error) {
        console.error("[SEED] ❌ Parallel processing failed:", error);
        throw error;
      }
    } else {
      console.log(
        "\n[SEED] ⏭️  Step 2: Auth Users (SKIPPED for PostgreSQL-only)",
      );

      // 5. Sample data seeding only
      console.log("\n[SEED] 🎮 Step 3: Sample Data");
      const dataAmount = "minimal"; // PostgreSQL-only always uses minimal
      await seedSampleData(organization.id, dataAmount);
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
      `   Organization: ${organization.name} (${organization.subdomain})`,
    );
    console.log(
      `   Auth Users: ${target === "local:pg" ? "Skipped" : "Created"}`,
    );
    const dataAmount = target === "preview" ? "full" : "minimal";
    console.log(
      `   Sample Data: ${dataAmount === "full" ? "Full dataset" : "Minimal dataset"}`,
    );

    if (target !== "local:pg") {
      console.log("");
      console.log("🧪 Development Credentials:");
      console.log("   Admin: admin@dev.local");
      console.log("   Member: member@dev.local");
      console.log("   Player: player@dev.local");
      console.log("   Password: dev-login-123 (for all dev users)");
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
