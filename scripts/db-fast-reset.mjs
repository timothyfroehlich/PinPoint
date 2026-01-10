import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { execSync } from "child_process";

const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("❌ DATABASE_URL or DIRECT_URL is not defined");
  process.exit(1);
}

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
        "issue_comments",
        "issue_watchers",
        "issues",
        "machines",
        "notifications",
        "notification_preferences",
        "user_profiles",
        "auth"."users"
      CASCADE;
    `;
    console.log("✅ Tables truncated.");

    // Reseed
    console.log("🌱 Reseding data...");
    // We execute the seed command
    // pnpm run db:_seed
    execSync("pnpm run db:_seed", { stdio: "inherit" });
    execSync("pnpm run db:_seed-users", { stdio: "inherit" });
    console.log("✅ Database reseeded.");
  } catch (error) {
    console.error("❌ Fast reset failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

fastReset();
