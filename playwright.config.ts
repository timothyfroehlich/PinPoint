import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
import { defineConfig, devices } from "@playwright/test";

// Load .env.local using the same loader Next.js uses at runtime.
// Idempotent — safe if Playwright re-evaluates this config per project.
loadEnvConfig(process.cwd());

// Worktree-aware: PORT is set per-worktree in .env.local by pinpoint-wt.py
// (3000 main, 3100 secondary, 3200 review, 3300 antigravity, 3400+ ephemeral)
const port = Number(process.env["PORT"] ?? "3000");
const hostname = process.env["PLAYWRIGHT_HOST"] ?? "localhost";
const baseURL = `http://${hostname}:${port}`;
const webServerStdout = process.env["PLAYWRIGHT_STDOUT"] ?? "ignore";
const webServerStderr = process.env["PLAYWRIGHT_STDERR"] ?? "pipe";

console.log(`[playwright.config.ts] Resolved baseURL: ${baseURL}`);

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",

  fullyParallel: true,

  timeout: process.env["CI"] ? 60 * 1000 : 30 * 1000,
  expect: {
    timeout: process.env["CI"] ? 30 * 1000 : 10 * 1000,
  },

  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  workers: process.env["CI"] ? 2 : 1,

  reporter: process.env["CI"]
    ? [["dot"], ["html", { open: "never" }]]
    : [["line"], ["html", { open: "never" }]],

  use: {
    baseURL,
    extraHTTPHeaders: { "x-skip-autologin": "true" },
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 10 * 1000,
    navigationTimeout: 20 * 1000,
  },

  projects: [
    {
      name: "auth-setup",
      testDir: "./e2e",
      testMatch: "auth.setup.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["auth-setup"],
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
      dependencies: ["auth-setup"],
    },
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
      dependencies: ["auth-setup"],
    },
    ...(!process.env["CI"] && process.env["PLAYWRIGHT_ENABLE_SAFARI"] !== "true"
      ? []
      : [
          {
            name: "Mobile Safari",
            use: {
              ...devices["iPhone 12"],
              viewport: { width: 375, height: 812 },
            },
            retries: process.env["CI"] ? 3 : 1,
            timeout: process.env["CI"] ? 120 * 1000 : 60 * 1000,
            dependencies: ["auth-setup"],
          },
        ]),
  ],

  webServer: {
    command: `PORT=${port} pnpm run dev`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env["CI"],
    timeout: process.env["CI"] ? 120 * 1000 : 60 * 1000,
    stdout: (webServerStdout === "inherit" ? "pipe" : webServerStdout) as
      | "pipe"
      | "ignore",
    stderr: (webServerStderr === "inherit" ? "pipe" : webServerStderr) as
      | "pipe"
      | "ignore",
    ignoreHTTPSErrors: true,
    env: {
      PORT: String(port),
      MOCK_BLOB_STORAGE: process.env["MOCK_BLOB_STORAGE"] ?? "",
    },
  },
});
