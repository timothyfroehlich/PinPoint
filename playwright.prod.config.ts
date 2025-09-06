import { defineConfig, devices } from "@playwright/test";

// Production E2E configuration (no dev server, hits deployed hosts)
// Env vars (override as needed when running locally):
// - PROD_GENERIC_URL: e.g. https://pinpoint-tracker.vercel.app
// - PROD_APC_URL:     e.g. https://pinpoint.austinpinballcollective.org
// - PROD_GENERIC_ORG_SUBDOMAIN: default 'apc'

const GENERIC_URL = process.env.PROD_GENERIC_URL || "https://pinpoint-tracker.vercel.app";
const APC_URL = process.env.PROD_APC_URL || "https://pinpoint.austinpinballcollective.org";
const ORG_SUB = process.env.PROD_GENERIC_ORG_SUBDOMAIN || "apc";

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
      use: {
        ...devices["Desktop Chrome"],
        baseURL: GENERIC_URL,
        extraHTTPHeaders: {
          "x-test-target": "prod-generic",
        },
      },
    },
    {
      name: "prod-generic-apc-subdomain",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `https://${ORG_SUB}.${new URL(GENERIC_URL).host}`,
        extraHTTPHeaders: {
          "x-test-target": "prod-generic-apc",
        },
      },
    },
    {
      name: "prod-apc-alias",
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

