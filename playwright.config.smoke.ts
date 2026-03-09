import baseConfig from "./playwright.config";

export default {
  ...baseConfig,
  testDir: "./e2e/smoke",
  fullyParallel: true,
  workers: process.env["CI"] ? 3 : 2,
  retries: process.env["CI"] ? 2 : 0,
};
