import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./supabase/migrations", // Output to Supabase migrations for proper integration
  casing: "snake_case", // Convert camelCase TypeScript fields to snake_case PostgreSQL columns

  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@localhost:54322/postgres",
  },

  // Development-specific settings
  verbose: true,
  strict: false, // Allow force operations in development
  introspect: {
    casing: "camel", // Keep camelCase when introspecting existing schemas
  },
});
