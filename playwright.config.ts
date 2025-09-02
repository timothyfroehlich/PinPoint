import { defineConfig, devices } from "@playwright/test";

// ---------------------------------------------------------------------------
// Playwright Configuration (clean + minimal)
// ---------------------------------------------------------------------------
// Requirements from user:
// - Fixed base URL: http://localhost:3000
// - Reuse an already running Next.js dev server (do NOT auto start by default)
// - Still allow CI / explicit opt-in auto-start when desired
// - Support both unauthenticated and authenticated (Tim dev user) flows
// - Simple, easy to read projects definition
// - Tests may sometimes navigate to subdomains like http://apc.localhost:3000
//   (those calls will use an absolute URL in the test itself; relative paths
//   still resolve against http://localhost:3000)

const PORT = process.env.PORT || "3000"; // single source of truth for port
const BASE_URL = `http://localhost:${PORT}`; // fixed per requirement

// Opt-in auto start (e.g. in CI) via PLAYWRIGHT_START=1 (explicit > implicit)
// or fallback to CI detection for convenience.
const SHOULD_START = process.env.PLAYWRIGHT_START === "1" || !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Keep workers >1 locally for speed; serialize on CI for stability if desired.
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    // Allow tests to opt into headed mode locally with PWDEBUG=1 etc.
    video: process.env.CI ? "retain-on-failure" : "off",
    screenshot: "only-on-failure",
  },
  projects: [
    // 1. Auth setup (creates e2e/.auth/user.json for Tim dev user)
    { name: "auth-setup", testMatch: "**/auth.setup.ts" },

    // 2. Unauthenticated browsers
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },

    // 3. Authenticated browsers (depend on auth-setup)
    {
      name: "chromium-auth",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/user.json" },
      dependencies: ["auth-setup"],
    },
    {
      name: "firefox-auth",
      use: { ...devices["Desktop Firefox"], storageState: "e2e/.auth/user.json" },
      dependencies: ["auth-setup"],
    },
    {
      name: "webkit-auth",
      use: { ...devices["Desktop Safari"], storageState: "e2e/.auth/user.json" },
      dependencies: ["auth-setup"],
    },
  ],
  ...(SHOULD_START
    ? {
        webServer: {
          command: `NEXT_PUBLIC_ENABLE_DEV_FEATURES=true PORT=${PORT} npm run dev`,
          url: BASE_URL,
          reuseExistingServer: true, // don't kill an already running dev server
          timeout: 120_000,
        },
      }
    : {
        // No webServer section -> Playwright will assume server already running.
      }),
});

// ---------------------------------------------------------------------------
// Usage Notes:
// 1. Start dev server yourself: `PORT=3000 npm run dev` (or just `npm run dev`).
// 2. Run tests (reuse server): `npx playwright test`.
// 3. To have Playwright start the server (e.g. CI/local one-off):
//      PLAYWRIGHT_START=1 npx playwright test
// 4. To navigate to a subdomain in a test, use an absolute URL, e.g.:
//      await page.goto(`http://apc.localhost:${process.env.PORT||3000}/issues`)
//    (Subdomains of localhost resolve to 127.0.0.1 per spec; hosts file changes
//     typically not required.)
// ---------------------------------------------------------------------------
