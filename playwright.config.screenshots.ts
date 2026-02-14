import { devices } from "@playwright/test";
import baseConfig from "./playwright.config";

/**
 * Screenshot-only Playwright config.
 *
 * Captures informational screenshots across 3 viewports (Desktop, iPhone 13 Mini, Pixel 5)
 * and produces an interactive HTML report deployed to GitHub Pages per PR.
 *
 * This config is intentionally lenient:
 *  - workers: 1 (deterministic ordering)
 *  - retries: 0 (informational; CI wraps the command with `|| true`)
 *  - reporter: HTML only (consumed by gh-pages deploy step)
 */
export default {
  ...baseConfig,
  testDir: "./e2e/screenshots",
  workers: 1,
  retries: 0,
  reporter: [["html", { open: "never" }]] as const,
  projects: [
    {
      name: "Desktop",
      use: {
        browserName: "chromium" as const,
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: "Mobile iPhone 13 Mini",
      use: {
        // iPhone 12 descriptor for correct Safari emulation, viewport overridden
        // to iPhone 13 Mini (375x812).
        ...devices["iPhone 12"],
        viewport: { width: 375, height: 812 },
      },
    },
    {
      name: "Mobile Pixel 5",
      use: { ...devices["Pixel 5"] },
    },
  ],
};
