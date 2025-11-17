import { execSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

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

  // Load environment variables from .env.local manually
  try {
    const envPath = join(process.cwd(), ".env.local");
    const envContent = readFileSync(envPath, "utf-8");
    const lines = envContent.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        const value = valueParts.join("=").trim();
        process.env[key.trim()] = value;
      }
    }
  } catch (error) {
    console.warn("⚠️ Could not load .env.local file:", error);
  }

  try {
    // Step 1: Reset Supabase database - clears everything
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error("DATABASE_URL environment variable is not set");
    }

    execSync(`supabase db reset --db-url "${dbUrl}"`, {
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
