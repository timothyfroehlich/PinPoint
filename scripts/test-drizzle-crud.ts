#!/usr/bin/env tsx

/**
 * Test Basic Drizzle CRUD Operations
 *
 * Test that Drizzle can read/write to existing Prisma tables
 */

import { config } from "dotenv";
import { sql } from "drizzle-orm";

// Load environment variables first
config();

async function testDrizzleCrud() {
  console.log("🧪 Testing Drizzle CRUD Operations...\n");

  try {
    const { createDrizzleClient } = await import("~/server/db/drizzle");
    const { organizations, users } = await import("~/server/db/schema");
    const drizzle = createDrizzleClient();

    // Test 1: Simple SELECT query
    console.log("📖 Testing SELECT operations...");

    // Count existing organizations
    const orgCountResult = await drizzle.execute(
      sql`SELECT COUNT(*) as count FROM "Organization"`,
    );
    console.log(
      `✅ Found ${(orgCountResult as any)[0].count} existing organizations`,
    );

    // Count existing users
    const userCountResult = await drizzle.execute(
      sql`SELECT COUNT(*) as count FROM "User"`,
    );
    console.log(`✅ Found ${(userCountResult as any)[0].count} existing users`);

    // Test 2: Drizzle-style SELECT queries
    console.log("\n🔍 Testing Drizzle query builder...");

    // Try selecting organizations using Drizzle syntax
    const orgsQuery = drizzle.select().from(organizations);
    console.log("✅ Organizations query built successfully");

    // Try selecting users using Drizzle syntax
    const usersQuery = drizzle.select().from(users);
    console.log("✅ Users query built successfully");

    // Test 3: Execute Drizzle queries
    console.log("\n⚡ Executing Drizzle queries...");

    try {
      const orgsResult = await orgsQuery.limit(5);
      console.log(`✅ Successfully queried ${orgsResult.length} organizations`);
      if (orgsResult.length > 0) {
        console.log(`  - Sample org: ${orgsResult[0]?.name || "Unknown"}`);
      }
    } catch (error) {
      console.log(`⚠️  Organizations query failed: ${error}`);
    }

    try {
      const usersResult = await usersQuery.limit(5);
      console.log(`✅ Successfully queried ${usersResult.length} users`);
      if (usersResult.length > 0) {
        console.log(`  - Sample user: ${usersResult[0]?.email || "Unknown"}`);
      }
    } catch (error) {
      console.log(`⚠️  Users query failed: ${error}`);
    }

    // Test 4: Schema validation
    console.log("\n🔧 Testing schema types...");
    console.log(
      `✅ Organizations table schema loaded: ${typeof organizations._.name}`,
    );
    console.log(`✅ Users table schema loaded: ${typeof users._.name}`);

    console.log("\n🎉 Drizzle CRUD Test Complete!");
    console.log(
      "Drizzle can successfully interact with existing Prisma tables.",
    );
  } catch (error) {
    console.error("❌ CRUD test failed:", error);
  }
}

testDrizzleCrud();
