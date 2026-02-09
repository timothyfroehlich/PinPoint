#!/usr/bin/env tsx
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

/**
 * One-time script to mark a migration as applied in the database
 * without actually running it. Use this when a migration was manually
 * applied before the auto-migration system was in place.
 *
 * Usage:
 *   POSTGRES_URL=<url> tsx scripts/mark-migration-applied.ts <migration-number>
 *
 * Example:
 *   POSTGRES_URL=postgres://... tsx scripts/mark-migration-applied.ts 0001
 */

const migrationNumber = process.argv[2];

if (!migrationNumber) {
  console.error(
    "❌ Usage: tsx scripts/mark-migration-applied.ts <migration-number>"
  );
  console.error("   Example: tsx scripts/mark-migration-applied.ts 0001");
  process.exit(1);
}

const connectionString =
  process.env["POSTGRES_URL_NON_POOLING"] ?? process.env["POSTGRES_URL"];

if (!connectionString) {
  console.error(
    "❌ No database connection string found (checked POSTGRES_URL_NON_POOLING, POSTGRES_URL)"
  );
  process.exit(1);
}

const sql = postgres(connectionString, { max: 1 });
// db not needed for this script, only sql client

async function main() {
  try {
    // Read the migration journal to get metadata
    const journalPath = join(process.cwd(), "drizzle", "meta", "_journal.json");
    const journal = JSON.parse(
      readFileSync(journalPath, "utf-8")
    ) as MigrationJournal;

    // Find the migration entry
    const migrationEntry = journal.entries.find((entry) =>
      entry.tag.startsWith(migrationNumber ?? "")
    );

    if (!migrationEntry) {
      console.error(`❌ Migration ${migrationNumber} not found in journal`);
      console.error("Available migrations:");
      journal.entries.forEach((entry) => {
        console.error(`  - ${entry.tag}`);
      });
      process.exit(1);
    }

    console.log(`🔍 Found migration: ${migrationEntry.tag}`);

    // Check if already marked as applied
    const existingMigrations = await sql`
      SELECT hash, created_at
      FROM drizzle.__drizzle_migrations
      WHERE hash = ${migrationEntry.tag}
    `;

    if (existingMigrations.length > 0) {
      console.log(
        `✅ Migration ${migrationEntry.tag} is already marked as applied`
      );
      const firstMigration = existingMigrations[0];
      if (firstMigration && "created_at" in firstMigration) {
        console.log(`   Applied at: ${firstMigration["created_at"]}`);
      }
      return;
    }

    // Mark migration as applied
    console.log(`📝 Marking migration ${migrationEntry.tag} as applied...`);

    // Drizzle uses bigint timestamps (milliseconds since epoch)
    const timestamp = Date.now();

    await sql`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES (${migrationEntry.tag}, ${timestamp})
    `;

    console.log(
      `✅ Successfully marked migration ${migrationEntry.tag} as applied`
    );
    console.log(
      `   This migration will now be skipped in future auto-migration runs`
    );
  } catch (error) {
    console.error("❌ Failed to mark migration as applied:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

void main();
