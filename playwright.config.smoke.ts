import baseConfig from "./playwright.config";

export default {
  ...baseConfig,
  testDir: "./e2e/smoke",
  fullyParallel: false, // Respect .serial() within files
  workers: 3, // 3 test files in parallel
  retries: process.env["CI"] ? 2 : 0,
};
