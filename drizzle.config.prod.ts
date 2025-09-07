import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./supabase/migrations", // Consistent with Supabase ecosystem
  casing: "snake_case", // Convert camelCase TypeScript fields to snake_case PostgreSQL columns
  // Limit introspection scope to our application tables only to avoid
  // third-party/system objects that can confuse the parser on some hosts
  tablesFilter: [
    // Organizations / RBAC
    "organizations",
    "memberships",
    "roles",
    "permissions",
    "role_permissions",
    "system_settings",
    "activity_log",
    "invitations",
    // Machines / Locations / Models
    "locations",
    "models",
    "machines",
    // Issues / Workflow
    "issues",
    "priorities",
    "issue_statuses",
    "comments",
    "attachments",
    "issue_history",
    "upvotes",
    "anonymous_rate_limits",
    // Collections / Notifications
    "collections",
    "collection_types",
    "notifications",
    "collection_machines",
    "pinball_map_configs",
    // Auth (app-level)
    "users",
    "accounts",
    "sessions",
    "verification_tokens",
  ],

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
