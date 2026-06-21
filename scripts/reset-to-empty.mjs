/**
 * Truncate application content tables without re-seeding.
 *
 * Used when a reviewer wants to eyeball empty-state UIs in the dev server.
 * Leaves schema, Supabase auth users, AND user_profiles intact so test
 * accounts stay usable and no follow-up seed step is required. Running
 * supabase/seed-users.mjs afterwards would re-populate fixture data —
 * that script seeds users plus machines, despite its name.
 */

import {
  createScriptClient,
  resolveScriptDatabaseUrl,
} from "./lib/pg-client.mjs";
import { assertLocalDatabase } from "./assert-local-db.mjs";

const databaseUrl = resolveScriptDatabaseUrl();
assertLocalDatabase(databaseUrl);

const client = createScriptClient(databaseUrl);

async function resetToEmpty() {
  console.log("🧹 Truncating content tables (users preserved, no reseed)...");

  await client`
    TRUNCATE TABLE
      "issue_images",
      "issue_comments",
      "issue_watchers",
      "issues",
      "machines",
      "notifications",
      "notification_preferences"
    CASCADE;
  `;

  console.log(
    "✅ Tables truncated. App content empty; auth users + user_profiles untouched."
  );
}

resetToEmpty()
  .catch((error) => {
    console.error("❌ Reset-to-empty failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await client.end();
  });
