/**
 * Simplified Vitest Configuration for PinPoint
 *
 * Minimal configuration to support basic test functionality during
 * test system reboot. Supports single unit test and future archetype system.
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
    exclude: ["node_modules", "e2e", ".next"],
  },
});
