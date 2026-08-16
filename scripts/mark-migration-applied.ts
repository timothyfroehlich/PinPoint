#!/usr/bin/env tsx
import postgres from "postgres";
import { createInterface } from "node:readline/promises";
import { readFileSync } from "fs";
import { join } from "path";

import {
  describeTarget,
  isCloudDatabaseUrl,
  isForceProductionEnabled,
} from "./lib/db-target.mjs";

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
 * Usage (local):
 *   POSTGRES_URL=<url> tsx scripts/mark-migration-applied.ts <migration-number>
 *
 * Usage (production — the documented stuck-migration recovery path,
 * AGENTS.md "Deployment"). This script stays prod-capable on purpose, so it takes an explicit
 * opt-in token rather than a hard refusal:
 *   MARK_MIGRATION_FORCE_PRODUCTION=1 POSTGRES_URL=<prod_url> \
 *     tsx scripts/mark-migration-applied.ts <migration-number>
 *
 * Why the gate exists: this INSERTs straight into drizzle.__drizzle_migrations.
 * Marking the WRONG number makes drizzle believe a migration ran when it did
 * not, so the next `migrate:production` silently skips it and prod's schema
 * diverges from the migration history permanently. That is slow-burn
 * corruption — nightly backups do not catch it, because nothing looks broken
 * until a later migration fails on a missing column.
 */

const migrationNumber = process.argv[2];

if (!migrationNumber) {
  console.error(
    "❌ Usage: tsx scripts/mark-migration-applied.ts <migration-number>"
  );
  console.error("   Example: tsx scripts/mark-migration-applied.ts 0001");
  process.exit(1);
}

// Resolve the connection endpoint. This script writes to
// drizzle.__drizzle_migrations, so it must connect the way the migrator does:
// prefer POSTGRES_URL_NON_POOLING (the IPv4 SESSION pooler, :5432) and, in
// production, REFUSE to silently fall back to POSTGRES_URL (the :6543
// TRANSACTION pooler) — it does not support prepared statements (the PP-d8l8
// silent-COMMIT-loss hazard) and is the wrong endpoint for a migration write.
// Mirrors scripts/migrate-production.ts. See AGENTS.md "Deployment".
const isVercelProduction = process.env["VERCEL_ENV"] === "production";
const nonPooling = process.env["POSTGRES_URL_NON_POOLING"];

if (isVercelProduction && !nonPooling) {
  console.error(
    "❌ POSTGRES_URL_NON_POOLING is required in production but is unset.\n" +
      "   Refusing to fall back to the :6543 transaction pooler (POSTGRES_URL)."
  );
  process.exit(1);
}

// Outside Vercel production (local / ad-hoc), POSTGRES_URL is a fine fallback.
const connectionString = nonPooling ?? process.env["POSTGRES_URL"];

if (!connectionString) {
  console.error(
    "❌ No database connection string found (checked POSTGRES_URL_NON_POOLING, POSTGRES_URL)"
  );
  process.exit(1);
}

// Production gate. Mirrors drizzle.config.ts's DRIZZLE_FORCE_PRODUCTION idiom
// (same host match, same "set the token to mean it" shape) so there is one
// convention here, not two. Runs BEFORE the client is constructed so a refusal
// never opens a connection to prod. Not reachable from `vercel-build`, which
// runs `migrate:production` only.
const isProductionTarget = isCloudDatabaseUrl(connectionString);
const forceProduction = isForceProductionEnabled(
  process.env["MARK_MIGRATION_FORCE_PRODUCTION"]
);

if (isProductionTarget && !forceProduction) {
  console.error(
    `❌ Refusing to write to drizzle.__drizzle_migrations on a remote database.\n` +
      `   Target: ${describeTarget(connectionString)}\n` +
      `   Migration: ${migrationNumber}\n\n` +
      `   Marking a migration applied without running it makes future\n` +
      `   \`migrate:production\` runs SKIP it — prod's schema then diverges from\n` +
      `   the migration history permanently, and nightly backups do not catch it.\n\n` +
      `   This IS the documented stuck-migration recovery path (AGENTS.md "Deployment").\n` +
      `   To proceed intentionally, re-run with:\n` +
      `     MARK_MIGRATION_FORCE_PRODUCTION=1 POSTGRES_URL=<url> tsx scripts/mark-migration-applied.ts ${migrationNumber}`
  );
  process.exit(1);
}

/**
 * Last-chance interactive confirm, shown only when a human is actually at the
 * terminal. Non-TTY callers (CI, `| tee`, a wrapper script) never reach the
 * prompt — the env token above is their whole gate — so this can never hang a
 * pipeline.
 */
async function confirmProductionWrite(tag: string): Promise<boolean> {
  if (!process.stdin.isTTY) return true;

  console.log(`\n⚠️  About to mark a migration applied on a REMOTE database.`);
  console.log(`   Target:    ${describeTarget(connectionString ?? "")}`);
  console.log(`   Migration: ${tag}`);
  console.log(
    `   This records the migration as done WITHOUT running its SQL.\n`
  );

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question("   Continue? (y/N) ");
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

// `prepare: false`: REQUIRED if this ever connects over the `:6543` transaction
// pooler (which rejects prepared statements — the PP-d8l8 hazard) and harmless
// on the session pooler. Mirrors scripts/migrate-production.ts and
// scripts/lib/pg-client.mjs (the canonical PP-d8l8 setting).
const sql = postgres(connectionString, { max: 1, prepare: false });
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

    if (
      isProductionTarget &&
      !(await confirmProductionWrite(migrationEntry.tag))
    ) {
      console.log("🚫 Aborted — nothing was written.");
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
