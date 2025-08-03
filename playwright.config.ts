import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env["CI"],

  // Retry on CI only
  retries: process.env["CI"] ? 2 : 0,

  // Use optimal workers for CI performance
  workers: 4,

  // Reporter to use
  reporter: "html",

  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: `http://apc.localhost:${process.env["PORT"] ?? "3000"}`,

    // Collect trace when retrying the failed test
    trace: "on-first-retry",

    // Capture screenshot on failure
    screenshot: "only-on-failure",
  },

  // Configure projects for major browsers
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // Other browsers only for local development (CI optimization)
    ...(process.env["CI"]
      ? []
      : [
          {
            name: "firefox",
            use: { ...devices["Desktop Firefox"] },
          },
        ]),
    // WebKit disabled due to authentication issues (see GitHub issue #162)
    // {
    //   name: "webkit",
    //   use: { ...devices["Desktop Safari"] },
    // },
  ],

  // Automatically start dev server for tests
  webServer: {
    command: "npm run dev",
    url: `http://localhost:${process.env["PORT"] ?? "3000"}`,
    reuseExistingServer: !process.env["CI"],
    timeout: 120000,
  },
});
