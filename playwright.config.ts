import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
import { defineConfig, devices } from "@playwright/test";

// Load .env.local using the same loader Next.js uses at runtime.
// Idempotent — safe if Playwright re-evaluates this config per project.
loadEnvConfig(process.cwd());

// Worktree-aware: PORT is set per-worktree in .env.local by post-checkout hook
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

  reporter: (() => {
    // Build reporter list at config-evaluation time so CLI --reporter= flags
    // are never needed (CLI flags override the config entirely, which drops html).
    type R = [string] | [string, Record<string, unknown>];
    if (!process.env["CI"]) {
      return [["line"], ["html", { open: "never" }]] as R[];
    }
    const reporters: R[] = [
      ["dot"],
      ["html", { open: "never" }],
      // GitHub Actions inline annotations — only useful in CI
      ["github"],
    ];
    // JSON reporter for structured failure summaries; enabled only when the
    // env var is set (comprehensive post-merge job) to avoid stdout noise.
    if (process.env["PLAYWRIGHT_JSON_OUTPUT_NAME"]) reporters.push(["json"]);
    return reporters;
  })(),

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
      fullyParallel: false, // Serialize to prevent Supabase cookie rotation races
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1024, height: 768 },
      },
      dependencies: ["auth-setup"],
    },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 1024, height: 768 },
      },
      dependencies: ["auth-setup"],
    },
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
      dependencies: ["auth-setup"],
    },
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
  ],

  webServer: {
    // dev:e2e mirrors dev but re-exports empty Turnstile vars *after* sourcing
    // .env.local, so real keys from that file cannot leak into the test server.
    command: `PORT=${port} pnpm run dev:e2e`,
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
