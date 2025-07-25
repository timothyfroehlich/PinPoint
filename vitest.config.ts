/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./src"),
      // Fix Next.js module resolution for NextAuth
      "next/server": path.resolve(__dirname, "./node_modules/next/server.js"),
    },
    conditions: ["node", "import"],
  },
  ssr: {
    noExternal: ["next-auth"],
  },
  test: {
    coverage: {
      enabled: true,
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
            // Fix Next.js module resolution for NextAuth
            "next/server": path.resolve(
              __dirname,
              "./node_modules/next/server.js",
            ),
          },
        },
        // Node environment for server-side tests
        test: {
          name: "node",
          globals: true,
          environment: "node",
          setupFiles: ["src/test/vitest.setup.ts"],
          typecheck: {
            tsconfig: "./tsconfig.tests.json",
          },
          include: [
            "src/lib/**/*.test.{ts,tsx}",
            "src/server/**/*.test.{ts,tsx}",
            "src/integration-tests/**/*.test.{ts,tsx}",
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
      {
        plugins: [react(), tsconfigPaths()],
        resolve: {
          alias: {
            "~": path.resolve(__dirname, "./src"),
            // Fix Next.js module resolution for NextAuth
            "next/server": path.resolve(
              __dirname,
              "./node_modules/next/server.js",
            ),
          },
        },
        // jsdom environment for browser/React tests
        test: {
          name: "jsdom",
          globals: true,
          environment: "jsdom",
          setupFiles: ["src/test/vitest.setup.ts"],
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
