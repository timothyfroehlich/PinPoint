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
    },
    resolve: {
      alias: {
        "~": path.resolve(__dirname, "./src"),
      },
    },
  };
});
