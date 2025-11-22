import { defineConfig, devices } from "@playwright/test";

// Default port matches main worktree (3000)
// Other worktrees should set PORT in .env.local (3100, 3200, 3300)
// See AGENTS.md for port allocation table
const port = Number(process.env.PORT ?? "3000");
const baseURL = `http://127.0.0.1:${port}`;

/**
 * Playwright E2E Test Configuration
 *
 * Simplified config for smoke tests. Keep it minimal.
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./e2e",

  // Global setup: Reset database before all tests
  globalSetup: "./e2e/global-setup.ts",

  // Run tests in files in parallel
  fullyParallel: !process.env.CI,

  // Short, developer-friendly timeouts
  timeout: process.env.CI ? 15 * 1000 : 20 * 1000, // per-test timeout
  expect: {
    timeout: process.env.CI ? 7 * 1000 : 4 * 1000,
  },

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporters: print progress locally; keep CI quiet; never block on HTML
  reporter: process.env.CI
    ? [["dot"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],

  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL,

    // Collect trace when retrying the failed test
    trace: "on-first-retry",

    // Screenshot on failure
    screenshot: "only-on-failure",

    // Keep interactions snappy during dev
    actionTimeout: 5 * 1000,
    navigationTimeout: 15 * 1000,
  },

  // Configure projects for major browsers
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Run your local dev server before starting the tests
  webServer: {
    command: `PORT=${port} npm run dev`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes

    // Show server output for debugging (critical for diagnosing startup failures)
    stdout: "pipe",
    stderr: "pipe",

    // Ignore HTTPS errors for local development
    ignoreHTTPSErrors: true,
    env: {
      PORT: String(port),
    },
  },
});
