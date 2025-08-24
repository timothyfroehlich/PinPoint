import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./supabase/migrations", // Consistent with Supabase ecosystem
  casing: "snake_case", // Convert camelCase TypeScript fields to snake_case PostgreSQL columns

  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@localhost:54322/postgres",
  },

  // Production-specific settings
  verbose: false, // Quiet output for production
  strict: true, // Strict mode for production safety
  schemaFilter: ["public"], // Only public schema in production
});
