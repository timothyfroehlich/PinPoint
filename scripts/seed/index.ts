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

import { seedInfrastructure } from "./shared/infrastructure";
import { seedAuthUsers } from "./shared/auth-users";
import { seedSampleData } from "./shared/sample-data";

type SeedTarget = "local:pg" | "local:sb" | "preview";

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

    // 2. Environment validation
    validateEnvironment(target);

    // 3. Infrastructure seeding (organizations, permissions, roles, statuses)
    console.log("\n[SEED] 🏗️  Step 1: Infrastructure");
    const organization = await seedInfrastructure();

    // 4. Auth users seeding (skip for PostgreSQL-only)
    if (target !== "local:pg") {
      console.log("\n[SEED] 👥 Step 2: Auth Users");
      await seedAuthUsers(organization.id, target);
    } else {
      console.log(
        "\n[SEED] ⏭️  Step 2: Auth Users (SKIPPED for PostgreSQL-only)",
      );
    }

    // 5. Sample data seeding with amount based on target
    console.log("\n[SEED] 🎮 Step 3: Sample Data");
    const dataAmount = target === "preview" ? "full" : "minimal";
    await seedSampleData(organization.id, dataAmount);

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
