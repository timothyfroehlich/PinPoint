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
      "next/server": path.resolve(__dirname, "./node_modules/next/server.js"),
    },
    conditions: ["node", "import"],
  },
  ssr: {
    noExternal: ["next-auth"],
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["src/test/setup/node.setup.ts"],
    include: ["src/lib/**/*.test.{ts,tsx}"],
    coverage: {
      enabled: true,
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "node_modules/",
        "src/test/",
        "**/*.test.{ts,tsx}",
        "**/*.vitest.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
      ],
    },
  },
});
