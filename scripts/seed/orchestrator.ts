/**
 * Modern Seeding Architecture - Orchestrator
 *
 * Environment-aware coordination of infrastructure, auth, and sample data.
 * Replaces the old duplicate seed-development.ts, seed-production.ts, seed-beta.ts
 */

import { env } from "~/env";
import { seedInfrastructure } from "./infrastructure";
import { seedAuthUsers } from "./auth-users";
import { seedSampleData } from "./sample-data";

/**
 * User seeding strategies per environment
 */
export const SEED_STRATEGIES = {
  development: {
    users: [
      // Dev Users (3) - replaces Test users
      {
        name: "Dev Admin",
        email: "admin@dev.local",
        role: "Admin",
        bio: "Development admin test account.",
      },
      {
        name: "Dev Member",
        email: "member@dev.local",
        role: "Member",
        bio: "Development member test account.",
      },
      {
        name: "Dev Player",
        email: "player@dev.local",
        role: "Member",
        bio: "Development player test account.",
      },

      // Pinball Personalities (4) - preserved from original
      {
        name: "Roger Sharpe",
        email: "roger.sharpe@pinpoint.dev",
        role: "Admin",
        bio: "Pinball ambassador and historian.",
      },
      {
        name: "Gary Stern",
        email: "gary.stern@pinpoint.dev",
        role: "Member",
        bio: "Founder of Stern Pinball.",
      },
      {
        name: "Escher Lefkoff",
        email: "escher.lefkoff@pinpoint.dev",
        role: "Member",
        bio: "World champion competitive pinball player.",
      },
      {
        name: "Harry Williams",
        email: "harry.williams@pinpoint.dev",
        role: "Member",
        bio: "The father of pinball.",
      },
    ],
    sampleData: true, // Machines + JSON sample issues
    resetDatabase: true, // Allow full reset in development
  },

  beta: {
    users: [
      {
        name: env.SEED_ADMIN_NAME || "Beta Admin",
        email: env.SEED_ADMIN_EMAIL || "admin@beta.local",
        role: "Admin",
        bio: "Beta environment administrator.",
      },
    ],
    sampleData: false, // Clean beta environment
    resetDatabase: false, // Preserve existing data
  },

  production: {
    // Identical to beta - consolidated as requested
    users: [
      {
        name: env.SEED_ADMIN_NAME || "Production Admin",
        email: env.SEED_ADMIN_EMAIL || "admin@production.local",
        role: "Admin",
        bio: "Production environment administrator.",
      },
    ],
    sampleData: false, // No test data in production
    resetDatabase: false, // Never reset production
  },
} as const;

/**
 * Environment detection with fallback
 */
function getEnvironment(): keyof typeof SEED_STRATEGIES {
  const nodeEnv = process.env["NODE_ENV"];

  if (nodeEnv === "production") return "production";
  if (nodeEnv === "beta") return "beta";

  // Default to development for local, test, preview environments
  return "development";
}

/**
 * Validate environment-specific requirements
 */
function validateEnvironment(environment: keyof typeof SEED_STRATEGIES): void {
  const strategy = SEED_STRATEGIES[environment];

  // Beta and production require admin email
  if (environment === "beta" || environment === "production") {
    if (!env.SEED_ADMIN_EMAIL) {
      throw new Error(
        `${environment.toUpperCase()} environment requires SEED_ADMIN_EMAIL environment variable`,
      );
    }
  }

  console.log(`[SEED] Environment: ${environment.toUpperCase()}`);
  console.log(`[SEED] Users to create: ${strategy.users.length.toString()}`);
  console.log(`[SEED] Sample data: ${strategy.sampleData ? "YES" : "NO"}`);
  console.log(`[SEED] Reset allowed: ${strategy.resetDatabase ? "YES" : "NO"}`);
}

/**
 * Main seeding orchestrator
 */
export async function main(): Promise<void> {
  const startTime = Date.now();
  console.log("[SEED] 🌱 Starting modern seeding architecture...");

  try {
    // 1. Environment detection and validation
    const environment = getEnvironment();
    const strategy = SEED_STRATEGIES[environment];
    validateEnvironment(environment);

    // 2. Infrastructure seeding (organizations, permissions, roles, statuses)
    console.log("\n[SEED] 🏗️  Step 1: Infrastructure");
    const organization = await seedInfrastructure();

    // 3. Auth users seeding (Supabase auth + automatic profile creation)
    console.log("\n[SEED] 👥 Step 2: Auth Users");
    await seedAuthUsers([...strategy.users], organization.id);

    // 4. Sample data seeding (development only)
    if (strategy.sampleData) {
      console.log("\n[SEED] 🎮 Step 3: Sample Data");
      await seedSampleData(organization.id);
    } else {
      console.log("\n[SEED] ⏭️  Step 3: Sample Data (SKIPPED)");
    }

    // 5. Success summary
    const duration = Date.now() - startTime;
    console.log(
      `\n✅ [SEED] Modern seeding completed in ${duration.toString()}ms!`,
    );
    console.log("");
    console.log("🔑 Environment Summary:");
    console.log(`   Environment: ${environment.toUpperCase()}`);
    console.log(
      `   Organization: ${organization.name} (${organization.subdomain})`,
    );
    console.log(`   Users: ${strategy.users.length.toString()} users created`);
    console.log(
      `   Sample Data: ${strategy.sampleData ? "Included" : "Not included"}`,
    );

    if (environment === "development") {
      console.log("");
      console.log("🧪 Development Credentials:");
      console.log("   Admin: admin@dev.local");
      console.log("   Member: member@dev.local");
      console.log("   Player: player@dev.local");
      console.log("   Password: dev-password-123 (for all dev users)");
    }
  } catch (error) {
    console.error("\n❌ [SEED] Seeding failed:");
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
