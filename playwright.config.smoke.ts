import baseConfig from "./playwright.config";

export default {
  ...baseConfig,
  testDir: "./e2e/smoke",
  fullyParallel: false, // Respect .serial() within files
  workers: 1, // Avoid cross-file auth/session flakiness with local Supabase
  retries: process.env["CI"] ? 2 : 0,
};
