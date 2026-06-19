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
// On-demand preview branches are created, migrated, and seeded by the
// "Preview Controller" GHA workflow (.github/workflows/preview-control.yaml)
// in response to a `/preview` PR comment. The branch DB user lacks CREATE
// SCHEMA privileges, so attempting `CREATE SCHEMA IF NOT EXISTS "drizzle"`
// here would fail — but it's unnecessary, because the controller already ran
// drizzle-kit migrate on the branch DB before triggering the preview build.
if (process.env["VERCEL_ENV"] === "preview") {
  console.log(
    "⏭️  Skipping migrations on Vercel preview (handled by GHA Preview Controller)"
  );
  process.exit(0);
}

// Resolve the migration endpoint. DDL must go over a connection that is (a)
// reachable from the IPv4-only Vercel build runner and (b) able to run the
// migrator's transactions.
//
// In production the Supabase↔Vercel integration injects POSTGRES_URL_NON_POOLING
// as the IPv4 SESSION pooler (`…pooler.supabase.com:5432`) — verified: prod's
// DIRECT host (`db.<ref>.supabase.co:5432`) is IPv6-only (no IPv4 add-on) and so
// is unreachable from Vercel, yet prod migrations connect cleanly, which is only
// possible over the IPv4 session pooler. We therefore REQUIRE NON_POOLING in
// production and refuse to silently fall back to POSTGRES_URL, the `:6543`
// TRANSACTION pooler: it does not support prepared statements (the PP-d8l8
// hazard class) and is the wrong endpoint for DDL. See AGENTS.md §7.
const isVercelProduction = process.env["VERCEL_ENV"] === "production";
const nonPooling = process.env["POSTGRES_URL_NON_POOLING"];

if (isVercelProduction && !nonPooling) {
  console.error(
    "❌ POSTGRES_URL_NON_POOLING is required in production but is unset.\n" +
      "   Refusing to fall back to the :6543 transaction pooler (POSTGRES_URL) for DDL."
  );
  process.exit(1);
}

// Outside Vercel production (local / other), POSTGRES_URL is the local stack —
// fall back to it so `pnpm run migrate:production` works locally.
const connectionString = nonPooling ?? process.env["POSTGRES_URL"];

if (!connectionString) {
  console.error(
    "❌ No database connection string found (checked POSTGRES_URL_NON_POOLING, POSTGRES_URL)"
  );
  process.exit(1);
}

// `prepare: false`: the session pooler (:5432) supports prepared statements, but
// disabling them is harmless for one-shot DDL and is REQUIRED if this ever
// connects over the `:6543` transaction pooler. Mirrors src/server/db/index.ts
// and scripts/lib/pg-client.mjs (the canonical PP-d8l8 setting). `max: 1` keeps
// the migrator on a single connection so its transactions stay coherent.
const sql = postgres(connectionString, { max: 1, prepare: false });
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
    let appliedMigrations: Record<string, unknown>[] = [];
    try {
      appliedMigrations = await sql`
        SELECT hash, created_at
        FROM drizzle.__drizzle_migrations
        ORDER BY created_at ASC
      `;
    } catch {
      // Fresh database - drizzle schema doesn't exist yet
      console.log("\n📦 Fresh database detected (no migration history found)");
    }

    if (appliedMigrations.length > 0) {
      console.log(
        `\n✓ ${appliedMigrations.length} migration(s) already applied:`
      );
      appliedMigrations.forEach((migration) => {
        const typedMigration = migration;
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
