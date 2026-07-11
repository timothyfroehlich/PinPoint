import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

// Wrapped in defineConfig (matching playwright.config.smoke.ts) so the emitted
// declaration uses Playwright's named config type rather than a structural type
// that references the private `TestConfigWebServer` name — required now that the
// app project is `composite` and checks declaration emit (TS4082, PP-4k76).
export default defineConfig({
  ...baseConfig,
  testDir: "./e2e",
  testMatch: "**/full/**/*.spec.ts",
  fullyParallel: false,
  workers: 3,
  retries: process.env["CI"] ? 2 : 0,
});
