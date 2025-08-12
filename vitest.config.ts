/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

// Load environment variables before any tests run
import "./src/lib/env-loaders/test";

// Smart coverage: enabled in CI, disabled in development for performance
const enableCoverage =
  process.env["CI"] === "true" || process.env["COVERAGE"] === "true";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./src"),
    },
    conditions: ["node", "import"],
  },
  test: {
    coverage: {
      enabled: enableCoverage,
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage",
      exclude: [
        "node_modules/",
        "src/test/",
        "**/*.test.{ts,tsx}",
        "**/*.vitest.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
        "src/_archived_frontend/",
        "e2e/",
        "playwright-report/",
        "test-results/",
        "*.config.{ts,js}",
        "scripts/",
        "prisma/",
        ".next/",
        "docs/",
      ],
      include: ["src/**/*.{ts,tsx}"],
      thresholds: {
        global: {
          branches: 50,
          functions: 50,
          lines: 50,
          statements: 50,
        },
        "src/server/**": {
          branches: 60,
          functions: 44,
          lines: 46,
          statements: 46,
        },
        "src/lib/**": {
          branches: 70,
          functions: 53,
          lines: 31,
          statements: 31,
        },
      },
    },
    projects: [
      {
        plugins: [react(), tsconfigPaths()],
        resolve: {
          alias: {
            "~": path.resolve(__dirname, "./src"),
          },
        },
        // Node environment for server-side tests (with database mocking)
        test: {
          name: "node",
          globals: true,
          environment: "node",
          setupFiles: ["src/test/vitest.setup.ts"],
          typecheck: {
            tsconfig: "./tsconfig.tests.json",
          },
          // Remove singleThread to restore proper test isolation
          poolOptions: {
            threads: {
              isolate: true,
            },
          },
          include: [
            "src/lib/**/*.test.{ts,tsx}",
            "src/server/**/*.test.{ts,tsx}",
          ],
          exclude: [
            "node_modules",
            "src/_archived_frontend",
            "src/integration-tests",
            "e2e",
            "playwright-report",
            "test-results",
          ],
        },
      },
      {
        plugins: [react(), tsconfigPaths()],
        resolve: {
          alias: {
            "~": path.resolve(__dirname, "./src"),
          },
        },
        // Integration test environment (real database, no mocking)
        test: {
          name: "integration",
          globals: true,
          environment: "node",
          setupFiles: ["src/test/vitest.integration.setup.ts"],
          typecheck: {
            tsconfig: "./tsconfig.tests.json",
          },
          // Memory optimization: limit workers to reduce PGlite memory usage
          poolOptions: {
            threads: {
              maxThreads: 4, // Increased from 2 - memory optimization allows more workers
              minThreads: 1, // Minimum 1 worker
              isolate: true, // Maintain test isolation
            },
          },
          // Enable memory monitoring to track optimization impact
          logHeapUsage: true,
          include: ["src/integration-tests/**/*.test.{ts,tsx}"],
          exclude: [
            "node_modules",
            "src/_archived_frontend",
            "e2e",
            "playwright-report",
            "test-results",
          ],
        },
      },
      {
        plugins: [react(), tsconfigPaths()],
        resolve: {
          alias: {
            "~": path.resolve(__dirname, "./src"),
          },
        },
        // jsdom environment for browser/React tests
        test: {
          name: "jsdom",
          globals: true,
          environment: "jsdom",
          setupFiles: ["vitest.setup.react.ts"],
          pool: "forks",
          typecheck: {
            tsconfig: "./tsconfig.tests.json",
          },
          include: [
            "src/app/**/*.test.{ts,tsx}",
            "src/components/**/*.test.{ts,tsx}",
            "src/hooks/**/*.test.{ts,tsx}",
          ],
          exclude: [
            "node_modules",
            "src/_archived_frontend",
            "e2e",
            "playwright-report",
            "test-results",
          ],
        },
      },
    ],
  },
});
