import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

const shouldSkipSafariOnThisHost =
  !process.env["CI"] &&
  (process.platform === "linux" ||
    process.env["PLAYWRIGHT_SKIP_SAFARI"] === "true" ||
    process.env["PLAYWRIGHT_SKIP_SAFARI"] === "1");
const shouldSkipFirefoxOnThisHost =
  process.platform === "linux" &&
  process.env["PLAYWRIGHT_FULL_INCLUDE_FIREFOX"] !== "true" &&
  process.env["PLAYWRIGHT_FULL_INCLUDE_FIREFOX"] !== "1";

const baseProjects = baseConfig.projects ?? [];
const projects = baseProjects.filter((project) => {
  if (shouldSkipSafariOnThisHost && project.name === "Mobile Safari") {
    return false;
  }
  if (shouldSkipFirefoxOnThisHost && project.name === "firefox") {
    return false;
  }
  return true;
});

export default defineConfig({
  ...baseConfig,
  testDir: "./e2e",
  testMatch: "**/full/**/*.spec.ts",
  fullyParallel: false,
  workers: process.env["CI"] ? 2 : 1,
  retries: process.env["CI"] ? 2 : 0,
  projects,
});
