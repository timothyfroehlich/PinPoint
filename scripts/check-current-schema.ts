#!/usr/bin/env tsx

/**
 * Check current database schema to understand conflicts
 */

import { config } from "dotenv";
import { sql } from "drizzle-orm";

// Load environment variables first
config();

async function checkCurrentSchema() {
  console.log("🔍 Checking Current Database Schema...\n");

  try {
    const { createDrizzleClient } = await import("~/server/db/drizzle");
    const drizzle = createDrizzleClient();

    // Check existing enums
    console.log("📋 Checking existing enums...");
    const enumsResult = await drizzle.execute(sql`
      SELECT enumtypid, typname, enumlabel
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE typname IN ('NotificationFrequency', 'StatusCategory', 'ActivityType', 'NotificationType', 'NotificationEntity')
      ORDER BY typname, enumsortorder;
    `);

    console.log("Existing enums:");
    for (const row of enumsResult as any) {
      console.log(`  - ${row.typname}: ${row.enumlabel}`);
    }

    // Check existing tables
    console.log("\n📋 Checking existing tables...");
    const tablesResult = await drizzle.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log("Existing tables:");
    for (const row of tablesResult as any) {
      console.log(`  - ${row.table_name}`);
    }

    // Check if Drizzle tables would conflict
    const drizzleTables = [
      "Account",
      "Session",
      "User",
      "VerificationToken",
      "Organization",
      "Membership",
      "Role",
      "Permission",
      "_RolePermissions",
      "Location",
      "Model",
      "Machine",
      "Issue",
      "Priority",
      "IssueStatus",
      "Comment",
      "Attachment",
      "IssueHistory",
      "Upvote",
      "Collection",
      "CollectionType",
      "Notification",
      "PinballMapConfig",
    ];

    console.log("\n⚠️  Potential conflicts:");
    const existingTableNames = (tablesResult as any).map(
      (row: any) => row.table_name,
    );
    const conflicts = drizzleTables.filter((table) =>
      existingTableNames.includes(table),
    );

    if (conflicts.length > 0) {
      console.log("Tables that already exist:");
      conflicts.forEach((table) => console.log(`  - ${table}`));
    } else {
      console.log("No table conflicts found - safe to proceed");
    }

    const newTables = drizzleTables.filter(
      (table) => !existingTableNames.includes(table),
    );
    console.log("\nNew tables to be created:");
    newTables.forEach((table) => console.log(`  - ${table}`));
  } catch (error) {
    console.error("❌ Schema check failed:", error);
  }
}

checkCurrentSchema();
