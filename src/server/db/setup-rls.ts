#!/usr/bin/env tsx
/**
 * PinPoint RLS Setup Script
 *
 * Executes comprehensive Row Level Security setup for multi-tenant architecture.
 *
 * Features:
 * - Organization-level isolation for all multi-tenant tables
 * - Automatic organizationId injection via triggers
 * - Complex inheritance patterns for collections
 * - Performance-optimized indexes for RLS queries
 *
 * Usage:
 *   npm run db:setup-rls
 *   tsx scripts/setup-rls.ts
 *
 * Integration:
 *   Part of enhanced database reset workflow (npm run db:reset:local:sb)
 */

import dotenv from "dotenv";
import { env } from "~/env.js";

// Load environment variables in correct precedence order
try {
  dotenv.config(); // Load default .env
  dotenv.config({ path: ".env.local" }); // Override with local development vars
} catch {
  // If dotenv loading fails, continue - might be in production
}
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import postgres from "postgres";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Database connection configuration
 */
function createDatabaseConnection(): postgres.Sql {
  const databaseUrl = env.DATABASE_URL ?? env.SUPABASE_DB_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL or SUPABASE_DB_URL environment variable is required. " +
        "Make sure your .env file is properly configured.",
    );
  }

  return postgres(databaseUrl, {
    // Connection settings optimized for setup scripts
    max: 1,
    idle_timeout: 20,
    connect_timeout: 60,
  });
}

/**
 * Execute RLS setup with comprehensive error handling
 */
async function setupRLS(): Promise<void> {
  const sql = createDatabaseConnection();

  try {
    console.log("🔒 Setting up Row Level Security policies...");
    console.log("📍 Reading setup-rls.sql from scripts directory");

    // Read the SQL setup file based on environment
    // CI: Plain PostgreSQL (minimal RLS)
    // Local: Supabase container (full RLS with local-compatible auth)
    // Production: Hosted Supabase (full RLS with auth.jwt())
    const sqlFile =
      env.CI === "true"
        ? "setup-rls-local.sql" // CI: Plain PostgreSQL
        : env.NODE_ENV === "production"
          ? "setup-rls.sql" // Production: Hosted Supabase
          : "setup-rls-local-supabase.sql"; // Local dev: Supabase container

    let rlsSQL: string;
    try {
      const resolvedPath = join(__dirname, sqlFile);
      rlsSQL = readFileSync(resolvedPath, "utf-8");
    } catch (error) {
      const resolvedPath = join(__dirname, sqlFile);
      throw new Error(
        `Failed to read SQL file '${sqlFile}' at path '${resolvedPath}'. ` +
          `Expected environment: ${env.CI === "true" ? "CI" : env.NODE_ENV === "production" ? "production" : "local development"}. ` +
          `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    console.log("📊 Executing RLS setup (this may take 30-60 seconds)...");

    // Execute the complete RLS setup
    await sql.unsafe(rlsSQL);

    // Verify setup completion
    console.log("🔍 Verifying RLS setup...");

    const result1 = await sql`
      SELECT COUNT(*) as count
      FROM pg_tables t
      JOIN pg_class c ON c.relname = t.tablename
      WHERE t.schemaname = 'public'
      AND c.relrowsecurity = true
    `;
    const tablesWithRLS =
      (result1[0] as { count: number } | undefined)?.count ?? 0;

    const result2 = await sql`
      SELECT COUNT(*) as count
      FROM pg_policies
      WHERE schemaname = 'public'
    `;
    const totalPolicies =
      (result2[0] as { count: number } | undefined)?.count ?? 0;

    const result3 = await sql`
      SELECT COUNT(*) as count
      FROM pg_trigger
      WHERE tgname LIKE 'set_%_organization_id'
    `;
    const orgTriggers =
      (result3[0] as { count: number } | undefined)?.count ?? 0;

    console.log("✅ RLS setup completed successfully!");
    console.log(`📋 Summary:`);
    console.log(`   - Tables with RLS enabled: ${String(tablesWithRLS)}`);
    console.log(`   - RLS policies created: ${String(totalPolicies)}`);
    console.log(`   - Organization injection triggers: ${String(orgTriggers)}`);
    console.log("");
    console.log("🎯 Next steps:");
    console.log("   - Run database migration: npx drizzle-kit pull");
    console.log("   - Update schema files with .enableRLS() metadata");
    console.log(
      "   - Begin tRPC router conversion to remove manual org filtering",
    );
  } catch (error) {
    console.error("❌ Failed to setup RLS policies:");

    if (error instanceof Error) {
      // PostgreSQL errors often have detailed position information
      if ("position" in error && error.position) {
        const position =
          typeof error.position === "number"
            ? error.position.toString()
            : "[object Object]";
        console.error(`   SQL Error at position ${position}:`);
      }

      console.error(`   Error: ${error.message}`);

      // Additional context for common error scenarios
      if (error.message.includes("permission denied")) {
        console.error("");
        console.error("💡 Troubleshooting:");
        console.error(
          "   - Ensure your database user has sufficient privileges",
        );
        console.error(
          "   - Check if you are connected to the correct database",
        );
        console.error(
          "   - Verify Supabase project permissions if using hosted database",
        );
      }

      if (
        error.message.includes("relation") &&
        error.message.includes("does not exist")
      ) {
        console.error("");
        console.error("💡 Troubleshooting:");
        console.error(
          "   - Run database migration first: npm run db:push:local",
        );
        console.error("   - Ensure all schema files are up to date");
        console.error(
          "   - Check if database was reset without schema migration",
        );
      }

      if (error.message.includes("authentication failed")) {
        console.error("");
        console.error("💡 Troubleshooting:");
        console.error("   - Check DATABASE_URL in your .env file");
        console.error("   - Verify database credentials");
        console.error(
          "   - Ensure local Supabase is running if using local development",
        );
      }
    } else {
      console.error("   Unknown error occurred:", error);
    }

    process.exit(1);
  } finally {
    // Always close the database connection
    await sql.end();
  }
}

/**
 * Script entry point with graceful error handling
 */
async function main(): Promise<void> {
  try {
    await setupRLS();
  } catch (error) {
    console.error("❌ Script execution failed:", error);
    process.exit(1);
  }
}

// Execute if this file is run directly
if (import.meta.url === `file://${process.argv[1] ?? ""}`) {
  void main();
}

export { setupRLS };
