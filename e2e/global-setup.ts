/**
 * Playwright Global Setup
 *
 * Runs once before all E2E tests. Responsible for restoring the database snapshot
 * so Playwright can launch the Next.js dev server with a clean state. Server
 * readiness is handled by the Playwright `webServer` lifecycle.
 */

import { execSync } from "node:child_process";
import type { FullConfig } from "@playwright/test";

export default async function globalSetup(config: FullConfig) {
  console.log("🔧 Playwright Global Setup Starting...\n");

  // Step 1: Restore database snapshot
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

  console.log("✅ Global Setup Complete - Database snapshot restored\n");
}
