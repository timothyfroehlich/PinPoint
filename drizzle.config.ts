import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Load Next.js environment variables (respects .env.local priority)
loadEnvConfig(process.cwd());

// Prefer Supabase Vercel integration names, fall back to legacy PinPoint names
const databaseUrl =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DIRECT_URL;

if (!databaseUrl) {
  throw new Error(
    "Database URL environment variable (DATABASE_URL, POSTGRES_URL_NON_POOLING, etc.) is required for Drizzle config."
  );
}

// Use non-pooled connection for migrations (poolers don't support DDL commands)
// POSTGRES_URL_NON_POOLING is the standard Supabase Vercel integration name
const directUrl =
  process.env.POSTGRES_URL_NON_POOLING || process.env.DIRECT_URL || databaseUrl;

// Safety: prevent drizzle-kit from accidentally running against production
const isProductionUrl = /supabase\.com|neon\.tech|rds\.amazonaws\.com/.test(
  directUrl
);
if (isProductionUrl && !process.env.DRIZZLE_FORCE_PRODUCTION) {
  throw new Error(
    `🚨 SAFETY: drizzle-kit would run against a production database!\n` +
      `   URL: ${directUrl.replace(/:[^:@]+@/, ":***@")}\n` +
      `   To proceed intentionally, set DRIZZLE_FORCE_PRODUCTION=1\n` +
      `   For local dev, ensure DIRECT_URL is set in .env.local`
  );
}

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: directUrl,
  },
  //Prevent Drizzle Kit from parsing Supabase system tables
  tablesFilter: [
    "user_profiles",
    "machines",
    "issues",
    "issue_comments",
    "issue_images",
    "issue_watchers",
    "notifications",
    "notification_preferences",
    "invited_users",
    "machine_watchers",
  ],
  schemaFilter: ["public"],
  verbose: true,
  strict: false, // Allow force operations in pre-beta
});
