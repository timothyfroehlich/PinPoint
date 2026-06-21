import { execSync } from "child_process";
import {
  createScriptClient,
  resolveScriptDatabaseUrl,
} from "./lib/pg-client.mjs";
import { assertLocalDatabase } from "./assert-local-db.mjs";

const databaseUrl = resolveScriptDatabaseUrl();
assertLocalDatabase(databaseUrl);

async function fastReset() {
  console.log("🚀 Starting Fast DB Reset...");

  const client = createScriptClient(databaseUrl);

  try {
    console.log("🧹 Truncating tables...");
    // Truncate all application tables except migrations/schema-related if any.
    // We cascade to handle foreign keys.
    //
    // NOTE: auth.users is intentionally NOT truncated here. supabase/seed-users.mjs
    // uses supabase.auth.admin.createUser with an "already exists" fallback that
    // fetches the existing ID and upserts the public.user_profiles row, so the seed
    // is idempotent even when auth.users retains rows from a prior run. Truncating
    // auth.users would require Supabase Admin API access (the Postgres user cannot
    // directly DELETE from auth.users in production configurations) and would break
    // any active sessions. (PP-3vdr.6)
    await client`
      TRUNCATE TABLE
        "issue_images",
        "issue_comments",
        "issue_watchers",
        "issues",
        "timeline_events",
        "machines",
        "notifications",
        "notification_preferences",
        "user_profiles"
      CASCADE;
    `;
    console.log("✅ Tables truncated.");

    // Reseed
    console.log("🌱 Reseeding data...");
    const seedCommands = [
      "pnpm run db:_seed",
      "pnpm run db:_seed-users",
      "pnpm run db:_seed-discord",
      "pnpm run db:_seed-timeline-backfill",
      "pnpm run db:_seed-timeline-demo",
    ];
    for (const cmd of seedCommands) {
      execSync(cmd, { stdio: "inherit" });
    }
    console.log("✅ Database reseeded.");
  } catch (error) {
    console.error("❌ Fast reset failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

fastReset();
