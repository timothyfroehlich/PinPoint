import { defineConfig, devices } from "@playwright/test";

// ---------------------------------------------------------------------------
// Playwright Configuration (clean + minimal)
// ---------------------------------------------------------------------------
// Requirements:
// - Fixed base URL: http://localhost:3000
// - Auto-start dev server for reliable, self-contained tests
// - Reuse existing server if already running on port 3000
// - Support both unauthenticated and authenticated (Tim dev user) flows
// - Simple, easy to read projects definition
// - Tests may sometimes navigate to subdomains like http://apc.localhost:3000
//   (those calls will use an absolute URL in the test itself; relative paths
//   still resolve against http://localhost:3000)

const PORT = process.env.PORT ?? "3000"; // single source of truth for port
const BASE_URL = `http://localhost:${PORT}`; // fixed per requirement

// Always auto-start server for reliable, self-contained tests
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
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["auth-setup"],
    },
    {
      name: "firefox-auth",
      use: {
        ...devices["Desktop Firefox"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["auth-setup"],
    },
    {
      name: "webkit-auth",
      use: {
        ...devices["Desktop Safari"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["auth-setup"],
    },
  ],
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1`,
    url: BASE_URL,
    reuseExistingServer: true, // don't kill an already running dev server
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_ENABLE_DEV_FEATURES: "true",
      PORT: PORT,
    },
  },
});

// ---------------------------------------------------------------------------
// Usage Notes:
// 1. Run tests: `npx playwright test` or `npm run smoke`
//    - Playwright automatically starts dev server on port 3000
//    - If you already have a dev server running on 3000, it will reuse it
// 2. To navigate to a subdomain in a test, use an absolute URL, e.g.:
//      await page.goto(`http://apc.localhost:3000/issues`)
//    (Subdomains of localhost resolve to 127.0.0.1 per spec; hosts file changes
//     typically not required.)
// ---------------------------------------------------------------------------
