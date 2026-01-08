import { execSync } from "child_process";
import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "fs";
import { join } from "path";

// Load .env.local BEFORE reading process.env.PORT
// This ensures PORT from .env.local is available when config is evaluated
try {
  const envPath = join(process.cwd(), ".env.local");
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    if (key && valueParts.length > 0 && process.env[key.trim()] === undefined) {
      process.env[key.trim()] = valueParts.join("=").trim();
    }
  }
} catch (e) {
  console.error("Failed to read .env.local:", e);
  // .env.local not found - use defaults
}

// Default port matches main worktree (3000)
// Other worktrees should set PORT in .env.local (3100, 3200, 3300)
// See AGENTS.md for port allocation table
const port = Number(process.env["PORT"] ?? "3000");
// Keep host consistent with Supabase site_url to avoid cookie host mismatches
const hostname = process.env["PLAYWRIGHT_HOST"] ?? "localhost";
const baseURL = `http://${hostname}:${port}`;
const webServerStdout = process.env["PLAYWRIGHT_STDOUT"] ?? "ignore";
const webServerStderr = process.env["PLAYWRIGHT_STDERR"] ?? "pipe";
const healthCheckTimeoutMs = process.env["CI"] ? 1500 : 1000;

console.log(`[playwright.config.ts] Resolved PORT: ${port}`);
console.log(`[playwright.config.ts] Resolved baseURL: ${baseURL}`);

function listPidsOnPort(targetPort: number): string[] {
  try {
    const output = execSync(`lsof -i :${targetPort} -sTCP:LISTEN -Fp`, {
      stdio: "pipe",
      encoding: "utf-8",
    });
    return output
      .split("\n")
      .filter((line) => line.startsWith("p"))
      .map((line) => line.slice(1))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function isServerHealthy(url: string): boolean {
  const script = [
    `const url = ${JSON.stringify(url)};`,
    `const controller = new AbortController();`,
    `const timeout = setTimeout(() => controller.abort(), ${healthCheckTimeoutMs});`,
    `fetch(url, { signal: controller.signal })`,
    `  .then((res) => { clearTimeout(timeout); process.exit(res.ok ? 0 : 1); })`,
    `  .catch(() => { clearTimeout(timeout); process.exit(1); });`,
  ].join(" ");

  const escapedScript = script.replace(/'/g, "'\\''");

  try {
    execSync(`node -e '${escapedScript}'`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function clearStaleServerIfNeeded(targetPort: number, url: string): void {
  const pids = listPidsOnPort(targetPort);
  if (pids.length === 0) return;

  if (isServerHealthy(url)) {
    // Healthy dev server already running; Playwright will reuse it.
    return;
  }

  for (const pid of pids) {
    try {
      execSync(`kill ${pid}`);
      console.warn(
        `[playwright] Killed stale dev server on port ${targetPort} (pid ${pid}).`
      );
    } catch {
      // If we cannot kill it, let Playwright surface the bind error.
    }
  }
}

/**
 * Playwright E2E Test Configuration
 *
 * Simplified config for smoke tests. Keep it minimal.
 * See https://playwright.dev/docs/test-configuration
 */

clearStaleServerIfNeeded(port, baseURL);

export default defineConfig({
  testDir: "./e2e",

  // Global setup: Reset database before all tests
  globalSetup: "./e2e/global-setup.ts",

  // Run tests sequentially for stability (Supabase + Next dev server)
  fullyParallel: false,

  // Increased timeouts for stability in heavy load environments
  timeout: process.env["CI"] ? 60 * 1000 : 30 * 1000, // per-test timeout
  expect: {
    timeout: process.env["CI"] ? 30 * 1000 : 10 * 1000, // assertion timeout
  },

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env["CI"],

  // Retry on CI only
  retries: process.env["CI"] ? 2 : 0,

  // Keep a single worker for stability across environments
  workers: 1,

  // Reporters: print progress locally; keep CI quiet; never block on HTML
  reporter: process.env["CI"]
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

    // Keep interactions snappy during dev but allow buffer
    actionTimeout: 10 * 1000,
    navigationTimeout: 20 * 1000,
  },

  // Configure projects for major browsers (Safari can be disabled locally via env)
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
    ...(process.env["PLAYWRIGHT_SKIP_SAFARI"] === "true" ||
    process.env["PLAYWRIGHT_SKIP_SAFARI"] === "1"
      ? []
      : [
          {
            name: "Mobile Safari",
            use: {
              ...devices["iPhone 12"],
              // WebKit-specific configuration for known issues
              // Safari has slower Server Action redirect processing (Next.js Issue #48309)
              // WebKit tests can be 2x slower than Chromium
            },
            // Increase retries for WebKit due to known flakiness
            retries: process.env["CI"] ? 3 : 1,
            // Increase timeout for WebKit (2x base timeout, CI-aware)
            timeout: process.env["CI"] ? 120 * 1000 : 60 * 1000,
          },
        ]),
  ],

  // Run your local dev server before starting the tests
  webServer: {
    command: `PORT=${port} pnpm run dev`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env["CI"],
    timeout: process.env["CI"] ? 120 * 1000 : 60 * 1000,

    // Default quiet output; override via PLAYWRIGHT_STDOUT/STDERR when debugging
    stdout: (webServerStdout === "inherit" ? "pipe" : webServerStdout) as
      | "pipe"
      | "ignore",
    stderr: (webServerStderr === "inherit" ? "pipe" : webServerStderr) as
      | "pipe"
      | "ignore",

    // Ignore HTTPS errors for local development
    ignoreHTTPSErrors: true,
    env: {
      PORT: String(port),
    },
  },
});
