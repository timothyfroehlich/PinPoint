/**
 * Drops PinPoint-owned database objects in the local Supabase environment.
 *
 * This script is used by `pnpm run db:reset` (and preflight) to ensure a clean
 * slate before reapplying the Drizzle schema. It drops every public-schema
 * table (discovered dynamically from pg_tables) plus PinPoint's trigger-helper
 * functions; the auth.users table and its data remain
 * intact. (CASCADE on `handle_new_user` does remove our trigger attached to
 * auth.users — that trigger is PinPoint's, not Supabase's.)
 */

import {
  createScriptClient,
  resolveScriptDatabaseUrl,
} from "./lib/pg-client.mjs";
import { assertLocalDatabase } from "./assert-local-db.mjs";

const databaseUrl = resolveScriptDatabaseUrl();
assertLocalDatabase(databaseUrl);

// Trigger/helper functions PinPoint creates in the public schema. CASCADE
// removes dependent triggers — including handle_new_user's trigger on
// auth.users, which is ours, not Supabase's. Migrations recreate these.
const functions = [
  "public.handle_new_user()",
  "public.get_discord_config()",
];

const client = createScriptClient(databaseUrl);

async function dropApplicationObjects() {
  console.log("🧹 Dropping application tables and functions (public schema)...");

  // Discover every table in the public schema dynamically instead of tracking a
  // hardcoded list. A static list silently rots: a newly-added table that isn't
  // on the list survives the drop, then the next fresh migration collides with
  // it and fails with 42P07 (duplicate_table). (PP-wv4p.)
  //
  // Strictly scoped to schemaname = 'public' — Supabase-managed schemas (auth,
  // storage, realtime, extensions, …) are never touched. CASCADE handles
  // inter-table dependencies, so drop order does not matter.
  const publicTables = await client`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  `;

  for (const { tablename } of publicTables) {
    // tablename comes from pg_catalog (our own tables); quote it defensively so
    // any identifier that needs escaping is handled correctly.
    const quoted = `"${String(tablename).replace(/"/g, '""')}"`;
    await client.unsafe(`DROP TABLE IF EXISTS public.${quoted} CASCADE;`);
  }

  for (const fn of functions) {
    // Static function names defined above. CASCADE also drops the trigger
    // PinPoint attached to auth.users (the auth.users table itself stays).
    await client.unsafe(`DROP FUNCTION IF EXISTS ${fn} CASCADE;`);
  }

  // Drop Drizzle migrations schema to force re-migration
  await client.unsafe(`DROP SCHEMA IF EXISTS drizzle CASCADE;`);

  console.log("✅ Application objects dropped.");
}

dropApplicationObjects()
  .catch((error) => {
    console.error("❌ Failed to drop application objects:", error);
    process.exit(1);
  })
  .finally(async () => {
    await client.end();
  });
