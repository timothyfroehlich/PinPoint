/**
 * Drops application tables in the local Supabase database.
 *
 * This script is used by `pnpm run db:reset` (and preflight) to ensure a clean
 * slate before reapplying the Drizzle schema. It intentionally leaves the
 * Supabase auth schema untouched.
 */

import postgres from "postgres";
import { assertLocalDatabase } from "./assert-local-db.mjs";

const databaseUrl =
  process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.error("❌ POSTGRES_URL or POSTGRES_URL_NON_POOLING is not defined");
  process.exit(1);
}

assertLocalDatabase(databaseUrl);

// Tables live in the public schema; order ensures dependent tables drop first.
const tables = [
  "issue_images",
  "issue_comments",
  "issue_watchers",
  "machine_watchers",
  "notifications",
  "notification_preferences",
  "issues",
  "machines",
  "user_profiles",
  "invited_users",
  "unconfirmed_users",
  "discord_integration_config",
];

// Trigger/helper functions in the public schema. CASCADE drops dependent
// triggers (e.g., handle_new_user's trigger on auth.users), so the auth
// schema itself stays untouched. Migrations recreate these.
const functions = [
  "public.handle_new_user()",
  "public.get_discord_config()",
];

const client = postgres(databaseUrl);

async function dropTables() {
  console.log("🧹 Dropping application tables (public schema)...");

  for (const table of tables) {
    // Use unsafe here only for static table names defined above
    await client.unsafe(`DROP TABLE IF EXISTS "${table}" CASCADE;`);
  }

  for (const fn of functions) {
    // Static function names defined above; CASCADE removes auth.users triggers
    // that reference handle_new_user without modifying the auth schema itself.
    await client.unsafe(`DROP FUNCTION IF EXISTS ${fn} CASCADE;`);
  }

  // Drop Drizzle migrations schema to force re-migration
  await client.unsafe(`DROP SCHEMA IF EXISTS drizzle CASCADE;`);

  console.log("✅ Tables and functions dropped.");
}

dropTables()
  .catch((error) => {
    console.error("❌ Failed to drop tables:", error);
    process.exit(1);
  })
  .finally(async () => {
    await client.end();
  });
