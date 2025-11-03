/**
 * Playwright Global Setup
 *
 * Runs once before all E2E tests. Responsible for ensuring the database is seeded
 * and ready. In local dev, uses snapshots for speed (2-5s vs 25-65s re-seeding).
 * In CI, database is pre-seeded by workflow, so snapshot operations are skipped.
 *
 * Server readiness is handled by the Playwright `webServer` lifecycle.
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { FullConfig } from "@playwright/test";

export default async function globalSetup(config: FullConfig) {
  console.log("🔧 Playwright Global Setup Starting...\n");

  // In CI, database is seeded fresh by the workflow before tests run
  // Skip snapshot operations to avoid filesystem dependencies
  if (process.env.CI === "true") {
    console.log(
      "⏭️  Skipping snapshot operations in CI (database already seeded by workflow)\n",
    );
    console.log("✅ Global Setup Complete\n");
    return;
  }

  const snapshotPath = resolve(__dirname, "fixtures/test-database.dump");
  const snapshotExists = existsSync(snapshotPath);

  if (!snapshotExists) {
    console.log("📸 Snapshot not found - creating fresh snapshot...");
    console.log(
      "   This is a one-time setup (subsequent runs will be faster)\n",
    );

    try {
      // Seed the database fresh
      console.log("🌱 Seeding database...");
      execSync("npm run db:reset:local", {
        stdio: "inherit",
        env: process.env,
      });

      // Create the snapshot
      console.log("\n📦 Creating snapshot...");
      execSync("npm run e2e:snapshot:create", {
        stdio: "inherit",
        env: process.env,
      });

      console.log("✅ Fresh snapshot created\n");
    } catch (error) {
      console.error("❌ Failed to create snapshot");
      throw error;
    }
  } else {
    // Snapshot exists - restore it (fast path)
    console.log("📦 Restoring database snapshot...");
    try {
      execSync("npm run e2e:snapshot:restore", {
        stdio: "inherit",
        env: {
          ...process.env,
          // Ensure we use local Supabase
          PGHOST: "127.0.0.1",
          PGPORT: "54322",
          PGUSER: "postgres",
          PGDATABASE: "postgres",
          PGPASSWORD: "postgres",
        },
      });
      console.log("✅ Database snapshot restored\n");
    } catch (error) {
      console.error("❌ Failed to restore database snapshot");
      throw error;
    }
  }

  console.log("✅ Global Setup Complete - Database ready for E2E tests\n");
}
