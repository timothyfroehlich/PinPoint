import { defineConfig, devices } from "@playwright/test";
import baseConfig from "./playwright.config";

/**
 * Smoke tests most likely to surface cross-browser regressions locally.
 * Chromium/Mobile Chrome run the full smoke suite; Firefox/Mobile Safari run a
 * targeted subset locally and the full smoke suite in CI.
 */
const CROSS_BROWSER_SUBSET = [
  "**/responsive-overflow.spec.ts",
  "**/navigation.spec.ts",
  "**/public-reporting.spec.ts",
];

const isCI = !!process.env["CI"];

export default defineConfig({
  ...baseConfig,
  testDir: "./e2e/smoke",
  fullyParallel: true,
  workers: isCI ? 3 : 2,
  retries: isCI ? 2 : 0,
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
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
      dependencies: ["auth-setup"],
    },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 1024, height: 768 },
      },
      ...(!isCI && { testMatch: CROSS_BROWSER_SUBSET }),
      dependencies: ["auth-setup"],
    },
    {
      name: "Mobile Safari",
      use: {
        ...devices["iPhone 12"],
        viewport: { width: 375, height: 812 },
      },
      ...(!isCI && { testMatch: CROSS_BROWSER_SUBSET }),
      retries: isCI ? 3 : 1,
      timeout: isCI ? 120 * 1000 : 60 * 1000,
      dependencies: ["auth-setup"],
    },
  ],
});
