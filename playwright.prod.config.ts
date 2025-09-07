import { defineConfig, devices } from "@playwright/test";

// Production E2E configuration (no dev server, hits deployed hosts)
// Env vars (override as needed when running locally):
// - PROD_GENERIC_URL: e.g. https://pinpoint-tracker.vercel.app
// - PROD_APC_URL:     e.g. https://pinpoint.austinpinballcollective.org
// Note: Vercel .vercel.app domains don't support subdomains (apc.pinpoint-tracker.vercel.app is invalid)

const GENERIC_URL =
  process.env.PROD_GENERIC_URL || "https://pinpoint-tracker.vercel.app";
const APC_URL =
  process.env.PROD_APC_URL || "https://pinpoint.austinpinballcollective.org";

export default defineConfig({
  testDir: "./e2e/prod",
  reporter: "line",
  timeout: 45_000,
  use: {
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "prod-generic",
      testMatch: [
        "**/generic-host-behavior.e2e.test.ts",
        "**/pre-beta-user-testing-auth.e2e.test.ts",
      ],
      use: {
        ...devices["Desktop Chrome"],
        baseURL: GENERIC_URL,
        extraHTTPHeaders: {
          "x-test-target": "prod-generic",
        },
      },
    },
    {
      name: "prod-apc-alias",
      testMatch: [
        "**/apc-alias-host-behavior.e2e.test.ts",
      ],
      use: {
        ...devices["Desktop Chrome"],
        baseURL: APC_URL,
        extraHTTPHeaders: {
          "x-test-target": "prod-apc-alias",
        },
      },
    },
  ],
});
