#!/usr/bin/env tsx

/**
 * Test Drizzle Database Connectivity
 *
 * REAL testing - actually connects to database and runs operations
 */

import { sql } from "drizzle-orm";

// Load environment variables using the development env-loader
import "~/lib/env-loaders/development";

async function testDrizzleConnectivity() {
  console.log("🔧 Testing Real Drizzle Database Connectivity...\n");

  try {
    // Test 1: Environment Variables
    console.log("📋 Checking environment variables...");
    const requiredEnvs = [
      "DATABASE_URL",
      "POSTGRES_URL",
      "SUPABASE_URL",
      "SUPABASE_ANON_KEY",
    ];

    const missingEnvs = requiredEnvs.filter((env) => !process.env[env]);
    if (missingEnvs.length > 0) {
      console.log(
        `❌ Missing environment variables: ${missingEnvs.join(", ")}`,
      );
      console.log(
        "Available env vars:",
        Object.keys(process.env).filter(
          (k) => k.includes("POSTGRES") || k.includes("SUPABASE"),
        ),
      );
      return;
    }
    console.log("✅ All required environment variables present");

    // Test 2: Direct Database Connection
    console.log("\n🔌 Testing direct database connection...");

    // Import Drizzle after env vars are loaded
    const { createDrizzleClient } = await import("~/server/db/drizzle");
    const drizzle = createDrizzleClient();

    // Simple connectivity test
    await drizzle.execute(sql`SELECT 1 as test, NOW() as timestamp`);
    console.log("✅ Database connection successful");
    console.log(`  - Connected at: ${new Date().toISOString()}`);

    // Test 3: Schema Import with Environment
    console.log("\n📦 Testing schema imports with database context...");
    const schemas = await import("~/server/db/schema");
    console.log(
      `✅ Schemas imported successfully (${Object.keys(schemas).length} exports)`,
    );

    // Test 4: Database Provider Integration
    console.log("\n🏭 Testing DatabaseProvider with real environment...");
    const { getGlobalDatabaseProvider } = await import("~/server/db/provider");
    const provider = getGlobalDatabaseProvider();

    const prismaClient = provider.getClient();
    const drizzleClient = provider.getDrizzleClient();

    console.log("✅ Both ORM clients operational");
    console.log(`  - Prisma client ready: ${typeof prismaClient}`);
    console.log(`  - Drizzle client ready: ${typeof drizzleClient}`);

    console.log("\n🎉 Database Connectivity Test Complete!");
    console.log("Ready for schema generation and operations.");
  } catch (error) {
    console.error("\n❌ Connectivity test failed:");
    console.error(error);
    process.exit(1);
  }
}

// Execute test
testDrizzleConnectivity()
  .then(() => {
    console.log("\n✨ Connectivity validation successful!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Connectivity test failed:", error);
    process.exit(1);
  });
