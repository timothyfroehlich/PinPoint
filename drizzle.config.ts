import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Load Next.js environment variables (respects .env.local priority)
loadEnvConfig(process.cwd());

const databaseUrl = process.env.POSTGRES_URL;

if (!databaseUrl) {
  throw new Error(
    "POSTGRES_URL environment variable is required for Drizzle config."
  );
}

function isLikelyPooledPostgresUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const port = parsed.port;

    return (
      port === "6543" ||
      host.includes(".pooler.") ||
      host.includes("pooler.") ||
      parsed.searchParams.get("pgbouncer") === "true"
    );
  } catch {
    // If it's not parseable, don't assume pooled; keep behavior conservative.
    return false;
  }
}

// Use a non-pooled connection for migrations (poolers often don't support DDL commands).
// If POSTGRES_URL appears to be pooled, require POSTGRES_URL_NON_POOLING explicitly.
const directUrl =
  process.env.POSTGRES_URL_NON_POOLING ??
  (isLikelyPooledPostgresUrl(databaseUrl) ? undefined : databaseUrl);

if (!directUrl) {
  throw new Error(
    "POSTGRES_URL_NON_POOLING is required for drizzle-kit migrations when POSTGRES_URL points to a pooled connection. " +
      "Set POSTGRES_URL_NON_POOLING to a direct (non-pooled) PostgreSQL URL (typically port 5432)."
  );
}

// Safety: prevent drizzle-kit from accidentally running against production
const isProductionUrl = /supabase\.com|neon\.tech|rds\.amazonaws\.com/.test(
  directUrl
);
if (isProductionUrl && !process.env.DRIZZLE_FORCE_PRODUCTION) {
  throw new Error(
    `SAFETY: drizzle-kit would run against a production database!\n` +
      `   URL: ${directUrl.replace(/:[^:@]+@/, ":***@")}\n` +
      `   To proceed intentionally, set DRIZZLE_FORCE_PRODUCTION=1\n` +
      `   For local dev, ensure POSTGRES_URL_NON_POOLING is set in .env.local`
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
