/**
 * Drops PinPoint-owned database objects in the local Supabase environment.
 *
 * This script is used by `pnpm run db:reset` (and preflight) to ensure a clean
 * slate before reapplying the Drizzle schema. It drops public-schema tables
 * and trigger-helper functions; the auth.users table and its data remain
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

// Tables live in the public schema; order ensures dependent tables drop first.
const tables = [
  "issue_images",
  "issue_comments",
  "issue_watchers",
  "machine_watchers",
  "notifications",
  "notification_preferences",
  "timeline_event_people",
  "timeline_events",
  "machine_settings_sets",
  "issues",
  "machines",
  "pinballmap_catalog",
  "user_profiles",
  "invited_users",
  "unconfirmed_users",
  "discord_integration_config",
];

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

  for (const table of tables) {
    // Use unsafe here only for static table names defined above
    await client.unsafe(`DROP TABLE IF EXISTS "${table}" CASCADE;`);
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
