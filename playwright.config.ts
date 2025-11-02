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

// Allow override via PLAYWRIGHT_PORT, fallback to PORT, then 3000
// This helps when dev server is running on a different port due to conflicts
const PORT = process.env.PLAYWRIGHT_PORT ?? process.env.PORT ?? "3000"; // single source of truth for port
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
  // Global setup: Restore database snapshot before tests (2-5s vs 25-65s re-seed)
  globalSetup: "./e2e/global-setup.ts",
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
    // { name: "firefox", use: { ...devices["Desktop Firefox"] } }, // DISABLED: Firefox installation broken
    // { name: "webkit", use: { ...devices["Desktop Safari"] } }, // DISABLED: Testing with Chromium only

    // 3. Authenticated browsers (depend on auth-setup)
    {
      name: "chromium-auth",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["auth-setup"],
    },
    // {
    //   name: "firefox-auth",
    //   use: {
    //     ...devices["Desktop Firefox"],
    //     storageState: "e2e/.auth/user.json",
    //   },
    //   dependencies: ["auth-setup"],
    // },
    // {
    //   name: "webkit-auth",
    //   use: {
    //     ...devices["Desktop Safari"],
    //     storageState: "e2e/.auth/user.json",
    //   },
    //   dependencies: ["auth-setup"],
    // },
  ],
  // Use dev server by default (faster, better errors). Toggle production build with PLAYWRIGHT_USE_PREVIEW=1.
  // Database state is managed separately via globalSetup (snapshot restore).
  webServer: (() => {
    const usePreview = process.env.PLAYWRIGHT_USE_PREVIEW === "1";
    return {
      command: usePreview
        ? `npm run preview` // next build && next start
        : `npm run dev -- --hostname 127.0.0.1`,
      // Simple health check: server responds
      // Database health is verified in globalSetup (separation of concerns)
      url: BASE_URL,
      // Reuse existing server locally for speed, fresh server in CI
      reuseExistingServer: !process.env.CI,
      timeout: 60_000, // 1 minute (sufficient now that database restore is separate)
      env: {
        NEXT_PUBLIC_ENABLE_DEV_FEATURES: "true",
        PORT: PORT,
      },
    };
  })(),
});

// ---------------------------------------------------------------------------
// Usage Notes:
// 1. Run tests: `npx playwright test` or `npm run e2e`
//    - globalSetup restores database snapshot (2-5s)
//    - Playwright starts dev server or reuses existing one
//    - Much faster than previous re-seeding approach (25-65s)
// 2. After schema changes:
//    - npm run db:reset (seed fresh database)
//    - npm run e2e:snapshot:create (capture new state)
// 3. To navigate to a subdomain in a test, use an absolute URL, e.g.:
//      await page.goto(`http://apc.localhost:3000/issues`)
//    (Subdomains of localhost resolve to 127.0.0.1 per spec; hosts file changes
//     typically not required.)
// 4. Use PLAYWRIGHT_USE_PREVIEW=1 to test against production build instead of dev
// ---------------------------------------------------------------------------
