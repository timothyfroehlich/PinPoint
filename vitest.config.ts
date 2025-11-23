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
          "src/components/ui/**", // shadcn/ui library components
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
      // Project-based test suites
      projects: [
        {
          extends: true,
          test: {
            name: "unit",
            include: [
              "src/**/*.test.ts",
              "src/**/*.test.tsx",
              "e2e/**/*.test.ts",
            ],
            exclude: ["src/test/integration/**"],
          },
        },
        {
          extends: true,
          test: {
            name: "integration",
            include: [
              "src/test/integration/**/*.test.ts",
              "src/test/integration/**/*.test.tsx",
            ],
            exclude: ["src/test/integration/supabase/**"],
          },
        },
        {
          extends: true,
          test: {
            name: "integration-supabase",
            include: [
              "src/test/integration/supabase/**/*.test.ts",
              "src/test/integration/supabase/**/*.test.tsx",
            ],
          },
        },
      ],
    },
    resolve: {
      alias: {
        "~": path.resolve(__dirname, "./src"),
      },
    },
  };
});
