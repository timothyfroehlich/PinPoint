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

// Two merges close together start two production builds, and drizzle's migrator
// takes no lock of its own: both would read the same "newest applied" row and
// both would run the pending migrations. A session-level advisory lock on the
// one connection serializes them; the second build waits, then finds nothing
// pending. The session pooler (:5432) gives this client its own backend for the
// whole session, so a session lock holds.
//
// The lock is released explicitly in main()'s `finally`: a pooler can hand the
// backend to another client without resetting it, so closing the connection is
// not a guarantee. The wait is bounded, so a stranded lock fails this build with
// the holder's pid instead of waiting until Vercel's build timeout.
const MIGRATION_LOCK_KEY = "pinpoint.migrate-production";
const LOCK_WAIT_MS = 10 * 60 * 1000;
const LOCK_POLL_MS = 5000;

async function tryMigrationLock(): Promise<boolean> {
  const [row] = await sql<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(hashtext(${MIGRATION_LOCK_KEY})) AS locked
  `;
  return row?.locked === true;
}

async function describeLockHolder(): Promise<string> {
  // A one-key advisory lock stores the key's low 32 bits in objid.
  const rows = await sql<{ pid: number; backend_start: string | null }[]>`
    SELECT l.pid, a.backend_start::text AS backend_start
    FROM pg_locks l
    LEFT JOIN pg_stat_activity a USING (pid)
    WHERE l.locktype = 'advisory' AND l.granted AND l.objsubid = 1
      AND l.objid::bigint = (hashtext(${MIGRATION_LOCK_KEY})::bigint & 4294967295)
  `;
  const [holder] = rows;
  if (!holder) return "holder not visible";
  const since = holder.backend_start
    ? `, connected since ${holder.backend_start}`
    : "";
  return `held by backend pid ${holder.pid}${since}`;
}

async function acquireMigrationLock(): Promise<void> {
  if (await tryMigrationLock()) return;
  console.log(
    `⏳ Another deploy is migrating (${await describeLockHolder()}); waiting up to ${LOCK_WAIT_MS / 60000} minutes...`
  );
  const deadline = Date.now() + LOCK_WAIT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, LOCK_POLL_MS));
    if (await tryMigrationLock()) return;
  }
  throw new Error(
    `Timed out waiting for the migration lock (${await describeLockHolder()}). ` +
      "If no deploy is running, the lock is stranded: end that backend with pg_terminate_backend(<pid>) and redeploy."
  );
}

async function releaseMigrationLock(): Promise<void> {
  try {
    // unlock_all, not a single unlock: advisory locks count per session, so a
    // reused backend that already held this lock would otherwise keep one hold.
    await sql`SELECT pg_advisory_unlock_all()`;
  } catch {
    // The connection is going away; closing it below is the fallback.
  }
}

async function main() {
  console.log("🔄 Running production migrations...");

  let locked = false;
  try {
    await acquireMigrationLock();
    locked = true;

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
          "   2. Run: MARK_MIGRATION_FORCE_PRODUCTION=1 POSTGRES_URL=<url> \\"
        );
        console.error("        tsx scripts/mark-migration-applied.ts <number>");
        console.error(
          "      (the token is required against a remote DB — the script refuses"
        );
        console.error("       without it, and prompts once when run in a TTY)");
        console.error("   3. Redeploy to retry migrations");
      }
    } else {
      console.error(error);
    }

    // Not process.exit(): the `finally` below must run to release the lock.
    process.exitCode = 1;
  } finally {
    if (locked) await releaseMigrationLock();
    await sql.end();
  }
}

void main();
