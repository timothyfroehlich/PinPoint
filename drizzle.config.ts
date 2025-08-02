import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle/migrations",

  dbCredentials: {
    url: process.env.POSTGRES_PRISMA_URL!, // Use existing Supabase pooled connection
  },

  // Use custom migration table to avoid conflicts with Prisma
  migrations: {
    table: "__drizzle_migrations",
    schema: "public",
  },

  // Development features
  verbose: true,
  strict: true,
});
