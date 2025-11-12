import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "path";

export default defineConfig(({ mode }) => {
  // Load .env.local for tests
  const env = loadEnv(mode, process.cwd(), "");

  return {
    test: {
      globals: true,
      environment: "node",
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
      exclude: ["node_modules", ".next", "out"],
      env: {
        ...env,
        // Ensure DATABASE_URL is available for integration tests
        DATABASE_URL: env.DATABASE_URL || process.env.DATABASE_URL || "",
      },
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "html", "lcov"],
        include: ["src/**/*.{ts,tsx}"],
        exclude: [
          "src/**/*.test.{ts,tsx}",
          "src/test/**",
          "src/app/**", // Server Components tested via E2E
          "**/*.d.ts",
          "**/types.ts",
          "**/*.config.{ts,js}",
        ],
        thresholds: {
          lines: 80,
          functions: 80,
          branches: 80,
          statements: 80,
        },
      },
    },
    resolve: {
      alias: {
        "~": path.resolve(__dirname, "./src"),
      },
    },
  };
});
