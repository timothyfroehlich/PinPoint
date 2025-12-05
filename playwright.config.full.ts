import baseConfig from "./playwright.config";

export default {
  ...baseConfig,
  testDir: "./e2e",
  testMatch: "**/full/**/*.spec.ts",
  fullyParallel: false,
  workers: 3,
  retries: process.env["CI"] ? 2 : 0,
};
