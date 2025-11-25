import { execSync } from "child_process";

/**
 * Playwright Global Setup
 *
 * Runs once before all tests to ensure clean database state.
 * This prevents test data contamination between test runs.
 */
export default async function globalSetup(): Promise<void> {
  console.log("🔄 Resetting database to clean state...");

  // Satisfy @typescript-eslint/require-await
  await Promise.resolve();

  // Note: .env.local is now loaded in playwright.config.ts before this runs
  // All environment variables are already available in process.env

  try {
    // Step 1: Reset Supabase database - clears everything
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error("DATABASE_URL environment variable is not set");
    }

    execSync(`supabase db reset --db-url "${dbUrl}" --yes`, {
      stdio: "inherit",
      env: process.env,
    });
    console.log("✅ Database reset complete");

    // Step 2: Push Drizzle schema - creates tables
    // Note: This project doesn't use migration files, schema is managed by Drizzle
    console.log("📋 Pushing Drizzle schema...");
    execSync("npm run db:push", {
      stdio: "inherit",
      env: process.env,
    });
    console.log("✅ Schema pushed");

    // Step 3: Seed test data (machines and issues)
    console.log("🌱 Seeding test data...");
    execSync("npm run db:seed", {
      stdio: "inherit",
      env: process.env,
    });
    console.log("✅ Test data seeded");

    // Step 4: Create test users via Supabase Auth API
    // Note: Users must be created this way (not via SQL) so passwords work with signInWithPassword()
    console.log("👤 Creating test users...");
    execSync("npm run db:seed-users", {
      stdio: "inherit",
      env: process.env,
    });
    console.log("✅ Test users created");
  } catch (error) {
    console.error("❌ Failed to setup database:", error);
    throw error;
  }
}
