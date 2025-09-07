/**
 * Simplified Vitest Configuration for PinPoint
 *
 * Back to single-project setup while we fix the CI issues.
 * The multi-project setup can be re-enabled once the basic tests are working.
 */
/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

// Simple coverage: only enabled when explicitly requested
const enableCoverage = process.env["COVERAGE"] === "true";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    env: loadEnv("test", process.cwd(), ""),
    testTimeout: 30000,
    setupFiles: [
      "./src/test/setup/nextjs-mocks.ts",
      "./src/test/setup/organization-mocks.ts",
    ],
    coverage: {
      enabled: enableCoverage,
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "node_modules/",
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
        "e2e/",
        "*.config.{ts,js}",
        "scripts/",
        ".next/",
        "docs/",
      ],
    },
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: [
      "node_modules",
      "e2e/**",
      ".next/**",
      ".archived-tests-*/**",
      "**/e2e/**",
      "**/*.e2e.test.*",
    ],
  },
});
