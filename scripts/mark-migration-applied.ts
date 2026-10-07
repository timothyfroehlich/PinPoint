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
import { entryHiddenByMarking, migrationRecord } from "./lib/migration-record";

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
 * Usage (production — the documented stuck-migration recovery path, AGENTS.md
 * §7). This script stays prod-capable on purpose, so it takes an explicit
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
// Mirrors scripts/migrate-production.ts. See AGENTS.md §7.
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
      `   This IS the documented stuck-migration recovery path (AGENTS.md §7).\n` +
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

    const record = migrationRecord(
      join(process.cwd(), "drizzle"),
      journal.entries.indexOf(migrationEntry)
    );

    // Check if already marked as applied: drizzle's rows carry the journal
    // `when`; older runs of this script stored the tag as the hash. Matching on
    // the content hash would confuse two migrations with identical files.
    const existingMigrations = await sql<{ created_at: string }[]>`
      SELECT hash, created_at
      FROM drizzle.__drizzle_migrations
      WHERE created_at = ${record.createdAt} OR hash = ${migrationEntry.tag}
    `;

    if (existingMigrations.length > 0) {
      console.log(
        `✅ Migration ${migrationEntry.tag} is already marked as applied`
      );
      const legacy = existingMigrations.find(
        (row) => Number(row.created_at) !== record.createdAt
      );
      if (legacy) {
        console.warn(
          `⚠️  A row for it was written by an older version of this script (created_at ${legacy.created_at}, journal when ${record.createdAt}).\n` +
            "   drizzle's migrator skips any pending migration whose `when` is older than the newest created_at."
        );
      }
      return;
    }

    // drizzle's migrator applies only journal entries newer than the newest
    // recorded created_at, so the row this script writes decides what runs next.
    const [newest] = await sql<{ created_at: string | null }[]>`
      SELECT max(created_at)::text AS created_at FROM drizzle.__drizzle_migrations
    `;
    const newestApplied = Number(newest?.created_at ?? 0);
    const hidden = entryHiddenByMarking(
      journal.entries,
      migrationEntry,
      newestApplied
    );
    if (hidden) {
      console.error(
        `❌ ${hidden.tag} (and possibly others) is not recorded as applied and has an older journal \`when\`.\n` +
          `   Marking ${migrationEntry.tag} would make drizzle's migrator skip them. Apply or mark them first.`
      );
      process.exitCode = 1;
      return;
    }
    if (newestApplied > record.createdAt) {
      console.warn(
        `⚠️  A recorded migration is newer than ${migrationEntry.tag} (created_at ${newestApplied}).\n` +
          `   drizzle's migrator would skip ${migrationEntry.tag} anyway; marking it changes nothing about what runs next.`
      );
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

    await sql`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES (${record.hash}, ${record.createdAt})
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
