import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Load Next.js environment variables (respects .env.local priority)
loadEnvConfig(process.cwd());

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL environment variable is required for Drizzle config."
  );
}

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  // Limit introspection to our app tables only
  // Prevents Drizzle Kit from parsing Supabase system tables
  tablesFilter: ["user_profiles", "machines", "issues", "issue_comments"],
  schemaFilter: ["public"],
  verbose: true,
  strict: false, // Allow force operations in pre-beta
});
