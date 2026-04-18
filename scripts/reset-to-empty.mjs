/**
 * Truncate application data tables without re-seeding.
 *
 * Used when a reviewer wants to eyeball empty-state UIs in the dev server.
 * Keeps the schema and Supabase auth users in place; callers typically follow
 * up with `pnpm run db:_seed-users` if they need a test account.
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

const client = postgres(databaseUrl);

async function resetToEmpty() {
  console.log("🧹 Truncating application tables (no reseed)...");

  await client`
    TRUNCATE TABLE
      "issue_images",
      "issue_comments",
      "issue_watchers",
      "issues",
      "machines",
      "notifications",
      "notification_preferences",
      "user_profiles"
    CASCADE;
  `;

  console.log("✅ Tables truncated. App is now empty; auth users untouched.");
}

resetToEmpty()
  .catch((error) => {
    console.error("❌ Reset-to-empty failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await client.end();
  });
