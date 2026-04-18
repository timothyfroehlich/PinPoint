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
];

const client = postgres(databaseUrl);

async function dropTables() {
  console.log("🧹 Dropping application tables (public schema)...");

  for (const table of tables) {
    // Use unsafe here only for static table names defined above
    await client.unsafe(`DROP TABLE IF EXISTS "${table}" CASCADE;`);
  }

  // Drop Drizzle migrations schema to force re-migration
  await client.unsafe(`DROP SCHEMA IF EXISTS drizzle CASCADE;`);

  console.log("✅ Tables dropped.");
}

dropTables()
  .catch((error) => {
    console.error("❌ Failed to drop tables:", error);
    process.exit(1);
  })
  .finally(async () => {
    await client.end();
  });
