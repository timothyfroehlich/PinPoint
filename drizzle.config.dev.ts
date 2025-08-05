import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./supabase/migrations", // Output to Supabase migrations for proper integration

  dbCredentials: {
    url: process.env.POSTGRES_PRISMA_URL!, // Use existing Supabase pooled connection
  },

  // Development-specific settings
  verbose: true,
  strict: false, // Allow force operations in development
  introspect: {
    casing: "camel",
  },
});
