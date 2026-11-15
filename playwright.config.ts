import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import { join } from "node:path";

// Load .env.local using the same loader Next.js uses at runtime.
// Idempotent — safe if Playwright re-evaluates this config per project.
//
// `dev: true` is REQUIRED, not cosmetic. @next/env defaults `dev` to false,
// which makes loadEnvConfig load PRODUCTION env files (.env.production.local
// first, highest precedence). On a checkout that has a .env.production.local
// (the root checkout keeps one for prod ops), that silently points the entire
// E2E harness — including global-setup's `db:reset` / `supabase db reset` /
// migrate — at PRODUCTION. Forcing dev mode loads .env.local (local stack)
// and never touches .env.production.local. See PP-yso5 follow-up.
loadEnvConfig(process.cwd(), true);

// Worktree-aware: PORT is set per-worktree in .env.local by post-checkout hook
const port = Number(process.env["PORT"] ?? "3000");
const hostname = process.env["PLAYWRIGHT_HOST"] ?? "localhost";
const baseURL = `http://${hostname}:${port}`;
const webServerStdout = process.env["PLAYWRIGHT_STDOUT"] ?? "ignore";
const webServerStderr = process.env["PLAYWRIGHT_STDERR"] ?? "pipe";

// Which server the suite runs against (PP-izj5). Unset or `dev` keeps
// `next dev`, the default for local runs, preflight and crabbox jobs.
// `start` runs a production build (`next build && next start`), which CI's
// E2E jobs select so first-visit route compiles cannot eat the navigation
// timeout (PP-rj2x, PP-po96). Deliberately not keyed on `CI`: crabbox sets
// CI=1 and stays on dev unless this is set too.
const webServerMode = process.env["PLAYWRIGHT_WEB_SERVER"] ?? "dev";
if (webServerMode !== "dev" && webServerMode !== "start") {
  throw new Error(
    `PLAYWRIGHT_WEB_SERVER must be "dev" or "start", got "${webServerMode}"`
  );
}
const useProductionBuild = webServerMode === "start";
// `next build` and `next start` load .env.production*, which the dev-mode
// loadEnvConfig above never reads. A checkout holding production env files
// would quietly mix production values into the E2E server, so refuse.
if (
  useProductionBuild &&
  [".env.production", ".env.production.local"].some((file) =>
    existsSync(join(process.cwd(), file))
  )
) {
  throw new Error(
    "PLAYWRIGHT_WEB_SERVER=start refuses to run in a checkout with .env.production or .env.production.local"
  );
}

console.log(
  `[playwright.config.ts] Resolved baseURL: ${baseURL} (web server: ${webServerMode})`
);

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
    actionTimeout: process.env["CI"] ? 30_000 : 5_000,
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
    command: useProductionBuild
      ? `pnpm exec next build && pnpm exec next start --port ${port}`
      : `PORT=${port} pnpm run dev`,
    url: `${baseURL}/api/health`,
    // An explicit `start` never reuses a running server: the one already on
    // the port is most likely a dev server, which would void the switch.
    reuseExistingServer: !process.env["CI"] && !useProductionBuild,
    // `next build` must finish inside this window too (about 35s on a CI
    // runner); `next dev` only has to boot.
    timeout: useProductionBuild
      ? 5 * 60 * 1000
      : process.env["CI"]
        ? 120 * 1000
        : 60 * 1000,
    stdout: (webServerStdout === "inherit" ? "pipe" : webServerStdout) as
      "pipe" | "ignore",
    stderr: (webServerStderr === "inherit" ? "pipe" : webServerStderr) as
      "pipe" | "ignore",
    ignoreHTTPSErrors: true,
    env: {
      PORT: String(port),
      MOCK_BLOB_STORAGE: useProductionBuild
        ? "true"
        : (process.env["MOCK_BLOB_STORAGE"] ?? ""),
      UNSUBSCRIBE_SIGNING_SECRET:
        process.env["UNSUBSCRIBE_SIGNING_SECRET"] ?? "",
      // `next start` runs with NODE_ENV=production. VERCEL_ENV=development
      // tells isProductionRuntime() (~/lib/runtime-env) this is not the
      // production deployment, so test-only behavior (fail-open rate limits,
      // localhost site URL, mock uploads) stays available.
      ...(useProductionBuild && { VERCEL_ENV: "development" }),
    },
  },
});
