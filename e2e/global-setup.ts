/**
 * Playwright Global Setup
 *
 * Runs once before all E2E tests. Responsible for:
 * 1. Restoring database snapshot (fast 2-5s restore vs 25-65s re-seed)
 * 2. Verifying database health
 * 3. Ensuring server can start (Playwright webServer config handles actual startup)
 *
 * This separates database state management from server lifecycle,
 * fixing race conditions and improving startup speed by 10-20x.
 */

import { execSync } from "node:child_process";
import { chromium, type FullConfig } from "@playwright/test";

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

  // Step 2: Verify database health
  console.log("🏥 Verifying database health...");
  const PORT = process.env.PLAYWRIGHT_PORT ?? process.env.PORT ?? "3000";
  const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Wait for health endpoint to be ready
    // This verifies both server AND database are ready
    const response = await page.goto(`${BASE_URL}/api/health/ready`, {
      timeout: 30000, // 30s timeout
      waitUntil: "networkidle",
    });

    if (!response || response.status() !== 200) {
      const body = await response?.text().catch(() => "Unable to read response");
      throw new Error(
        `Health check failed:\n` +
          `  Status: ${response?.status() ?? "No response"}\n` +
          `  URL: ${BASE_URL}/api/health/ready\n` +
          `  Response: ${body}\n\n` +
          `This usually means:\n` +
          `  1. Server failed to start (check 'npm run dev' output)\n` +
          `  2. Database snapshot is invalid (try 'npm run db:reset && npm run e2e:snapshot:create')\n` +
          `  3. Health endpoint has a bug`,
      );
    }

    const healthData = (await response.json()) as {
      ready: boolean;
      checks?: Record<string, boolean>;
      message?: string;
    };

    if (!healthData.ready) {
      throw new Error(
        `Health check returned 200 but ready=false:\n` +
          `  Checks: ${JSON.stringify(healthData.checks, null, 2)}\n` +
          `  Message: ${healthData.message ?? "No message"}`,
      );
    }

    console.log("✅ Database health verified");
    console.log(`   Checks: ${JSON.stringify(healthData.checks ?? {}, null, 2)}`);
    console.log("");
  } catch (error) {
    console.error("❌ Database health check failed");
    throw error;
  } finally {
    await browser.close();
  }

  console.log("✅ Global Setup Complete - Ready for E2E tests\n");
}
