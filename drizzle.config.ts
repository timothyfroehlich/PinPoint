import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Load Next.js environment variables (respects .env.local priority)
loadEnvConfig(process.cwd());

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL ||
  process.env.DIRECT_URL;

if (!databaseUrl) {
  throw new Error(
    "Database URL environment variable (DATABASE_URL, POSTGRES_URL_NON_POOLING, etc.) is required for Drizzle config."
  );
}

// Use DIRECT_URL for migrations (bypasses connection pooler)
// Connection poolers don't support all PostgreSQL commands needed for migrations
const directUrl = process.env.DIRECT_URL || databaseUrl;

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: directUrl,
  },
  // Limit introspection to our app tables only
  // Prevents Drizzle Kit from parsing Supabase system tables
  tablesFilter: [
    "user_profiles",
    "machines",
    "issues",
    "issue_comments",
    "issue_watchers",
    "machine_watchers",
    "notifications",
    "notification_preferences",
    "invited_users",
  ],
  schemaFilter: ["public"],
  verbose: true,
  strict: false, // Allow force operations in pre-beta
});
