import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E Test Configuration
 *
 * Simplified config for smoke tests. Keep it minimal.
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./e2e",

  // Run tests in files in parallel
  fullyParallel: !process.env.CI,

  // Short, developer-friendly timeouts
  timeout: 10 * 1000, // 10s per test
  expect: {
    timeout: 2 * 1000, // 2s for expect()
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
    baseURL: "http://localhost:3000",

    // Collect trace when retrying the failed test
    trace: "on-first-retry",

    // Screenshot on failure
    screenshot: "only-on-failure",

    // Keep interactions snappy during dev
    actionTimeout: 5 * 1000,
    navigationTimeout: 8 * 1000,
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
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes

    // Show server output for debugging (critical for diagnosing startup failures)
    stdout: "pipe",
    stderr: "pipe",

    // Ignore HTTPS errors for local development
    ignoreHTTPSErrors: true,
  },
});
