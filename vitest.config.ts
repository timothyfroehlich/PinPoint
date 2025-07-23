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
    },
  },
  test: {
    projects: [
      {
        plugins: [react(), tsconfigPaths()],
        resolve: {
          alias: {
            "~": path.resolve(__dirname, "./src"),
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
            "src/lib/**/*.vitest.test.{ts,tsx}",
            "src/server/**/*.vitest.test.{ts,tsx}",
            "src/integration-tests/**/*.vitest.test.{ts,tsx}",
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
          },
        },
        // jsdom environment for browser/React tests
        test: {
          name: "jsdom",
          globals: true,
          environment: "jsdom",
          setupFiles: ["src/test/vitest.setup.ts"],
          typecheck: {
            tsconfig: "./tsconfig.tests.json",
          },
          include: [
            "src/app/**/*.vitest.test.{ts,tsx}",
            "src/components/**/*.vitest.test.{ts,tsx}",
            "src/hooks/**/*.vitest.test.{ts,tsx}",
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
