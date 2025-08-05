import { defineConfig } from "drizzle-kit";

// Load development environment variables
import "./src/lib/env-loaders/development";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./supabase/migrations", // Output to Supabase migrations for proper integration

  dbCredentials: {
    url:
      process.env.POSTGRES_PRISMA_URL ??
      "postgresql://postgres:postgres@localhost:54322/postgres",
  },

  // Development-specific settings
  verbose: true,
  strict: false, // Allow force operations in development
  introspect: {
    casing: "camel",
  },
});
