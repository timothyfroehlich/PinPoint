import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { execSync } from "child_process";
import { assertLocalDatabase } from "./assert-local-db.mjs";

const databaseUrl =
  process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.error("❌ POSTGRES_URL or POSTGRES_URL_NON_POOLING is not defined");
  process.exit(1);
}

assertLocalDatabase(databaseUrl);

async function fastReset() {
  console.log("🚀 Starting Fast DB Reset...");

  const client = postgres(databaseUrl);
  const db = drizzle(client);

  try {
    console.log("🧹 Truncating tables...");
    // Truncate all tables except migrations/schema-related if any
    // We cascade to handle foreign keys
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
    console.log("✅ Tables truncated.");

    // Reseed
    console.log("🌱 Reseding data...");
    const seedCommands = [
      "pnpm run db:_seed",
      "pnpm run db:_seed-users",
      "pnpm run db:_seed-discord",
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
