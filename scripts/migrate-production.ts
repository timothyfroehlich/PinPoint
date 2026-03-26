#!/usr/bin/env tsx
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { readFileSync } from "fs";
import { join } from "path";

interface MigrationEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface MigrationJournal {
  version: string;
  dialect: string;
  entries: MigrationEntry[];
}

// Skip migrations on Vercel preview deployments.
// The Supabase integration triggers a redeployment with preview branch DB
// credentials, but that DB user lacks CREATE SCHEMA privileges, causing
// `CREATE SCHEMA IF NOT EXISTS "drizzle"` to fail. This is harmless because
// the GHA "Supabase Branch Setup" workflow already runs drizzle-kit migrate
// on the branch DB before the preview deployment needs it.
if (process.env["VERCEL_ENV"] === "preview") {
  console.log(
    "⏭️  Skipping migrations on Vercel preview (handled by GHA Supabase Branch Setup)"
  );
  process.exit(0);
}

// Prefer non-pooled connections for DDL
const connectionString =
  process.env["POSTGRES_URL_NON_POOLING"] ?? process.env["POSTGRES_URL"];

if (!connectionString) {
  console.error(
    "❌ No database connection string found (checked POSTGRES_URL_NON_POOLING, POSTGRES_URL)"
  );
  process.exit(1);
}

// Connection for migration must not use connection pooling if possible,
// but Supabase transaction poolers (port 6543) don't support prepared statements anyway.
// Ideally use the direct connection (port 5432).
const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql);

async function main() {
  console.log("🔄 Running production migrations...");

  try {
    // Read migration journal to show what migrations exist
    const journalPath = join(process.cwd(), "drizzle", "meta", "_journal.json");
    const journal = JSON.parse(
      readFileSync(journalPath, "utf-8")
    ) as MigrationJournal;

    console.log(`📋 Found ${journal.entries.length} migration(s) in journal:`);
    journal.entries.forEach((entry) => {
      console.log(`   ${entry.idx}: ${entry.tag}`);
    });

    // Check current migration state
    let appliedMigrations: unknown[] = [];
    try {
      appliedMigrations = (await sql`
        SELECT hash, created_at
        FROM drizzle.__drizzle_migrations
        ORDER BY created_at ASC
      `) as unknown as unknown[];
    } catch {
      // Fresh database - drizzle schema doesn't exist yet
      console.log("\n📦 Fresh database detected (no migration history found)");
    }

    if (appliedMigrations.length > 0) {
      console.log(
        `\n✓ ${appliedMigrations.length} migration(s) already applied:`
      );
      appliedMigrations.forEach((migration) => {
        const typedMigration = migration as Record<string, unknown>;
        if ("hash" in typedMigration && "created_at" in typedMigration) {
          console.log(
            `   - ${String(typedMigration["hash"])} (applied: ${String(typedMigration["created_at"])})`
          );
        }
      });
    }

    const pendingCount = journal.entries.length - appliedMigrations.length;
    if (pendingCount > 0) {
      console.log(`\n⏳ ${pendingCount} pending migration(s) to apply...`);
    } else {
      console.log("\n✅ All migrations already applied, nothing to do");
    }

    // Run migrations
    await migrate(db, { migrationsFolder: "./drizzle" });

    if (pendingCount > 0) {
      console.log("✅ Migrations completed successfully");
    }
  } catch (error) {
    console.error("\n❌ Migration failed:");

    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`);

      // Check if this is a "relation does not exist" error
      if (error.message.includes("does not exist")) {
        console.error("\n💡 Recovery Instructions:");
        console.error(
          "   This error usually means a migration was manually applied"
        );
        console.error("   but not tracked in the migrations table.");
        console.error("\n   To fix:");
        console.error(
          "   1. Identify which migration failed (check error above)"
        );
        console.error(
          "   2. Run: POSTGRES_URL=<url> tsx scripts/mark-migration-applied.ts <number>"
        );
        console.error("   3. Redeploy to retry migrations");
        console.error(
          "\n   Example: tsx scripts/mark-migration-applied.ts 0001"
        );
      }
    } else {
      console.error(error);
    }

    process.exit(1);
  } finally {
    await sql.end();
  }
}

void main();
